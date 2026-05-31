const os = require('os');

/**
 * Detect all non-internal IPv4 network interfaces.
 * Returns an array of { name, ip, type, mac } objects.
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const lname = name.toLowerCase();
        let type = 'Other';

        if (
          lname.includes('wi-fi') ||
          lname.includes('wifi') ||
          lname.includes('wlan') ||
          lname === 'en0'
        ) {
          type = 'WiFi';
        } else if (
          lname.includes('eth') ||
          lname === 'en1' ||
          lname.startsWith('enp') ||
          lname.startsWith('eno')
        ) {
          type = 'Ethernet';
        } else if (lname.includes('bridge') || lname.includes('docker') || lname.includes('veth')) {
          type = 'Virtual';
        } else if (lname.includes('utun') || lname.includes('tun') || lname.includes('vpn')) {
          type = 'VPN';
        }

        results.push({
          name,
          ip: addr.address,
          type,
          mac: addr.mac,
        });
      }
    }
  }

  return results;
}

/**
 * Get the primary (first non-internal) IPv4 address.
 */
function getPrimaryIP() {
  const interfaces = getNetworkInterfaces();
  // Prefer WiFi, then Ethernet, then anything
  const wifi = interfaces.find((i) => i.type === 'WiFi');
  if (wifi) return wifi.ip;
  const eth = interfaces.find((i) => i.type === 'Ethernet');
  if (eth) return eth.ip;
  return interfaces.length > 0 ? interfaces[0].ip : '127.0.0.1';
}

module.exports = { getNetworkInterfaces, getPrimaryIP };
