const { exec } = require('child_process');

// Known system/desktop processes that should never be shown as exposable
const SYSTEM_PROCESSES = new Set([
  'ControlCe',  // macOS Control Center
  'Raycast',
  'rapportd',   // macOS Rapport daemon
  'sharingd',   // macOS sharing daemon
  'AirPlayXPC', // AirPlay
  'WiFiAgent',
  'SystemUIServer',
  'loginwindow',
  'WindowServer',
  'launchd',
  'mDNSResponder',
  'configd',
  'UserEvent',
  'com.apple',
  'bluetoothd',
  'remoted',
  'identitys',
  'coreautha',
  'AMPDeviceD',
  'AMPLibrar',
  'Spotlight',
  'Finder',
  'Dock',
  'Cursor',       // IDE internals
  'Antigravi',    // This app's own helper
  'Code',         // VS Code internals
  'Code Helper',
  'Electron',
  'language_',    // Language servers (from IDEs)
  'copilot-ag',
  'gopls',
  'typescript',
  'eslint_d',
  'biome',
]);

// Process name patterns to exclude (regex-based)
const SYSTEM_PATTERNS = [
  /^com\./i,        // macOS system services (com.apple.*, etc.)
  /^launchd/i,
  /^XPC/i,
  /Helper$/i,       // Electron/Chrome helper processes
  /^Google/i,       // Google Chrome internals
  /^Chromium/i,
  /^Firefox/i,
  /^Safari/i,
  /^Microsoft/i,
  /^Slack/i,
  /^Discord/i,
  /^Spotify/i,
  /^zoom/i,
  /^Figma/i,
  /^Notion/i,
  /^Postman/i,
];

// Known developer-facing processes to always keep
const DEV_PROCESSES = new Set([
  'node',
  'nodemon',
  'deno',
  'bun',
  'php',
  'php84',
  'php83',
  'php82',
  'php81',
  'php80',
  'php74',
  'python',
  'python3',
  'python3.1',
  'python3.12',
  'python3.13',
  'uvicorn',
  'gunicorn',
  'flask',
  'django',
  'ruby',
  'rails',
  'puma',
  'unicorn',
  'java',
  'gradle',
  'mvn',
  'tomcat',
  'spring',
  'go',
  'air',
  'cargo',
  'rustc',
  'dotnet',
  'nginx',
  'httpd',
  'apache',
  'caddy',
  'docker-pr',
  'docker',
  'mysqld',
  'postgres',
  'mongod',
  'redis-ser',
  'next-serv',
  'vite',
  'webpack',
  'esbuild',
  'turbo',
  'serve',
  'http-serv',
  'live-serv',
  'artisan',
  'mix',
  'npm',
  'yarn',
  'pnpm',
  'npx',
]);

/**
 * Determines if a process is a developer-facing app worth showing.
 */
function isDevProcess(processName) {
  // Always include known dev processes
  if (DEV_PROCESSES.has(processName)) return true;

  // Always exclude known system processes
  if (SYSTEM_PROCESSES.has(processName)) return false;

  // Exclude by pattern
  for (const pattern of SYSTEM_PATTERNS) {
    if (pattern.test(processName)) return false;
  }

  // For everything else, include it — better to show an unknown process
  // than hide a legitimate dev server
  return true;
}

/**
 * Scans for all listening TCP ports on the machine using `lsof`.
 * Returns an array of { pid, process, port, user } objects.
 * Filters out system processes and only shows developer-relevant apps.
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

        // Filter out system processes
        if (!isDevProcess(process)) continue;

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
