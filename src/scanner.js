const { exec } = require('child_process');

/**
 * Scans for all listening TCP ports on the machine using `lsof`.
 * Returns an array of { pid, process, port, user } objects.
 */
function scanListeningPorts(excludePorts = []) {
  return new Promise((resolve) => {
    // -iTCP: only TCP connections
    // -sTCP:LISTEN: only LISTEN state
    // -P: inhibit port name lookup (show port numbers)
    // -n: inhibit hostname lookup (show IPs)
    exec('lsof -iTCP -sTCP:LISTEN -P -n', (error, stdout) => {
      if (error || !stdout) {
        return resolve([]);
      }

      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return resolve([]);

      // Skip header line
      const entries = lines.slice(1);
      const portMap = new Map();

      for (const line of entries) {
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;

        const process = parts[0];
        const pid = parseInt(parts[1], 10);
        const user = parts[2];
        const nameField = parts[8]; // e.g. *:3000 or 127.0.0.1:8000

        // Extract port number from the name field
        const portMatch = nameField.match(/:(\d+)$/);
        if (!portMatch) continue;

        const port = parseInt(portMatch[1], 10);

        // Skip excluded ports (like the Tunnel dashboard itself)
        if (excludePorts.includes(port)) continue;

        // Deduplicate: keep the first entry per port (most specific process)
        if (!portMap.has(port)) {
          portMap.set(port, { pid, process, port, user });
        }
      }

      // Sort by port number
      const results = Array.from(portMap.values()).sort((a, b) => a.port - b.port);
      resolve(results);
    });
  });
}

module.exports = { scanListeningPorts };
