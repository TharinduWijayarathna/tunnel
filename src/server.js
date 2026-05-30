const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const TunnelManager = require('./proxy');
const { getNetworkInterfaces, getPrimaryIP } = require('./network');
const { scanListeningPorts } = require('./scanner');

function createApp() {
  const app = express();
  const tunnelManager = new TunnelManager();

  // Middleware
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ─── API: Network Interfaces ───────────────────────────────────────
  app.get('/api/interfaces', (req, res) => {
    try {
      const interfaces = getNetworkInterfaces();
      const primaryIP = getPrimaryIP();
      res.json({ interfaces, primaryIP });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── API: Scan Listening Ports ──────────────────────────────────────
  app.get('/api/ports', async (req, res) => {
    try {
      const dashboardPort = parseInt(process.env.PORT || 4040, 10);
      const ports = await scanListeningPorts([dashboardPort]);

      // Mark ports that already have an active tunnel
      const activeTunnels = tunnelManager.getTunnels();
      const tunneledPorts = new Set(activeTunnels.map((t) => t.localPort));

      const enriched = ports.map((p) => ({
        ...p,
        tunneled: tunneledPorts.has(p.port),
      }));

      res.json({ ports: enriched });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── API: List Tunnels ─────────────────────────────────────────────
  app.get('/api/tunnels', (req, res) => {
    try {
      const tunnels = tunnelManager.getTunnels();
      res.json({ tunnels });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── API: Create Tunnel ────────────────────────────────────────────
  app.post('/api/tunnels', async (req, res) => {
    try {
      const { localPort, exposedPort, exposeToInternet } = req.body;

      if (!localPort) {
        return res.status(400).json({ error: 'Local port is required.' });
      }

      const tunnel = await tunnelManager.createTunnel({
        localPort: parseInt(localPort, 10),
        exposedPort: parseInt(exposedPort || localPort, 10),
        exposeToInternet: !!exposeToInternet,
      });

      const primaryIP = getPrimaryIP();
      console.log(
        `  ✔ Tunnel created: http://${primaryIP}:${tunnel.exposedPort} → localhost:${tunnel.localPort}`
      );
      if (tunnel.publicUrl) {
        console.log(`  🌍 Public URL: ${tunnel.publicUrl}`);
      }

      res.status(201).json({ tunnel });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── API: Toggle Internet Exposure ─────────────────────────────────
  app.post('/api/tunnels/:id/internet', async (req, res) => {
    try {
      const { enable } = req.body;
      const result = await tunnelManager.toggleInternet(req.params.id, !!enable);

      if (result.publicUrl) {
        console.log(`  🌍 Internet tunnel enabled: ${result.publicUrl}`);
      } else {
        console.log(`  ✖ Internet tunnel disabled for tunnel ${req.params.id}`);
      }

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── API: Delete Tunnel ────────────────────────────────────────────
  app.delete('/api/tunnels/:id', async (req, res) => {
    try {
      const deleted = await tunnelManager.destroyTunnel(req.params.id);
      console.log(`  ✖ Tunnel destroyed: #${deleted.id}`);
      res.json({ deleted });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // ─── API: Tunnel Status ────────────────────────────────────────────
  app.get('/api/tunnels/:id/status', async (req, res) => {
    try {
      const status = await tunnelManager.checkStatus(req.params.id);
      res.json(status);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // ─── API: QR Code for Tunnel ───────────────────────────────────────
  app.get('/api/tunnels/:id/qr', async (req, res) => {
    try {
      const tunnels = tunnelManager.getTunnels();
      const tunnel = tunnels.find((t) => t.id === req.params.id);
      if (!tunnel) {
        return res.status(404).json({ error: 'Tunnel not found.' });
      }

      // Use public URL if available, otherwise use LAN URL
      const urlType = req.query.type || 'auto';
      let url;
      if (urlType === 'public' && tunnel.publicUrl) {
        url = tunnel.publicUrl;
      } else if (urlType === 'local' || !tunnel.publicUrl) {
        const primaryIP = getPrimaryIP();
        url = `http://${primaryIP}:${tunnel.exposedPort}`;
      } else {
        // auto: prefer public if available
        url = tunnel.publicUrl || `http://${getPrimaryIP()}:${tunnel.exposedPort}`;
      }

      const qr = await QRCode.toString(url, {
        type: 'svg',
        color: {
          dark: '#111110',
          light: '#00000000',
        },
        margin: 2,
        width: 256,
      });

      res.json({ qr, url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Fallback: Serve dashboard ─────────────────────────────────────
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return { app, tunnelManager };
}

module.exports = createApp;
