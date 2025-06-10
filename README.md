# ErtixNodes - LXC Container Management System

A modern full-stack web application for managing LXC containers with real-time console access. Built with Node.js, Express, WebSockets, and a clean responsive web interface.

## Features

- **Container Management**: Create, start, stop, and delete LXC containers
- **Real-time Console Access**: Interactive terminal access to containers via web browser
- **JSON Database**: Lightweight file-based storage for container metadata
- **Responsive Web Interface**: Modern, mobile-friendly design
- **Live Status Updates**: Real-time container status monitoring
- **Multiple Linux Distributions**: Support for Ubuntu, Alpine, Debian, CentOS, and Fedora

## Prerequisites

Before running ErtixNodes, ensure you have the following installed on your host system:

### System Requirements
- **Linux Host System** (Ubuntu 20.04+ recommended) - *Required for LXC functionality*
- **LXD/LXC** installed and configured
- **Node.js** (version 16 or higher)
- **npm** (Node Package Manager)

> **Note**: While the application can be developed on Windows, LXC containers only run on Linux. For full functionality including console access, deploy on a Linux system.

### LXC Setup

1. **Install LXD/LXC**:
   ```bash
   sudo apt update
   sudo apt install lxd
   ```

2. **Initialize LXD**:
   ```bash
   sudo lxd init
   ```
   Follow the prompts (accept defaults for basic setup)

3. **Add your user to the lxd group**:
   ```bash
   sudo usermod -a -G lxd $USER
   newgrp lxd
   ```

4. **Verify LXC is working**:
   ```bash
   lxc list
   ```

## Installation

1. **Clone or download the project**:
   ```bash
   git clone <repository-url>
   cd ertixnodes
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at: `http://localhost:3000`

## Usage

### Web Interface

1. **Access the application** at `http://localhost:3000`
2. **Container Management Tab**:
   - View all containers with their status, IP addresses, and details
   - Start/Stop containers with one click
   - Delete containers (with confirmation)
   - Refresh container list

3. **Create Container Tab**:
   - Choose from pre-configured Linux images
   - Set container name and description
   - Create new containers instantly

4. **Console Tab**:
   - Select running containers from dropdown
   - Connect to interactive terminal
   - Full bash shell access within containers

### API Endpoints

The application provides a RESTful API:

- `GET /api/containers` - List all containers
- `POST /api/containers` - Create new container
- `POST /api/containers/:name/start` - Start container
- `POST /api/containers/:name/stop` - Stop container
- `DELETE /api/containers/:name` - Delete container

### WebSocket Console

Real-time console access is provided via WebSocket connection:
- Connect: Send `{"type": "connect", "containerName": "container-name"}`
- Input: Send `{"type": "input", "data": "command"}`
- Resize: Send `{"type": "resize", "cols": 80, "rows": 24}`

## Configuration

### Database
- Container metadata is stored in `database.json`
- Automatically created on first run
- Contains container information and application settings

### Default Images
The application comes pre-configured with:
- Ubuntu 22.04 LTS
- Ubuntu 20.04 LTS
- Alpine Linux (Latest)
- Debian 11
- CentOS 8
- Fedora (Latest)

## File Structure

```
ertixnodes/
âââ server.js              # Main server application
âââ package.json           # Node.js dependencies
âââ database.json          # JSON database (auto-created)
âââ README.md              # This file
âââ public/                # Frontend files
    âââ index.html         # Main HTML page
    âââ style.css          # Styling
    âââ app.js             # Frontend JavaScript
```

## Security Notes

- **Host Access**: This application runs LXC commands on the host system
- **Network**: By default, binds to all interfaces (0.0.0.0)
- **Authentication**: No built-in authentication (add reverse proxy if needed)
- **Firewall**: Consider restricting access to port 3000

## Troubleshooting

### Common Issues

1. **"lxc: command not found"**
   - Ensure LXD/LXC is installed: `sudo apt install lxd`

2. **Permission denied errors**
   - Add user to lxd group: `sudo usermod -a -G lxd $USER`
   - Logout and login again

3. **Console connection fails**
   - Ensure container is running
   - Check WebSocket connection in browser dev tools

4. **Images not downloading**
   - Check internet connection
   - Verify LXD is properly initialized: `lxd init`

### Logs
Check server logs in the terminal where you ran `npm start` for detailed error information.

## Development

To contribute or modify the application:

1. **Backend**: Edit `server.js` for API changes
2. **Frontend**: Modify files in `public/` directory
3. **Styling**: Update `public/style.css`
4. **Functionality**: Edit `public/app.js`

### Dependencies
- **express**: Web server framework
- **ws**: WebSocket library
- **node-pty**: Terminal emulation
- **cors**: Cross-origin resource sharing
- **uuid**: Unique identifier generation

## License

MIT License - feel free to modify and distribute.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Verify LXC setup is correct
3. Check server logs for detailed errors
4. Ensure all dependencies are installed

---

**ErtixNodes** - Simplifying LXC container management through modern web interfaces.