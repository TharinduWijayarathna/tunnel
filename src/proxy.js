const http = require('http');
const net = require('net');
const httpProxy = require('http-proxy');
const localtunnel = require('localtunnel');

class TunnelManager {
  constructor() {
    this.tunnels = new Map();
    this.idCounter = 0;
  }

  /**
   * Create a new tunnel that proxies from 0.0.0.0:exposedPort → localhost:localPort
   * Optionally also exposes to the internet via localtunnel.
   */
  async createTunnel({ localPort, exposedPort, exposeToInternet = false }) {
    // Validate ports
    localPort = parseInt(localPort, 10);
    exposedPort = parseInt(exposedPort, 10);

    if (!localPort || localPort < 1 || localPort > 65535) {
      throw new Error('Invalid local port. Must be between 1 and 65535.');
    }
    if (!exposedPort || exposedPort < 1 || exposedPort > 65535) {
      throw new Error('Invalid exposed port. Must be between 1 and 65535.');
    }

    // Check if exposed port is already in use by another tunnel
    for (const [, tunnel] of this.tunnels) {
      if (tunnel.exposedPort === exposedPort) {
        throw new Error(`Port ${exposedPort} is already used by another tunnel.`);
      }
    }

    const id = String(++this.idCounter);

    const proxy = httpProxy.createProxyServer({
      target: `http://127.0.0.1:${localPort}`,
      ws: true,
      changeOrigin: true,
    });

    // Track connections for stats
    let totalRequests = 0;
    let activeConnections = 0;

    proxy.on('error', (err, req, res) => {
      if (res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this._errorPage(localPort, err.message));
      }
    });

    const server = http.createServer({ maxHeaderSize: 65536 }, (req, res) => {
      totalRequests++;
      activeConnections++;
      res.on('finish', () => {
        activeConnections--;
      });
      proxy.web(req, res);
    });

    // WebSocket upgrade support (for hot-reload, etc.)
    server.on('upgrade', (req, socket, head) => {
      proxy.ws(req, socket, head);
    });

    return new Promise((resolve, reject) => {
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${exposedPort} is already in use on this system.`));
        } else {
          reject(err);
        }
      });

      server.listen(exposedPort, '0.0.0.0', async () => {
        const tunnel = {
          id,
          localPort,
          exposedPort,
          createdAt: new Date().toISOString(),
          server,
          proxy,
          internetTunnel: null,
          publicUrl: null,
          getStats: () => ({ totalRequests, activeConnections }),
        };

        this.tunnels.set(id, tunnel);

        // Optionally expose to internet
        if (exposeToInternet) {
          try {
            await this._startInternetTunnel(tunnel);
          } catch (err) {
            // Internet tunnel failed, but local tunnel is still running
            console.error(`  ⚠ Internet tunnel failed: ${err.message}`);
          }
        }

        resolve({
          id,
          localPort,
          exposedPort,
          createdAt: tunnel.createdAt,
          publicUrl: tunnel.publicUrl,
        });
      });
    });
  }

  /**
   * Start an internet tunnel (localtunnel) for an existing tunnel
   */
  async _startInternetTunnel(tunnel) {
    if (tunnel.internetTunnel) {
      // Already has an internet tunnel, close it first
      tunnel.internetTunnel.close();
      tunnel.internetTunnel = null;
      tunnel.publicUrl = null;
    }

    const lt = await localtunnel({ port: tunnel.exposedPort });

    tunnel.internetTunnel = lt;
    tunnel.publicUrl = lt.url;

    lt.on('close', () => {
      tunnel.internetTunnel = null;
      tunnel.publicUrl = null;
    });

    lt.on('error', (err) => {
      console.error(`  ⚠ Internet tunnel error for port ${tunnel.exposedPort}: ${err.message}`);
      tunnel.internetTunnel = null;
      tunnel.publicUrl = null;
    });

    return lt.url;
  }

  /**
   * Toggle internet exposure for a tunnel
   */
  async toggleInternet(id, enable) {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) {
      throw new Error(`Tunnel with ID "${id}" not found.`);
    }

    if (enable) {
      const url = await this._startInternetTunnel(tunnel);
      return { id, publicUrl: url, internet: true };
    } else {
      if (tunnel.internetTunnel) {
        tunnel.internetTunnel.close();
        tunnel.internetTunnel = null;
        tunnel.publicUrl = null;
      }
      return { id, publicUrl: null, internet: false };
    }
  }

  /**
   * Destroy a tunnel by ID
   */
  destroyTunnel(id) {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) {
      throw new Error(`Tunnel with ID "${id}" not found.`);
    }

    return new Promise((resolve) => {
      // Close internet tunnel if active
      if (tunnel.internetTunnel) {
        tunnel.internetTunnel.close();
      }

      tunnel.proxy.close();
      tunnel.server.close(() => {
        this.tunnels.delete(id);
        resolve({ id });
      });
    });
  }

  /**
   * Get all active tunnels (serializable)
   */
  getTunnels() {
    const result = [];
    for (const [, tunnel] of this.tunnels) {
      const stats = tunnel.getStats();
      result.push({
        id: tunnel.id,
        localPort: tunnel.localPort,
        exposedPort: tunnel.exposedPort,
        createdAt: tunnel.createdAt,
        totalRequests: stats.totalRequests,
        activeConnections: stats.activeConnections,
        publicUrl: tunnel.publicUrl,
        internetActive: !!tunnel.internetTunnel,
      });
    }
    return result;
  }

  /**
   * Check if the target localhost app is reachable
   */
  checkStatus(id) {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) {
      throw new Error(`Tunnel with ID "${id}" not found.`);
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 2000;

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve({
          id,
          status: 'online',
          localPort: tunnel.localPort,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          id,
          status: 'offline',
          localPort: tunnel.localPort,
        });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({
          id,
          status: 'offline',
          localPort: tunnel.localPort,
        });
      });

      socket.connect(tunnel.localPort, '127.0.0.1');
    });
  }

  /**
   * Close all tunnels (for graceful shutdown)
   */
  async destroyAll() {
    const ids = Array.from(this.tunnels.keys());
    for (const id of ids) {
      try {
        await this.destroyTunnel(id);
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Error page shown when target app is unreachable
   */
  _errorPage(port, errorMsg) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tunnel — Target Unreachable</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a1a;
      color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 3rem;
      max-width: 500px;
      text-align: center;
    }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .sub { color: #888; margin-bottom: 1.5rem; }
    .detail {
      background: rgba(255,82,82,0.1);
      border: 1px solid rgba(255,82,82,0.3);
      border-radius: 10px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.85rem;
      color: #ff8a80;
      word-break: break-all;
    }
    .hint { color: #666; font-size: 0.8rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔌</div>
    <h1>Target Unreachable</h1>
    <p class="sub">Cannot connect to <strong>localhost:${port}</strong></p>
    <div class="detail">${errorMsg}</div>
    <p class="hint">Make sure your application is running on port ${port}, then refresh this page.</p>
  </div>
</body>
</html>`;
  }
}

module.exports = TunnelManager;
