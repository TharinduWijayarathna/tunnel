const { exec } = require('child_process');

// ─── System processes to always hide (exact match, case-insensitive lookup) ───
// Covers macOS, Windows, and Linux system/desktop processes
const SYSTEM_PROCESSES = new Set([
  // ── macOS ──
  'ControlCe',
  'Raycast',
  'rapportd',
  'sharingd',
  'AirPlayXPC',
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

  // ── Windows core ──
  'svchost',
  'System',
  'services',
  'lsass',
  'csrss',
  'smss',
  'wininit',
  'winlogon',
  'dwm',
  'explorer',
  'taskhostw',
  'sihost',
  'fontdrvhost',
  'ctfmon',
  'conhost',
  'dllhost',
  'RuntimeBroker',
  'SearchHost',
  'SearchIndexer',
  'SearchUI',
  'ShellExperienceHost',
  'StartMenuExperienceHost',
  'TextInputHost',
  'SecurityHealthService',
  'SecurityHealthSystray',
  'MsMpEng',
  'NisSrv',
  'SgrmBroker',
  'spoolsv',
  'WmiPrvSE',
  'WUDFHost',
  'audiodg',
  'dasHost',
  'msdtc',
  'TiWorker',
  'TrustedInstaller',
  'wuauclt',
  'SearchProtocolHost',
  'SearchFilterHost',
  'backgroundTaskHost',
  'CompatTelRunner',
  'MusNotification',
  'usocoreworker',
  'LsaIso',
  'Registry',
  'Idle',
  'Memory Compression',
  'vmmem',
  'vmcompute',
  'vmwp',

  // ── Windows vendor / OEM utilities ──
  'asus_framework',
  'ArmouryCrateControlInterface',
  'ArmourySocketServer',
  'ArmouryCrate',
  'ArmouryCrate.Service',
  'ArmourySwAgent',
  'ASUS_Link',
  'AsusOptimization',
  'AsusCertService',
  'RazerCentral',
  'Razer Synapse',
  'RzSDKService',
  'RzSDKServer',
  'iCUE',
  'CorsairService',
  'CorsairGamingAudioCfgService',
  'NahimicService',
  'NahimicSvc64',
  'LGHUBUpdaterService',
  'LogiOverlay',
  'LogiOptionsMgr',

  // ── Remote desktop / screen sharing (not dev servers) ──
  'AnyDesk',
  'TeamViewer',
  'TeamViewer_Service',
  'RustDesk',
  'parsec',
  'Parsec',

  // ── Browsers (their listeners are internal, not dev) ──
  'chrome',
  'msedge',
  'firefox',
  'brave',
  'opera',
  'vivaldi',
  'arc',

  // ── IDE internals ──
  'Cursor',
  'Antigravi',
  'Code',
  'Code Helper',
  'Electron',
  'language_',
  'copilot-ag',
  'gopls',
  'typescript',
  'eslint_d',
  'biome',

  // ── Chat / productivity apps ──
  'Slack',
  'Discord',
  'Spotify',
  'zoom',
  'Figma',
  'Notion',
  'Postman',
  'Telegram',
  'WhatsApp',
  'Signal',
  'Teams',
  'Skype',
  'OneDrive',
  'Dropbox',
  'iCloudService',

  // ── Linux system ──
  'systemd',
  'systemd-resolved',
  'systemd-networkd',
  'systemd-logind',
  'systemd-timesyncd',
  'systemd-journald',
  'systemd-udevd',
  'dbus-daemon',
  'dbus-broker',
  'avahi-daemon',
  'NetworkManager',
  'wpa_supplicant',
  'ModemManager',
  'polkitd',
  'udisksd',
  'accounts-daemon',
  'colord',
  'rtkit-daemon',
  'snapd',
  'packagekitd',
  'fwupd',
  'thermald',
  'irqbalance',
  'cron',
  'atd',
  'cupsd',
  'cups-browsed',
  'gdm',
  'gdm-session-worker',
  'lightdm',
  'gnome-shell',
  'gnome-session-binary',
  'gsd-',
  'kwin_wayland',
  'kwin_x11',
  'plasmashell',
  'kded5',
  'Xorg',
  'Xwayland',
  'pulseaudio',
  'pipewire',
  'pipewire-pulse',
  'wireplumber',
  'sssd',
  'nscd',
  'rpcbind',
  'rpc.statd',
]);

// ── Process name patterns to exclude (regex-based) ──
const SYSTEM_PATTERNS = [
  // macOS
  /^com\./i, // com.apple.*, com.docker.*, etc.
  /^launchd/i,
  /^XPC/i,

  // Windows
  /^svchost/i, // svchost.exe and variants
  /^System$/i,
  /^PID:\d+$/i, // Unresolved PIDs (couldn't get name)
  /^Windows/i, // Windows system processes
  /^Microsoft\./i, // Microsoft services
  /^NVIDIA/i, // GPU drivers
  /^AMD/i, // GPU drivers
  /^Intel/i, // Intel services
  /^Realtek/i, // Audio/network drivers
  /^Dell/i, // Dell utilities
  /^HP/i, // HP utilities
  /^Lenovo/i, // Lenovo utilities
  /^Asus/i, // ASUS utilities
  /^Armoury/i, // ASUS Armoury Crate
  /^Razer/i, // Razer peripherals
  /^Corsair/i, // Corsair peripherals
  /^Logitech/i, // Logitech peripherals
  /^Nahimic/i, // Audio enhancer

  // Browsers & Electron helper processes
  /Helper$/i, // *Helper (Electron/Chrome)
  /^Google/i,
  /^Chromium/i,
  /^Firefox/i,
  /^Safari/i,
  /^Slack/i,
  /^Discord/i,
  /^Spotify/i,
  /^zoom/i,
  /^Figma/i,
  /^Notion/i,
  /^Postman/i,
  /^Teams/i,
  /^Skype/i,
  /^OneDrive/i,
  /^Dropbox/i,

  // Linux desktop / system
  /^gnome-/i,
  /^gsd-/i, // GNOME settings daemon
  /^gvfs/i, // GNOME virtual filesystem
  /^xdg-/i,
  /^dconf/i,
  /^ibus/i,
  /^fcitx/i,
  /^at-spi/i,
  /^tracker/i, // GNOME Tracker indexer
  /^evolution/i, // GNOME evolution
  /^kde/i,
  /^plasma/i,
  /^baloo/i, // KDE file indexer
  /^snap\./i, // Snap packages (system)
];

// ── Known developer-facing processes to always show ──
const DEV_PROCESSES = new Set([
  // Node.js ecosystem
  'node',
  'nodemon',
  'deno',
  'bun',
  'next-serv',
  'vite',
  'webpack',
  'esbuild',
  'turbo',
  'serve',
  'http-serv',
  'live-serv',
  'npm',
  'yarn',
  'pnpm',
  'npx',

  // PHP
  'php',
  'php84',
  'php83',
  'php82',
  'php81',
  'php80',
  'php74',
  'artisan',
  'mix',

  // Python
  'python',
  'python3',
  'python3.1',
  'python3.12',
  'python3.13',
  'uvicorn',
  'gunicorn',
  'flask',
  'django',
  'hypercorn',
  'daphne',

  // Ruby
  'ruby',
  'rails',
  'puma',
  'unicorn',

  // Java / JVM
  'java',
  'gradle',
  'mvn',
  'tomcat',
  'spring',
  'kotlin',
  'quarkus',

  // Go
  'go',
  'air',

  // Rust
  'cargo',
  'rustc',

  // .NET
  'dotnet',

  // Web servers
  'nginx',
  'httpd',
  'apache',
  'apache2',
  'caddy',
  'lighttpd',
  'traefik',

  // Containers
  'docker-pr',
  'docker',
  'podman',
  'containerd',

  // Databases
  'mysqld',
  'mysql',
  'postgres',
  'postgresql',
  'mongod',
  'mongos',
  'redis-ser',
  'redis-server',
  'memcached',
  'mariadbd',
  'mariadb',
  'sqlservr',
  'sqlserver',
  'SQLSERVR',
  'mssql',

  // Message queues
  'rabbitmq',
  'beam.smp',
  'kafka',

  // Other dev tools
  'wp',
  'drush',
  'composer',
  'hugo',
  'jekyll',
  'gatsby',
  'elixir',
  'mix',
  'beam',
  'erlang',
]);

/**
 * Determines if a process is a developer-facing app worth showing.
 * Uses a three-tier check: allow-list → deny-list → pattern deny-list.
 */
function isDevProcess(processName) {
  if (!processName || processName === '-') return false;

  // Normalize: strip .exe suffix on Windows
  const name = processName.replace(/\.exe$/i, '');

  // Always include known dev processes
  if (DEV_PROCESSES.has(name)) return true;

  // Always exclude known system processes (case-insensitive)
  if (SYSTEM_PROCESSES.has(name)) return false;

  // Also check lowercase for case-insensitive matching
  const lower = name.toLowerCase();
  for (const sys of SYSTEM_PROCESSES) {
    if (sys.toLowerCase() === lower) return false;
  }

  // Exclude by pattern
  for (const pattern of SYSTEM_PATTERNS) {
    if (pattern.test(name)) return false;
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

      const _pids = [...new Set(results.map((r) => r.pid))].join(',');
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
