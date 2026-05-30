const createApp = require('./src/server');
const { getNetworkInterfaces, getPrimaryIP } = require('./src/network');

const DASHBOARD_PORT = 4040;

async function main() {
  const { app, tunnelManager } = createApp();

  app.listen(DASHBOARD_PORT, '0.0.0.0', () => {
    const primaryIP = getPrimaryIP();
    const interfaces = getNetworkInterfaces();

    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║                                                  ║');
    console.log('  ║        🚇  T U N N E L   is running             ║');
    console.log('  ║                                                  ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Dashboard:  http://localhost:${DASHBOARD_PORT}`);
    console.log(`              http://${primaryIP}:${DASHBOARD_PORT}`);
    console.log('');

    if (interfaces.length > 0) {
      console.log('  Network Interfaces:');
      interfaces.forEach((iface) => {
        console.log(`    • ${iface.type.padEnd(10)} ${iface.ip}  (${iface.name})`);
      });
    } else {
      console.log('  ⚠ No network interfaces detected.');
      console.log('    Tunnels will only be accessible on localhost.');
    }

    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n  Received ${signal}. Shutting down...`);
    await tunnelManager.destroyAll();
    console.log('  All tunnels closed. Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start Tunnel:', err);
  process.exit(1);
});
