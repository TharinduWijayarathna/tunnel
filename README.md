# Tunnel 🚇

A beautiful and simple local network exposure tool built with Node.js and Express. Tunnel allows you to instantly map your localhost applications to your local network (Wi-Fi) or the public internet with a single click.

## Features

- **Local Network Proxy:** Map any local port to a new port on your machine accessible across your Wi-Fi network.
- **Public Internet Exposure:** Toggle public internet exposure (powered by Localtunnel) to get a secure `https` URL instantly.
- **QR Code Generation:** Easily scan QR codes from your mobile devices to access your tunnels instantly.
- **Real-Time Monitoring:** Beautiful dashboard to manage active tunnels, view connection counts, and total requests.
- **Modern UI:** Built with Vanilla HTML/CSS/JS with a clean, responsive layout.

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/TharinduWijayarathna/tunnel.git
   cd tunnel
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open the dashboard at [http://localhost:4040](http://localhost:4040).

## Usage

1. Open the dashboard.
2. Enter your local application's running port (e.g., `8000`).
3. Toggle **Expose to internet** if you need a public URL.
4. Click **Create tunnel**. Your application is now accessible via the generated network IP or public URL!

## Tech Stack

- **Backend:** Node.js, Express, http-proxy, localtunnel, qrcode
- **Frontend:** Vanilla HTML, CSS, JavaScript (Geist Font)
