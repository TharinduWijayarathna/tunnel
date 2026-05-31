/* ============================================
   Tunnel — Desktop Application Frontend
   ============================================ */
(() => {
  'use strict';

  // ── State ──
  let primaryIP = '';
  let tunnels = [];
  let ports = [];
  let openEditPort = null;
  let currentView = 'dashboard';

  // ── Platform ──
  const platform = (window.tunnelApp && window.tunnelApp.platform) || (() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'darwin';
    if (ua.includes('win')) return 'win32';
    return 'linux';
  })();
  const platformLabel = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux';

  // ── DOM ──
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const dom = {
    networkInfo: $('#networkInfo'),
    portsList: $('#portsList'),
    portsEmpty: $('#portsEmpty'),
    portCountBadge: $('#portCountBadge'),
    tunnelsPanel: $('#tunnelsPanel'),
    tunnelsPanelAlt: $('#tunnelsPanelAlt'),
    tunnelCount: $('#tunnelCount'),
    tunnelCountAlt: $('#tunnelCountAlt'),
    emptyState: $('#emptyState'),
    emptyStateAlt: $('#emptyStateAlt'),
    qrModal: $('#qrModal'),
    modalClose: $('#modalClose'),
    qrContainer: $('#qrContainer'),
    modalUrl: $('#modalUrl'),
    toastContainer: $('#toastContainer'),
    btnRefreshPorts: $('#btnRefreshPorts'),
    statusPlatform: $('#statusPlatform'),
    statusIP: $('#statusIP'),
    activeTunnelCount: $('#activeTunnelCount'),
    footerPlatform: $('#footerPlatform'),
    metricTunnels: $('#metricTunnels'),
    metricTunnelsSub: $('#metricTunnelsSub'),
    metricPorts: $('#metricPorts'),
    metricPortsSub: $('#metricPortsSub'),
    metricRequests: $('#metricRequests'),
    metricRequestsSub: $('#metricRequestsSub'),
  };

  // ── SVG Icons ──
  const icons = {
    arrow: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    edit: '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M7 2l4 4-7 7H0V9l7-7z"/></svg>',
    copy: '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="4" y="4" width="8" height="8" rx="1.2"/><path d="M9 4V2.5A1.5 1.5 0 0 0 7.5 1H2.5A1.5 1.5 0 0 0 1 2.5v5A1.5 1.5 0 0 0 2.5 9H4"/></svg>',
    qr: '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="4" height="4" rx=".5"/><rect x="8" y="1" width="4" height="4" rx=".5"/><rect x="1" y="8" width="4" height="4" rx=".5"/><path d="M8 8h4v4"/></svg>',
    globe: '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/><path d="M8 1h4v4M7 6l5-5"/></svg>',
    stop: '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 2l9 9M11 2l-9 9"/></svg>',
  };

  // ── API ──
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || `Failed (${res.status})`); }
    return res.json();
  }
  const apiGet = (p) => api('GET', p);
  const apiPost = (p, b) => api('POST', p, b);
  const apiDelete = (p) => api('DELETE', p);

  // ── Toast ──
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const ic = { success: '✓', error: '✕', info: '·' };
    t.innerHTML = `<span class="toast-icon">${ic[type]||'·'}</span><span>${esc(msg)}</span>`;
    dom.toastContainer.appendChild(t);
    setTimeout(() => { t.style.animation = 'toastOut 0.22s ease forwards'; setTimeout(() => t.remove(), 220); }, 2800);
  }

  // ── Theme ──
  function initTheme() {
    const saved = localStorage.getItem('tunnel-theme') || 'dark';
    if (saved === 'system') {
      applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      applyTheme(saved);
    }

    // Settings switcher
    const switcher = $('#themeSwitcherSettings');
    if (switcher) {
      switcher.querySelectorAll('.theme-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.dataset.theme;
          if (theme === 'system') {
            applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          } else {
            applyTheme(theme);
          }
          localStorage.setItem('tunnel-theme', theme);
          switcher.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
      switcher.querySelectorAll('.theme-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === saved);
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ── Navigation ──
  function initNav() {
    $$('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        switchView(view);
      });
    });
  }

  function switchView(view) {
    currentView = view;
    $$('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.style.display = 'none');
    const el = $(`#view${view.charAt(0).toUpperCase() + view.slice(1)}`);
    if (el) el.style.display = '';
  }

  // ── Network ──
  async function fetchInterfaces() {
    try {
      const data = await apiGet('/api/interfaces');
      primaryIP = data.primaryIP || '';
      dom.statusIP.textContent = primaryIP || 'Offline';
      renderNetworkPills(data.interfaces || [], data.primaryIP);
    } catch {
      dom.networkInfo.innerHTML = `<div class="ip-pill"><span class="ip-dot" style="background:var(--red)"></span>Offline</div>`;
      dom.statusIP.textContent = 'Offline';
    }
  }

  function renderNetworkPills(interfaces, primary) {
    const ext = interfaces.filter(i => i.ip && i.ip !== '127.0.0.1');
    if (!ext.length) { dom.networkInfo.innerHTML = ''; return; }
    dom.networkInfo.innerHTML = ext.map(i => {
      const isPrimary = i.ip === primary;
      return `<div class="ip-pill" title="${i.name}">${isPrimary ? '<span class="ip-dot"></span>' : ''}${i.ip}</div>`;
    }).join('');
  }

  // ── Ports ──
  async function fetchPorts() {
    try {
      const data = await apiGet('/api/ports');
      ports = data.ports || [];
      renderPorts();
      updateMetrics();
    } catch {
      dom.portsList.innerHTML = '<div class="empty-state"><div class="empty-title">Failed to scan ports</div></div>';
    }
  }

  function renderPorts() {
    dom.portCountBadge.textContent = ports.length;
    if (!ports.length) {
      dom.portsList.innerHTML = '<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="2" width="14" height="12" rx="2"/><path d="M5 7h6M5 10h3"/></svg></div><div class="empty-title">No applications detected</div><div class="empty-sub">Start a dev server and refresh</div></div>';
      return;
    }
    dom.portsList.innerHTML = ports.map(p => portRowHTML(p) + editRowHTML(p)).join('');
    bindPortActions();
  }

  function portRowHTML(p) {
    const initial = p.process.charAt(0).toUpperCase();
    const action = p.tunneled
      ? `<span class="tunneled-badge">${icons.check} Tunneled</span>`
      : `<button class="edit-btn" id="edit-btn-${p.port}" title="Configure">${icons.edit}</button><button class="expose-btn" id="expose-${p.port}">Expose</button>`;
    return `<div class="app-row"><div class="app-icon">${initial}</div><div class="app-info"><div class="app-name">${esc(p.process)}</div><div class="app-meta">PID ${p.pid} · ${esc(p.user)}</div></div><span class="app-port">:${p.port}</span>${action}</div>`;
  }

  function editRowHTML(p) {
    if (p.tunneled) return '';
    const open = openEditPort === p.port;
    return `<div class="edit-row ${open ? 'visible' : ''}" id="edit-row-${p.port}"><label>Port</label><input type="number" id="edit-exposed-${p.port}" value="${p.port}" min="1" max="65535"><div class="toggle-mini"><label class="toggle-switch-sm" for="edit-internet-${p.port}"><input type="checkbox" id="edit-internet-${p.port}"><span class="toggle-slider-sm"></span></label><span class="toggle-mini-label">Public</span></div><button class="edit-confirm" id="edit-confirm-${p.port}">Expose ${icons.arrow}</button></div>`;
  }

  function bindPortActions() {
    ports.forEach(p => {
      if (p.tunneled) return;
      $(`#expose-${p.port}`)?.addEventListener('click', () => quickExpose(p.port));
      $(`#edit-btn-${p.port}`)?.addEventListener('click', () => toggleEdit(p.port));
      $(`#edit-confirm-${p.port}`)?.addEventListener('click', () => {
        const ep = parseInt($(`#edit-exposed-${p.port}`)?.value, 10) || p.port;
        const pub = $(`#edit-internet-${p.port}`)?.checked || false;
        createTunnel(p.port, ep, pub);
      });
    });
  }

  function toggleEdit(port) {
    if (openEditPort && openEditPort !== port) {
      $(`#edit-row-${openEditPort}`)?.classList.remove('visible');
      $(`#edit-btn-${openEditPort}`)?.classList.remove('active');
    }
    const row = $(`#edit-row-${port}`);
    const btn = $(`#edit-btn-${port}`);
    const isOpen = row?.classList.contains('visible');
    row?.classList.toggle('visible');
    btn?.classList.toggle('active');
    openEditPort = isOpen ? null : port;
  }

  async function quickExpose(port) {
    const btn = $(`#expose-${port}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    await createTunnel(port, port, false);
  }

  async function createTunnel(lp, ep, pub) {
    try {
      const data = await apiPost('/api/tunnels', { localPort: lp, exposedPort: ep, exposeToInternet: pub });
      showToast(data.tunnel.publicUrl ? `Public: ${data.tunnel.publicUrl}` : `Tunnel ${lp} → ${ep} created`, 'success');
      openEditPort = null;
      await Promise.all([fetchTunnels(), fetchPorts()]);
    } catch (err) {
      showToast(err.message || 'Failed to create tunnel', 'error');
      renderPorts();
    }
  }

  async function refreshPorts() {
    dom.btnRefreshPorts.classList.add('spinning');
    await fetchPorts();
    setTimeout(() => dom.btnRefreshPorts.classList.remove('spinning'), 600);
  }

  // ── Tunnels ──
  function renderTunnels() {
    const count = tunnels.length;
    dom.tunnelCount.textContent = count;
    dom.tunnelCountAlt.textContent = count;
    dom.activeTunnelCount.textContent = `${count} active`;
    updateMetrics();

    const renderInto = (panel, empty) => {
      if (!count) { panel.innerHTML = ''; panel.appendChild(empty); empty.style.display = ''; return; }
      empty.style.display = 'none';
      const rows = tunnels.map(t => tunnelRowHTML(t)).join('');
      panel.innerHTML = rows;
      bindTunnelActions(panel);
    };

    renderInto(dom.tunnelsPanel, dom.emptyState);
    renderInto(dom.tunnelsPanelAlt, dom.emptyStateAlt);
  }

  function tunnelRowHTML(t) {
    const sc = t._status || 'checking';
    const dotClass = sc === 'online' ? 'green' : sc === 'offline' ? 'red' : 'amber';
    const url = t.publicUrl || `http://${primaryIP}:${t.exposedPort}`;
    const internetPill = t.publicUrl ? '<span class="internet-pill">Public</span>' : '';
    const internetLabel = t.internetActive ? 'Stop Public' : 'Go Public';

    return `<div class="tunnel-row" id="tunnel-${t.id}"><div class="tunnel-status-dot ${dotClass}"></div><div class="tunnel-info"><div class="tunnel-name">${t.localPort} <span style="color:var(--text-2);font-size:11px">→</span> ${t.exposedPort}${internetPill}</div><div class="tunnel-url">${url}</div></div><div class="tunnel-actions"><button class="icon-btn" data-action="copy" data-id="${t.id}" title="Copy URL">${icons.copy}</button><button class="icon-btn" data-action="internet" data-id="${t.id}" title="${internetLabel}">${icons.globe}</button><button class="icon-btn" data-action="qr" data-id="${t.id}" title="QR Code">${icons.qr}</button><button class="icon-btn danger" data-action="delete" data-id="${t.id}" title="Stop">${icons.stop}</button></div></div>`;
  }

  function bindTunnelActions(container) {
    container.querySelectorAll('.icon-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const t = tunnels.find(x => x.id === id);
        if (!t) return;
        if (action === 'copy') copyUrl(t);
        if (action === 'qr') showQR(id);
        if (action === 'delete') deleteTunnel(id);
        if (action === 'internet') toggleInternet(id, !t.internetActive);
      });
    });
  }

  async function fetchTunnels() {
    try {
      const data = await apiGet('/api/tunnels');
      const sm = {};
      tunnels.forEach(t => { sm[t.id] = t._status; });
      tunnels = (data.tunnels || []).map(t => ({ ...t, _status: sm[t.id] || 'checking' }));
      renderTunnels();
    } catch { showToast('Failed to load tunnels', 'error'); }
  }

  async function toggleInternet(id, enable) {
    try {
      const data = await apiPost(`/api/tunnels/${id}/internet`, { enable });
      showToast(data.publicUrl ? 'Public URL ready' : 'Public stopped', data.publicUrl ? 'success' : 'info');
      await fetchTunnels();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteTunnel(id) {
    const el = $(`#tunnel-${id}`);
    if (el) el.style.opacity = '0.3';
    try {
      await apiDelete(`/api/tunnels/${id}`);
      showToast('Tunnel stopped', 'info');
      setTimeout(async () => { await Promise.all([fetchTunnels(), fetchPorts()]); }, 150);
    } catch (err) { if (el) el.style.opacity = ''; showToast(err.message, 'error'); }
  }

  async function copyUrl(t) {
    const url = t.publicUrl || `http://${primaryIP}:${t.exposedPort}`;
    try { await navigator.clipboard.writeText(url); } catch { const a = document.createElement('textarea'); a.value = url; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    showToast('URL copied', 'success');
  }

  async function showQR(id) {
    dom.qrContainer.innerHTML = 'Loading...';
    dom.modalUrl.textContent = '';
    dom.qrModal.classList.add('visible');
    try {
      const t = tunnels.find(x => x.id === id);
      const type = t?.publicUrl ? 'public' : 'local';
      const data = await apiGet(`/api/tunnels/${id}/qr?type=${type}`);
      dom.qrContainer.innerHTML = data.qr || '<p>QR unavailable</p>';
      dom.modalUrl.textContent = data.url || '';
    } catch { dom.qrContainer.innerHTML = '<p style="color:var(--red)">Failed</p>'; }
  }

  function closeModal() {
    dom.qrModal.classList.remove('visible');
    setTimeout(() => { dom.qrContainer.innerHTML = ''; dom.modalUrl.textContent = ''; }, 200);
  }

  // ── Metrics ──
  function updateMetrics() {
    const tc = tunnels.length;
    dom.metricTunnels.textContent = tc;
    dom.metricTunnelsSub.textContent = tc ? `${tc} tunnel${tc > 1 ? 's' : ''} running` : 'No tunnels running';

    dom.metricPorts.textContent = ports.length;
    dom.metricPortsSub.textContent = ports.length ? `${ports.length} app${ports.length > 1 ? 's' : ''} detected` : 'No apps found';

    const totalReq = tunnels.reduce((sum, t) => sum + (t.totalRequests || 0), 0);
    dom.metricRequests.textContent = totalReq > 999 ? `${(totalReq / 1000).toFixed(1)}k` : totalReq;
    dom.metricRequestsSub.textContent = 'Across all tunnels';
  }

  // ── Polling ──
  async function pollStatuses() {
    if (!tunnels.length) return;
    const updates = await Promise.allSettled(tunnels.map(async t => {
      const d = await apiGet(`/api/tunnels/${t.id}/status`);
      return { id: t.id, status: d.status };
    }));
    updates.forEach(r => {
      if (r.status !== 'fulfilled') return;
      const { id, status } = r.value;
      const t = tunnels.find(x => x.id === id);
      if (t && t._status !== status) {
        t._status = status;
        // Update dots in both panels
        document.querySelectorAll(`#tunnel-${id} .tunnel-status-dot`).forEach(dot => {
          dot.className = `tunnel-status-dot ${status === 'online' ? 'green' : status === 'offline' ? 'red' : 'amber'}`;
        });
      }
    });
  }

  async function pollStats() {
    if (!tunnels.length) return;
    try {
      const data = await apiGet('/api/tunnels');
      const fresh = data.tunnels || [];
      let rerender = false;
      fresh.forEach(ft => {
        const ex = tunnels.find(t => t.id === ft.id);
        if (ex) {
          ex.totalRequests = ft.totalRequests;
          if (ex.internetActive !== ft.internetActive || ex.publicUrl !== ft.publicUrl) {
            ex.internetActive = ft.internetActive; ex.publicUrl = ft.publicUrl; rerender = true;
          }
        }
      });
      if (fresh.length !== tunnels.length || rerender) {
        tunnels = fresh.map(ft => ({ ...ft, _status: tunnels.find(t => t.id === ft.id)?._status || 'checking' }));
        renderTunnels();
      }
      updateMetrics();
    } catch {}
  }

  // ── Utility ──
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ── Events ──
  function bindEvents() {
    dom.modalClose.addEventListener('click', closeModal);
    dom.qrModal.addEventListener('click', e => { if (e.target === dom.qrModal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    dom.btnRefreshPorts.addEventListener('click', refreshPorts);
  }

  // ── Init ──
  async function init() {
    if (platform === 'darwin') document.body.classList.add('platform-darwin');
    dom.statusPlatform.textContent = platformLabel;
    dom.footerPlatform.innerHTML = `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="5" cy="5" r="3.5"/></svg> ${platformLabel}`;

    initTheme();
    initNav();
    bindEvents();

    await Promise.all([fetchInterfaces(), fetchTunnels(), fetchPorts()]);
    setInterval(pollStatuses, 3000);
    setInterval(pollStats, 5000);
    pollStatuses();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
