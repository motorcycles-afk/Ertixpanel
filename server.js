const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); 

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
    secret: 'ertixnodes-secret-key-' + uuidv4(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(express.static('public'));

// Database file path
const DB_FILE = path.join(__dirname, 'database.json');

// Initialize database
async function initDatabase() {
    try {
        await fs.access(DB_FILE);
    } catch (error) {
        // Database doesn't exist, create it
        const initialData = {
            users: [],
            containers: [],
            settings: {
                defaultImage: "ubuntu:22.04",
                defaultStorage: "default",
                maxContainersPerUser: 1
            }
        };
        await fs.writeFile(DB_FILE, JSON.stringify(initialData, null, 2));
        console.log('Database initialized');
    }
}

// Database operations
async function readDatabase() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { containers: [], settings: {} };
    }
}

async function writeDatabase(data) {
    try {
        await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.status(401).json({ error: 'Authentication required' });
    }
}

// User management functions
async function createUser(username, email, password) {
    const db = await readDatabase();
    
    // Check if user already exists
    const existingUser = db.users.find(u => u.username === username || u.email === email);
    if (existingUser) {
        throw new Error('Username or email already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = {
        id: uuidv4(),
        username,
        email,
        password: hashedPassword,
        created: new Date().toISOString(),
        lastLogin: null
    };
    
    db.users.push(newUser);
    await writeDatabase(db);
    
    return { id: newUser.id, username: newUser.username, email: newUser.email };
}

async function authenticateUser(username, password) {
    const db = await readDatabase();
    const user = db.users.find(u => u.username === username || u.email === username);
    
    if (!user) {
        throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        throw new Error('Invalid credentials');
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    await writeDatabase(db);
    
    return { id: user.id, username: user.username, email: user.email };
}

// Check if LXC is available
let lxcAvailable = false;

async function checkLXCAvailability() {
    try {
        const testProcess = spawn('lxc', ['--version']);
        return new Promise((resolve) => {
            testProcess.on('close', (code) => {
                lxcAvailable = code === 0;
                resolve(lxcAvailable);
            });
            testProcess.on('error', () => {
                lxcAvailable = false;
                resolve(false);
            });
        });
    } catch (error) {
        lxcAvailable = false;
        return false;
    }
}

// LXC command utilities
function executeLXCCommand(command, args = []) {
    return new Promise((resolve, reject) => {
        if (!lxcAvailable) {
            // Demo mode - return mock data
            if (command === 'list') {
                resolve(JSON.stringify([
                    {
                        name: "demo-ubuntu",
                        status: "Running",
                        state: {
                            network: {
                                eth0: {
                                    addresses: [
                                        { family: "inet", address: "10.0.0.50" }
                                    ]
                                }
                            }
                        }
                    },
                    {name: "demo-centos",
                        status: "Stopped",
                        state: {
                            network: {}
                        }
                    }
                ]));
            } else if (command === 'launch') {
                resolve('Container created successfully (demo mode)');
            } else if (command === 'start') {
                resolve('Container started successfully (demo mode)');
            } else if (command === 'stop') {
                resolve('Container stopped successfully (demo mode)');
            } else if (command === 'delete') {
                resolve('Container deleted successfully (demo mode)');
            } else {
                resolve('Command executed successfully (demo mode)');
            }
            return;
        }

        const lxc = spawn('lxc', [command, ...args]);
        let stdout = '';
        let stderr = '';

        lxc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        lxc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        lxc.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`LXC command failed: ${stderr}`));
            }
        });
    });
}

// Authentication API Routes

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        
        const user = await createUser(username, email, password);
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const user = await authenticateUser(username, password);
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ message: 'Login successful', user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Get current user
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const db = await readDatabase();
        const user = db.users.find(u => u.id === req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            created: user.created,
            lastLogin: user.lastLogin
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// Container API Routes

// Get user's containers
app.get('/api/containers', requireAuth, async (req, res) => {
    try {
        const db = await readDatabase();
        
        // Get only user's containers
        const userContainers = db.containers.filter(c => c.userId === req.session.userId);
        
        // Get live status from LXC
        const lxcList = await executeLXCCommand('list', ['--format', 'json']);
        const liveContainers = JSON.parse(lxcList);
        
        // Update database with live status
        userContainers.forEach(container => {
            const liveContainer = liveContainers.find(lc => lc.name === container.name);
            if (liveContainer) {
                container.status = liveContainer.status;
                container.ipv4 = liveContainer.state?.network?.eth0?.addresses?.find(addr => addr.family === 'inet')?.address || 'N/A';
            }
        });
        
        await writeDatabase(db);
        res.json(userContainers);
    } catch (error) {
        console.error('Error fetching containers:', error);
        res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

// Create container
app.post('/api/containers', requireAuth, async (req, res) => {
    try {
        const { name, image, description } = req.body;
        
        if (!name || !image) {
            return res.status(400).json({ error: 'Name and image are required' });
        }

        const db = await readDatabase();
        
        // Check if user already has a container
        const userContainers = db.containers.filter(c => c.userId === req.session.userId);
        if (userContainers.length >= db.settings.maxContainersPerUser) {
            return res.status(400).json({
                error: 'You can only have one container. Please delete your existing container first.'
            });
        }
        
        // Generate unique container name with username prefix
        const containerName = `${req.session.username}-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        // Create container with LXC
        await executeLXCCommand('launch', [image, containerName]);
        
        // Add to database
        const newContainer = {
            id: uuidv4(),
            name: containerName,
            displayName: name,
            image,
            description: description || '',
            status: 'Running',
            created: new Date().toISOString(),
            ipv4: 'N/A',
            userId: req.session.userId,
            username: req.session.username
        };
        
        db.containers.push(newContainer);
        await writeDatabase(db);
        
        res.status(201).json(newContainer);
    } catch (error) {
        console.error('Error creating container:', error);
        res.status(500).json({ error: `Failed to create container: ${error.message}` });
    }
});

// Start container
app.post('/api/containers/:name/start', requireAuth, async (req, res) => {
    try {
        const { name } = req.params;
        
        const db = await readDatabase();
        const container = db.containers.find(c => c.name === name && c.userId === req.session.userId);
        
        if (!container) {
            return res.status(404).json({ error: 'Container not found or access denied' });
        }
        
        await executeLXCCommand('start', [name]);
        
        // Update database status
        container.status = 'Running';
        await writeDatabase(db);
        
        res.json({ message: `Container ${container.displayName} started successfully` });
    } catch (error) {
        console.error('Error starting container:', error);
        res.status(500).json({ error: `Failed to start container: ${error.message}` });
    }
});

// Stop container
app.post('/api/containers/:name/stop', requireAuth, async (req, res) => {
    try {
        const { name } = req.params;
        
        const db = await readDatabase();
        const container = db.containers.find(c => c.name === name && c.userId === req.session.userId);
        
        if (!container) {
            return res.status(404).json({ error: 'Container not found or access denied' });
        }
        
        await executeLXCCommand('stop', [name]);
        
        // Update database status
        container.status = 'Stopped';
        await writeDatabase(db);
        
        res.json({ message: `Container ${container.displayName} stopped successfully` });
    } catch (error) {
        console.error('Error stopping container:', error);
        res.status(500).json({ error: `Failed to start container: ${error.message}` });
    }
});

// Delete container
app.delete('/api/containers/:name', requireAuth, async (req, res) => {
    try {
        const { name } = req.params;
        
        const db = await readDatabase();
        const container = db.containers.find(c => c.name === name && c.userId === req.session.userId);
        
        if (!container) {
            return res.status(404).json({ error: 'Container not found or access denied' });
        }
        
        // Stop and delete container with LXC
        try {
            await executeLXCCommand('stop', [name]);
        } catch (error) {
            // Container might already be stopped
        }
        await executeLXCCommand('delete', [name]);
        
        // Remove from database
        db.containers = db.containers.filter(c => c.name !== name);
        await writeDatabase(db);
        
        res.json({ message: `Container ${container.displayName} deleted successfully` });
    } catch (error) {
        console.error('Error deleting container:', error);
        res.status(500).json({ error: `Failed to delete container: ${error.message}` });
    }
});

// WebSocket for console access
const terminals = new Map();

wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'connect') {
                const { containerName } = data;
                
                // Create interactive shell process for container console
                const term = spawn('lxc', ['exec', containerName, '--', '/bin/bash', '-i'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: process.env
                });
                
                const terminalId = uuidv4();
                terminals.set(terminalId, { term, ws });
                
                // Send terminal data to client
                term.stdout.on('data', (data) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'data',
                            data: data.toString()
                        }));
                    }
                });
                
                term.stderr.on('data', (data) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'data',
                            data: data.toString()
                        }));
                    }
                });
                
                // Handle terminal exit
                term.on('exit', (code) => {
                    terminals.delete(terminalId);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'exit',
                            code: code
                        }));
                    }
                });
                
                term.on('error', (error) => {
                    console.error('Terminal process error:', error);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: error.message
                        }));
                    }
                });
                
                ws.terminalId = terminalId;
                
                ws.send(JSON.stringify({
                    type: 'connected',
                    terminalId: terminalId
                }));
                
                // Send initial prompt
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'data',
                            data: `\r\n\x1b[32mConnected to container: ${containerName}\x1b[0m\r\n`
                        }));
                    }
                }, 100);
                
            } else if (data.type === 'input') {
                const terminal = terminals.get(ws.terminalId);
                if (terminal && terminal.term && terminal.term.stdin) {
                    terminal.term.stdin.write(data.data);
                }
            } else if (data.type === 'resize') {
                // Basic resize support - for full PTY support, node-pty would be needed on Linux
                console.log(`Terminal resize requested: ${data.cols}x${data.rows}`);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'WebSocket message processing failed'
                }));
            }
        }
    });
    
    ws.on('close', () => {
        if (ws.terminalId) {
            const terminal = terminals.get(ws.terminalId);
            if (terminal && terminal.term) {
                terminal.term.kill('SIGTERM');
            }
            terminals.delete(ws.terminalId);
        }
        console.log('WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Initialize and start server
async function startServer() {
    await initDatabase();
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`ErtixNodes LXC Management Server running on port ${PORT}`);
        console.log(`Web interface: http://localhost:${PORT}`);
        console.log(`API endpoint: http://localhost:${PORT}/api`);
    });
}

startServer().catch(console.error);