/* ============================================
   Tunnel — Frontend Application
   ============================================ */

(() => {
  'use strict';

  // ---------- State ----------
  let primaryIP = '';
  let tunnels = [];
  let ports = [];
  let openEditPort = null; // which port has its edit row open

  // ---------- DOM References ----------
  const $ = (sel) => document.querySelector(sel);

  const dom = {
    networkInfo: $('#networkInfo'),
    tunnelsGrid: $('#tunnelsGrid'),
    tunnelCount: $('#tunnelCount'),
    emptyState: $('#emptyState'),
    qrModal: $('#qrModal'),
    modalClose: $('#modalClose'),
    qrContainer: $('#qrContainer'),
    modalUrl: $('#modalUrl'),
    toastContainer: $('#toastContainer'),
    portsList: $('#portsList'),
    btnRefreshPorts: $('#btnRefreshPorts'),
  };

  // ---------- SVG Icons ----------
  const icons = {
    arrow: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  };

  // ---------- API Helpers ----------
  async function api(method, path, body) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(path, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  const apiGet = (path) => api('GET', path);
  const apiPost = (path, body) => api('POST', path, body);
  const apiDelete = (path) => api('DELETE', path);

  // ---------- Toast Notifications ----------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const toastIcons = { success: '✓', error: '✕', info: '·' };
    toast.innerHTML = `
      <span class="toast-icon">${toastIcons[type] || '·'}</span>
      <span>${escapeHtml(message)}</span>
    `;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.22s ease forwards';
      setTimeout(() => toast.remove(), 220);
    }, 2800);
  }

  // ---------- Network Info ----------
  async function fetchInterfaces() {
    try {
      const data = await apiGet('/api/interfaces');
      primaryIP = data.primaryIP || '';
      renderNetworkInfo(data.interfaces || [], data.primaryIP);
    } catch (err) {
      console.error('Failed to fetch interfaces:', err);
      dom.networkInfo.innerHTML = `<div class="network-chip"><span class="ip">Network unavailable</span></div>`;
    }
  }

  function renderNetworkInfo(interfaces, primary) {
    if (!interfaces.length) {
      dom.networkInfo.innerHTML = `<div class="network-chip"><span class="ip">No network detected</span></div>`;
      return;
    }

    const badges = interfaces
      .filter((iface) => iface.ip && iface.ip !== '127.0.0.1')
      .map((iface) => {
        const isPrimary = iface.ip === primary;
        return `
          <div class="network-chip" title="${iface.name} (${iface.type || 'unknown'})">
            ${isPrimary ? '<span class="dot"></span>' : ''}
            <span class="ip">${iface.ip}</span>
          </div>
        `;
      })
      .join('');

    dom.networkInfo.innerHTML = badges || `<div class="network-chip"><span class="ip">No external IPs</span></div>`;
  }

  // ---------- Port Scanner ----------
  async function fetchPorts() {
    try {
      const data = await apiGet('/api/ports');
      ports = data.ports || [];
      renderPorts();
    } catch (err) {
      console.error('Failed to fetch ports:', err);
      dom.portsList.innerHTML = '<div class="ports-empty">Failed to scan ports</div>';
    }
  }

  function renderPorts() {
    if (!ports.length) {
      dom.portsList.innerHTML = '<div class="ports-empty">No listening applications detected</div>';
      return;
    }

    dom.portsList.innerHTML = ports.map((p) => portRowHTML(p) + portEditRowHTML(p)).join('');
    bindPortActions();
  }

  function portRowHTML(port) {
    let actionHTML;
    if (port.tunneled) {
      actionHTML = `<span class="port-tunneled-badge">${icons.check} Tunneled</span>`;
    } else {
      actionHTML = `
        <div class="port-actions">
          <button class="btn-port-edit" id="edit-btn-${port.port}" title="Configure before exposing">${icons.edit}</button>
          <button class="btn-expose" id="expose-${port.port}">Expose ${icons.arrow}</button>
        </div>
      `;
    }

    return `
      <div class="port-row" id="port-row-${port.port}">
        <span class="port-dot"></span>
        <span class="port-process">${escapeHtml(port.process)}</span>
        <span class="port-number">:${port.port}</span>
        <span class="port-user">${escapeHtml(port.user)}</span>
        <span class="port-pid">PID ${port.pid}</span>
        ${actionHTML}
      </div>
    `;
  }

  function portEditRowHTML(port) {
    if (port.tunneled) return '';
    const isOpen = openEditPort === port.port;
    return `
      <div class="port-edit-row ${isOpen ? 'visible' : ''}" id="edit-row-${port.port}">
        <label>Exposed port</label>
        <input type="number" id="edit-exposed-${port.port}" value="${port.port}" min="1" max="65535">
        <div class="toggle-mini">
          <label class="toggle-switch-sm" for="edit-internet-${port.port}">
            <input type="checkbox" id="edit-internet-${port.port}">
            <span class="toggle-slider-sm"></span>
          </label>
          <span class="toggle-mini-label">Public</span>
        </div>
        <button class="btn-expose-confirm" id="edit-confirm-${port.port}">Expose ${icons.arrow}</button>
      </div>
    `;
  }

  function bindPortActions() {
    ports.forEach((p) => {
      if (p.tunneled) return;

      const exposeBtn = $(`#expose-${p.port}`);
      const editBtn = $(`#edit-btn-${p.port}`);
      const confirmBtn = $(`#edit-confirm-${p.port}`);

      // Direct expose — same port, no internet
      if (exposeBtn) {
        exposeBtn.addEventListener('click', () => quickExpose(p.port));
      }

      // Toggle edit row
      if (editBtn) {
        editBtn.addEventListener('click', () => toggleEditRow(p.port));
      }

      // Confirm from edit row
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          const exposedPort = parseInt($(`#edit-exposed-${p.port}`)?.value, 10) || p.port;
          const internet = $(`#edit-internet-${p.port}`)?.checked || false;
          createTunnel(p.port, exposedPort, internet);
        });
      }
    });
  }

  function toggleEditRow(port) {
    const row = $(`#edit-row-${port}`);
    const btn = $(`#edit-btn-${port}`);
    if (!row) return;

    // Close any other open edit row
    if (openEditPort && openEditPort !== port) {
      const prevRow = $(`#edit-row-${openEditPort}`);
      const prevBtn = $(`#edit-btn-${openEditPort}`);
      if (prevRow) prevRow.classList.remove('visible');
      if (prevBtn) prevBtn.classList.remove('active');
    }

    const isOpen = row.classList.contains('visible');
    row.classList.toggle('visible');
    if (btn) btn.classList.toggle('active');
    openEditPort = isOpen ? null : port;
  }

  async function quickExpose(port) {
    const btn = $(`#expose-${port}`);
    if (btn) { btn.disabled = true; btn.innerHTML = 'Creating...'; }

    await createTunnel(port, port, false);
  }

  async function createTunnel(localPort, exposedPort, exposeToInternet) {
    try {
      const data = await apiPost('/api/tunnels', { localPort, exposedPort, exposeToInternet });
      const msg = data.tunnel.publicUrl
        ? `Tunnel live! Public: ${data.tunnel.publicUrl}`
        : `Tunnel created — port ${localPort} → ${exposedPort}`;
      showToast(msg, 'success');

      openEditPort = null;
      await Promise.all([fetchTunnels(), fetchPorts()]);
    } catch (err) {
      showToast(err.message || 'Failed to create tunnel', 'error');
      // Re-render to reset button states
      renderPorts();
    }
  }

  async function refreshPorts() {
    dom.btnRefreshPorts.classList.add('spinning');
    await fetchPorts();
    setTimeout(() => dom.btnRefreshPorts.classList.remove('spinning'), 600);
  }

  // ---------- Tunnel Rendering ----------
  function renderTunnels() {
    const count = tunnels.length;
    dom.tunnelCount.textContent = count;

    if (count === 0) {
      dom.tunnelsGrid.innerHTML = '';
      dom.emptyState.classList.add('visible');
      return;
    }

    dom.emptyState.classList.remove('visible');

    dom.tunnelsGrid.innerHTML = tunnels
      .map((t, i) => tunnelCardHTML(t, i))
      .join('');

    tunnels.forEach((t) => {
      const copyBtn = $(`#copy-${t.id}`);
      const qrBtn = $(`#qr-${t.id}`);
      const deleteBtn = $(`#delete-${t.id}`);
      const internetBtn = $(`#internet-${t.id}`);

      if (copyBtn) copyBtn.addEventListener('click', () => copyUrl(t, t.publicUrl ? 'public' : 'local'));
      if (qrBtn) qrBtn.addEventListener('click', () => showQR(t.id));
      if (deleteBtn) deleteBtn.addEventListener('click', () => deleteTunnel(t.id));
      if (internetBtn) internetBtn.addEventListener('click', () => toggleInternet(t.id, !t.internetActive));
    });
  }

  function tunnelCardHTML(tunnel, index) {
    const localUrl = `http://${primaryIP}:${tunnel.exposedPort}`;
    const statusClass = tunnel._status || 'checking';
    const statusText = statusClass === 'online' ? 'Active' : (statusClass === 'offline' ? 'Offline' : 'Checking');

    const internetBadge = tunnel.publicUrl
      ? `<span class="internet-badge">Public URL</span>`
      : '';

    const internetBtnLabel = tunnel.internetActive ? 'Stop Public' : 'Go Public';
    const displayUrl = tunnel.publicUrl || localUrl;

    return `
      <div class="tunnel-card" id="tunnel-${tunnel.id}" style="animation-delay: ${index * 0.08}s">
        <div class="tunnel-card-header">
          <div>
            <div class="tunnel-port-display">${tunnel.localPort} <span class="port-arrow">→</span> ${tunnel.exposedPort}</div>
            ${internetBadge}
          </div>
          <span class="tunnel-status-badge ${statusClass}" id="status-badge-${tunnel.id}">
            <span class="badge-dot"></span> <span class="status-text">${statusText}</span>
          </span>
        </div>
        <div class="tunnel-url-row">
          <span class="tunnel-url" id="url-${tunnel.id}">${displayUrl}</span>
        </div>
        <div class="tunnel-actions">
          <button class="btn-action copy" id="copy-${tunnel.id}">Copy URL</button>
          <button class="btn-action internet" id="internet-${tunnel.id}">${internetBtnLabel}</button>
          <button class="btn-action qr" id="qr-${tunnel.id}">QR Code</button>
          <button class="btn-action stop" id="delete-${tunnel.id}">Stop</button>
        </div>
      </div>
    `;
  }

  // ---------- Fetch Tunnels ----------
  async function fetchTunnels() {
    try {
      const data = await apiGet('/api/tunnels');
      const statusMap = {};
      tunnels.forEach((t) => { statusMap[t.id] = t._status; });

      tunnels = (data.tunnels || []).map((t) => ({
        ...t,
        _status: statusMap[t.id] || 'checking',
      }));
      renderTunnels();
    } catch (err) {
      console.error('Failed to fetch tunnels:', err);
      showToast('Failed to load tunnels', 'error');
    }
  }

  // ---------- Toggle Internet ----------
  async function toggleInternet(id, enable) {
    const btn = $(`#internet-${id}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Wait...'; }

    try {
      const data = await apiPost(`/api/tunnels/${id}/internet`, { enable });
      showToast(data.publicUrl ? 'Public URL ready' : 'Internet tunnel stopped', data.publicUrl ? 'success' : 'info');
      await fetchTunnels();
    } catch (err) {
      showToast(err.message || 'Failed to toggle internet', 'error');
      if (btn) { btn.disabled = false; btn.textContent = enable ? 'Go Public' : 'Stop Public'; }
    }
  }

  // ---------- Delete Tunnel ----------
  async function deleteTunnel(id) {
    const el = $(`#tunnel-${id}`);
    if (el) el.style.animation = 'card-in 0.15s ease reverse forwards';

    try {
      await apiDelete(`/api/tunnels/${id}`);
      showToast('Tunnel stopped', 'info');
      setTimeout(async () => {
        await Promise.all([fetchTunnels(), fetchPorts()]);
      }, 150);
    } catch (err) {
      if (el) el.style.animation = '';
      showToast(err.message || 'Failed to stop tunnel', 'error');
    }
  }

  // ---------- Copy URL ----------
  async function copyUrl(tunnel, type = 'local') {
    const url = type === 'public' && tunnel.publicUrl
      ? tunnel.publicUrl
      : `http://${primaryIP}:${tunnel.exposedPort}`;

    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copied', 'success');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('URL copied', 'success');
    }
  }

  // ---------- QR Modal ----------
  async function showQR(tunnelId) {
    dom.qrContainer.innerHTML = 'Loading...';
    dom.modalUrl.textContent = '';
    dom.qrModal.classList.add('visible');

    try {
      const tunnel = tunnels.find((t) => t.id === tunnelId);
      const type = tunnel && tunnel.publicUrl ? 'public' : 'local';
      const data = await apiGet(`/api/tunnels/${tunnelId}/qr?type=${type}`);
      dom.qrContainer.innerHTML = data.qr || '<p>QR unavailable</p>';
      dom.modalUrl.textContent = data.url || '';
    } catch (err) {
      dom.qrContainer.innerHTML = '<p style="color:var(--red)">Failed to load QR</p>';
      showToast('Failed to load QR code', 'error');
    }
  }

  function closeModal() {
    dom.qrModal.classList.remove('visible');
    setTimeout(() => { dom.qrContainer.innerHTML = ''; dom.modalUrl.textContent = ''; }, 200);
  }

  // ---------- Status Polling ----------
  async function pollStatuses() {
    if (!tunnels.length) return;

    const updates = await Promise.allSettled(
      tunnels.map(async (t) => {
        const data = await apiGet(`/api/tunnels/${t.id}/status`);
        return { id: t.id, status: data.status };
      })
    );

    updates.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const { id, status } = result.value;
      const tunnel = tunnels.find((t) => t.id === id);
      if (tunnel && tunnel._status !== status) {
        tunnel._status = status;
        const badge = $(`#status-badge-${id}`);
        const text = badge?.querySelector('.status-text');
        if (badge) badge.className = `tunnel-status-badge ${status}`;
        if (text) text.textContent = status === 'online' ? 'Active' : (status === 'offline' ? 'Offline' : 'Checking');
      }
    });
  }

  // ---------- Stats Polling ----------
  async function pollStats() {
    if (!tunnels.length) return;
    try {
      const data = await apiGet('/api/tunnels');
      const fresh = data.tunnels || [];
      let needsRerender = false;

      fresh.forEach((ft) => {
        const existing = tunnels.find((t) => t.id === ft.id);
        if (existing) {
          existing.totalRequests = ft.totalRequests;
          existing.activeConnections = ft.activeConnections;
          if (existing.internetActive !== ft.internetActive || existing.publicUrl !== ft.publicUrl) {
            existing.internetActive = ft.internetActive;
            existing.publicUrl = ft.publicUrl;
            needsRerender = true;
          }
        }
      });

      if (fresh.length !== tunnels.length || needsRerender) {
        tunnels = fresh.map((ft) => ({
          ...ft,
          _status: tunnels.find((t) => t.id === ft.id)?._status || 'checking',
        }));
        renderTunnels();
      }
    } catch (err) {
      console.error('Stats poll error:', err);
    }
  }

  // ---------- Utility ----------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---------- Event Bindings ----------
  function bindEvents() {
    dom.modalClose.addEventListener('click', closeModal);
    dom.qrModal.addEventListener('click', (e) => { if (e.target === dom.qrModal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.qrModal.classList.contains('visible')) closeModal();
    });
    dom.btnRefreshPorts.addEventListener('click', refreshPorts);
  }

  // ---------- Initialize ----------
  async function init() {
    bindEvents();
    await Promise.all([fetchInterfaces(), fetchTunnels(), fetchPorts()]);
    setInterval(pollStatuses, 3000);
    setInterval(pollStats, 5000);
    pollStatuses();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
