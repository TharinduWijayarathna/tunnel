<p align="center">
  <img src="build/icon.png" width="120" height="120" alt="Tunnel" style="border-radius: 20px;">
</p>

<h1 align="center">Tunnel</h1>

<p align="center">
  Expose your localhost to your network or the internet — in one click.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/version-1.0.0-green" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License">
</p>

---

## What is Tunnel?

Tunnel is a desktop app that detects your running local applications and lets you expose them to your Wi-Fi network or the public internet instantly. No config files, no CLI flags — just click **Expose**.

## Features

- **Auto-detect running apps** — scans your machine for listening ports and shows them in a list
- **One-click expose** — click "Expose" to make any local app accessible across your network
- **Public URLs** — toggle internet exposure to get a secure `https` URL anyone can access
- **QR codes** — scan from your phone to open the tunneled app instantly
- **Cross-platform** — works on macOS, Windows, and Linux

## Quick Start

```bash
git clone https://github.com/TharinduWijayarathna/tunnel.git
cd tunnel
npm install
```

**Run as a desktop app:**

```bash
npm run electron:dev
```

**Run as a CLI server (no window):**

```bash
npm start
```

Then open [http://localhost:4040](http://localhost:4040).

## Build

Build a distributable for your platform:

```bash
# macOS (.dmg)
npm run electron:build:mac

# Windows (.exe installer)
npm run electron:build:win

# Linux (AppImage + .deb)
npm run electron:build:linux
```

Output goes to the `dist/` folder.

## How It Works

1. Tunnel scans for listening TCP ports on your machine
2. You pick an app and click **Expose**
3. A reverse proxy maps the port to your local network IP
4. Optionally toggle **Public** to generate an internet-accessible URL

## Tech Stack

- **App**: Electron
- **Backend**: Node.js, Express, http-proxy, localtunnel
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Font**: Inter

## License

MIT
