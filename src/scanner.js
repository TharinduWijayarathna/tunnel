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
 * Scans for listening ports using lsof (macOS/Linux).
 */
function scanWithLsof(excludePorts) {
  return new Promise((resolve) => {
    exec('lsof -iTCP -sTCP:LISTEN -P -n', (error, stdout) => {
      if (error || !stdout) return resolve([]);

      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return resolve([]);

      const entries = lines.slice(1);
      const portMap = new Map();

      for (const line of entries) {
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;

        const process = parts[0];
        const pid = parseInt(parts[1], 10);
        const user = parts[2];
        const nameField = parts[8];

        const portMatch = nameField.match(/:(\d+)$/);
        if (!portMatch) continue;

        const port = parseInt(portMatch[1], 10);
        if (excludePorts.includes(port)) continue;
        if (!isDevProcess(process)) continue;

        if (!portMap.has(port)) {
          portMap.set(port, { pid, process, port, user });
        }
      }

      resolve(Array.from(portMap.values()).sort((a, b) => a.port - b.port));
    });
  });
}

/**
 * Scans for listening ports using netstat (Windows).
 */
function scanWithNetstat(excludePorts) {
  return new Promise((resolve) => {
    exec('netstat -ano -p TCP', (error, stdout) => {
      if (error || !stdout) return resolve([]);

      const lines = stdout.trim().split('\n');
      const portMap = new Map();

      for (const line of lines) {
        if (!line.includes('LISTENING')) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;

        const localAddr = parts[1];
        const pid = parseInt(parts[4], 10);

        const portMatch = localAddr.match(/:(\d+)$/);
        if (!portMatch) continue;

        const port = parseInt(portMatch[1], 10);
        if (excludePorts.includes(port)) continue;

        if (!portMap.has(port)) {
          portMap.set(port, { pid, process: `PID:${pid}`, port, user: '-' });
        }
      }

      // Try to resolve process names for the PIDs
      const results = Array.from(portMap.values());
      if (results.length === 0) return resolve([]);

      const pids = [...new Set(results.map((r) => r.pid))].join(',');
      exec(`tasklist /FI "PID eq ${results[0].pid}" /FO CSV /NH`, () => {
        // Batch resolve via wmic (more reliable)
        exec('wmic process get processid,name /format:csv', (err2, stdout2) => {
          if (!err2 && stdout2) {
            const pidToName = {};
            for (const row of stdout2.trim().split('\n')) {
              const cols = row.trim().split(',');
              if (cols.length >= 3) {
                const name = cols[1];
                const rowPid = parseInt(cols[2], 10);
                if (name && rowPid) pidToName[rowPid] = name.replace(/\.exe$/i, '');
              }
            }

            results.forEach((r) => {
              if (pidToName[r.pid]) {
                r.process = pidToName[r.pid];
              }
            });
          }

          // Filter after name resolution
          const filtered = results.filter((r) => isDevProcess(r.process));
          resolve(filtered.sort((a, b) => a.port - b.port));
        });
      });
    });
  });
}

/**
 * Scans for all listening TCP ports on the machine.
 * Uses lsof on macOS/Linux and netstat on Windows.
 * Returns an array of { pid, process, port, user } objects.
 * Filters out system processes and only shows developer-relevant apps.
 */
function scanListeningPorts(excludePorts = []) {
  if (process.platform === 'win32') {
    return scanWithNetstat(excludePorts);
  }
  return scanWithLsof(excludePorts);
}

module.exports = { scanListeningPorts };

