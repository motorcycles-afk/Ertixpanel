// Global variables
let currentUser = null;
let userContainer = null;
let terminal = null;
let websocket = null;
let fitAddon = null;

// DOM elements
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginFormElement = document.getElementById('login-form-element');
const registerFormElement = document.getElementById('register-form-element');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const refreshBtn = document.getElementById('refresh-btn');
const createForm = document.getElementById('create-form');
const loadingOverlay = document.getElementById('loading-overlay');
const modal = document.getElementById('modal');
const notification = document.getElementById('notification');
const connectConsoleBtn = document.getElementById('connect-console');
const disconnectConsoleBtn = document.getElementById('disconnect-console');

// API functions
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`/api${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include', // Include session cookie
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Utility functions
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notificationMsg = document.getElementById('notification-message');
    notificationMsg.textContent = message;
    
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showModal(title, message, confirmCallback) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');
    
    // Remove existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        confirmCallback();
    });
    
    modal.style.display = 'flex';
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to selected tab button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Initialize terminal if console tab is selected
    if (tabName === 'console' && !terminal) {
        setTimeout(() => {
            initializeTerminal();
        }, 100);
    }
}

function switchAuthForm(formType) {
    if (formType === 'register') {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    } else {
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
    }
}

// Authentication functions
async function login(username, password) {
    try {
        showLoading();
        const response = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        currentUser = response.user;
        showMainApp();
        showNotification(`Welcome back, ${currentUser.username}!`);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function register(username, email, password) {
    try {
        showLoading();
        const response = await apiCall('/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        currentUser = response.user;
        showMainApp();
        showNotification(`Account created successfully! Welcome, ${currentUser.username}!`);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function logout() {
    try {
        await apiCall('/logout', { method: 'POST' });
        currentUser = null;
        userContainer = null;
        
        // Disconnect terminal if connected
        if (websocket) {
            websocket.close();
        }
        
        showAuthScreen();
        showNotification('Logged out successfully');
    } catch (error) {
        showNotification('Error logging out', 'error');
    }
}

async function checkAuthStatus() {
    try {
        const response = await apiCall('/user');
        currentUser = response;
        showMainApp();
        return true;
    } catch (error) {
        showAuthScreen();
        return false;
    }
}

function showAuthScreen() {
    authScreen.style.display = 'flex';
    mainApp.style.display = 'none';
}

function showMainApp() {
    authScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    usernameDisplay.textContent = currentUser.username;
    loadUserData();
}

// Container management functions
async function loadUserData() {
    try {
        await loadContainers();
        updateDashboard();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadContainers() {
    try {
        const containers = await apiCall('/containers');
        userContainer = containers.length > 0 ? containers[0] : null;
        renderContainer();
        updateConsoleStatus();
    } catch (error) {
        showNotification(`Failed to load container: ${error.message}`, 'error');
    }
}

function renderContainer() {
    const containerContent = document.getElementById('container-content');
    const createSection = document.getElementById('create-container-section');
    
    if (userContainer) {
        createSection.style.display = 'none';
        containerContent.innerHTML = `
            <div class="container-card fade-in">
                <div class="container-card-header">
                    <div>
                        <div class="container-name">
                            <span class="status-indicator ${userContainer.status.toLowerCase()}"></span>
                            ${userContainer.displayName}
                        </div>
                        <span class="container-status status-${userContainer.status.toLowerCase()}">
                            ${userContainer.status}
                        </span>
                    </div>
                </div>
                
                <div class="container-info">
                    <div>
                        <strong>Operating System</strong>
                        ${userContainer.image}
                    </div>
                    <div>
                        <strong>IP Address</strong>
                        ${userContainer.ipv4 || 'N/A'}
                    </div>
                    <div>
                        <strong>Created</strong>
                        ${new Date(userContainer.created).toLocaleDateString()}
                    </div>
                    ${userContainer.description ? `
                    <div>
                        <strong>Description</strong>
                        ${userContainer.description}
                    </div>
                    ` : ''}
                </div>
                
                <div class="container-actions">
                    ${userContainer.status === 'Running' ? 
                        `<button class="btn btn-warning" onclick="stopContainer()">
                            <i class="fas fa-stop"></i> Stop Container
                        </button>` :
                        `<button class="btn btn-success" onclick="startContainer()">
                            <i class="fas fa-play"></i> Start Container
                        </button>`
                    }
                    <button class="btn btn-primary" onclick="openConsole()" 
                            ${userContainer.status !== 'Running' ? 'disabled' : ''}>
                        <i class="fas fa-terminal"></i> Open Console
                    </button>
                    <button class="btn btn-danger" onclick="deleteContainer()">
                        <i class="fas fa-trash"></i> Delete Container
                    </button>
                </div>
            </div>
        `;
    } else {
        createSection.style.display = 'block';
        containerContent.innerHTML = '';
    }
}

function updateDashboard() {
    const containerStatus = document.getElementById('container-status');
    const dashboardStatus = document.getElementById('dashboard-status');
    const dashboardIp = document.getElementById('dashboard-ip');
    const dashboardCreated = document.getElementById('dashboard-created');
    const quickCreate = document.getElementById('quick-create');
    
    if (userContainer) {
        containerStatus.textContent = `${userContainer.displayName} (${userContainer.status})`;
        dashboardStatus.textContent = userContainer.status;
        dashboardIp.textContent = userContainer.ipv4 || 'N/A';
        dashboardCreated.textContent = new Date(userContainer.created).toLocaleDateString();
        quickCreate.style.display = 'none';
    } else {
        containerStatus.textContent = 'No container created';
        dashboardStatus.textContent = '-';
        dashboardIp.textContent = '-';
        dashboardCreated.textContent = '-';
        quickCreate.style.display = 'inline-flex';
    }
}

async function createContainer(event) {
    event.preventDefault();
    
    const containerData = {
        name: document.getElementById('container-name').value,
        image: document.getElementById('container-image').value,
        description: document.getElementById('container-description').value
    };

    try {
        showLoading();
        await apiCall('/containers', {
            method: 'POST',
            body: JSON.stringify(containerData)
        });
        
        showNotification(`Container "${containerData.name}" created successfully!`);
        createForm.reset();
        await loadUserData();
        switchTab('container');
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function startContainer() {
    if (!userContainer) return;
    
    try {
        showLoading();
        await apiCall(`/containers/${userContainer.name}/start`, {
            method: 'POST'
        });
        showNotification('Container started successfully');
        await loadUserData();
    } catch (error) {
        showNotification(`Failed to start container: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function stopContainer() {
    if (!userContainer) return;
    
    showModal(
        'Stop Container',
        `Are you sure you want to stop "${userContainer.displayName}"?`,
        async () => {
            try {
                showLoading();
                await apiCall(`/containers/${userContainer.name}/stop`, {
                    method: 'POST'
                });
                showNotification('Container stopped successfully');
                await loadUserData();
            } catch (error) {
                showNotification(`Failed to stop container: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

async function deleteContainer() {
    if (!userContainer) return;
    
    showModal(
        'Delete Container',
        `Are you sure you want to permanently delete "${userContainer.displayName}"? This action cannot be undone.`,
        async () => {
            try {
                showLoading();
                await apiCall(`/containers/${userContainer.name}`, {
                    method: 'DELETE'
                });
                showNotification('Container deleted successfully');
                await loadUserData();
            } catch (error) {
                showNotification(`Failed to delete container: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

// Console functions
function updateConsoleStatus() {
    const canConnect = userContainer && userContainer.status === 'Running';
    connectConsoleBtn.disabled = !canConnect;
    
    if (!canConnect) {
        connectConsoleBtn.innerHTML = '<i class="fas fa-plug"></i> Connect (Container must be running)';
    } else {
        connectConsoleBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
    }
}

function initializeTerminal() {
    if (terminal) {
        terminal.dispose();
    }

    terminal = new Terminal({
        theme: {
            background: '#1e1e1e',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: '#ffffff40',
            black: '#000000',
            red: '#ff5555',
            green: '#50fa7b',
            yellow: '#f1fa8c',
            blue: '#bd93f9',
            magenta: '#ff79c6',
            cyan: '#8be9fd',
            white: '#bfbfbf'
        },
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Consolas", "Monaco", monospace',
        cursorBlink: true,
        scrollback: 1000
    });

    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    
    const terminalElement = document.getElementById('terminal');
    terminal.open(terminalElement);
    fitAddon.fit();

    // Handle terminal input
    terminal.onData(data => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });

    // Handle terminal resize
    window.addEventListener('resize', () => {
        if (fitAddon) {
            setTimeout(() => fitAddon.fit(), 100);
        }
    });
}

function connectConsole() {
    if (!userContainer || userContainer.status !== 'Running') {
        showNotification('Container must be running to connect console', 'warning');
        return;
    }

    try {
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            websocket.send(JSON.stringify({
                type: 'connect',
                containerName: userContainer.name
            }));
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connected':
                    showNotification(`Connected to ${userContainer.displayName}`);
                    connectConsoleBtn.disabled = true;
                    disconnectConsoleBtn.disabled = false;
                    break;
                    
                case 'data':
                    if (terminal) {
                        terminal.write(data.data);
                    }
                    break;
                    
                case 'exit':showNotification('Console session ended', 'warning');
                    disconnectConsole();
                    break;
                    
                case 'error':
                    showNotification('Console error: ' + data.message, 'error');
                    disconnectConsole();
                    break;
            }
        };

        websocket.onclose = () => {
            disconnectConsole();
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            showNotification('Console connection failed', 'error');
            disconnectConsole();
        };

    } catch (error) {
        console.error('Failed to connect to console:', error);
        showNotification('Failed to connect to console', 'error');
    }
}

function disconnectConsole() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    
    if (terminal) {
        terminal.clear();
    }
    
    connectConsoleBtn.disabled = false;
    disconnectConsoleBtn.disabled = true;
    updateConsoleStatus();
    
    showNotification('Console disconnected');
}

function openConsole() {
    switchTab('console');
    if (!terminal) {
        initializeTerminal();
    }
    setTimeout(() => {
        connectConsole();
    }, 500);
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    await checkAuthStatus();
    
    // Auth form switching
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthForm('register');
    });
    
    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthForm('login');
    });
    
    // Form submissions
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        await login(username, password);
    });
    
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        await register(username, email, password);
    });
    
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Main app controls
    logoutBtn.addEventListener('click', logout);
    refreshBtn.addEventListener('click', loadUserData);
    createForm.addEventListener('submit', createContainer);
    
    // Console controls
    connectConsoleBtn.addEventListener('click', connectConsole);
    disconnectConsoleBtn.addEventListener('click', disconnectConsole);
    
    // Quick create button
    document.getElementById('quick-create').addEventListener('click', () => {
        switchTab('container');
    });
    
    // Modal close handlers
    document.getElementById('modal-cancel').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Notification close handler
    document.getElementById('notification-close').addEventListener('click', () => {
        notification.style.display = 'none';
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Auto-refresh user data every 30 seconds if logged in
    setInterval(() => {
        if (currentUser) {
            loadUserData();
        }
    }, 30000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
    if (terminal) {
        terminal.dispose();
    }
});