/* ==========================================================================
   Page 1: Server Overview & Read-Only Grouped Docker Containers Table
   ========================================================================== */

import { loadSettings, t } from '../core/settings.js';
import { escapeHtml, initShell, sparklineSvg } from '../core/shell.js';

const state = {
  filter: 'all',
  search: '',
  searchOpen: false,
  expanded: new Set(),
  containersData: null,
  timer: null,
  retryTimer: null,
  abortCtrl: null,
  lastResumeAt: 0,
};

function formatRamMb(mb) {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

function renderOverview(data) {
  const badge = document.getElementById('beszel-badge');
  const countBadge = document.getElementById('containers-count-badge');

  if (badge) {
    badge.className = `pill ${data.online ? 'pill-live' : 'pill-err'}`;
    badge.innerHTML = `<span class="dot ${data.online ? 'pulse' : 'err'}"></span><span>${escapeHtml(
      data.online ? t('beszelLive') : t('beszelOffline')
    )}</span>`;
  }

  if (countBadge) {
    countBadge.textContent = `${data.containers_online}/${data.containers_total}`;
  }

  const cpuVal = document.getElementById('kpi-cpu-val');
  const cpuSub = document.getElementById('kpi-cpu-sub');
  const cpuSpark = document.getElementById('kpi-cpu-spark');
  if (cpuVal) cpuVal.textContent = `${Number(data.cpu?.percent ?? 0).toFixed(1)}%`;
  if (cpuSub) cpuSub.textContent = data.cpu?.temp_c != null ? `${data.cpu.temp_c}°C` : `${data.cpu?.cores ?? 2}c`;
  if (cpuSpark) cpuSpark.innerHTML = sparklineSvg(data.cpu?.sparkline, 'grad-cpu', 100, 'var(--accent)');

  const ramVal = document.getElementById('kpi-ram-val');
  const ramSub = document.getElementById('kpi-ram-sub');
  const ramSpark = document.getElementById('kpi-ram-spark');
  const usedGb = Number(data.memory?.used_gb ?? 0).toFixed(2);
  const totalGb = Number(data.memory?.total_gb ?? 0).toFixed(2);
  if (ramVal) ramVal.innerHTML = `${usedGb} <small>/ ${totalGb} GB</small>`;
  if (ramSub) ramSub.textContent = `${Number(data.memory?.percent ?? 0).toFixed(0)}%`;
  if (ramSpark) ramSpark.innerHTML = sparklineSvg(data.memory?.sparkline, 'grad-ram', 100, 'var(--ok)');

  const diskPct = Number(data.disk?.percent ?? 0);
  const diskVal = document.getElementById('kpi-disk-val');
  const diskSub = document.getElementById('kpi-disk-sub');
  const diskBar = document.getElementById('kpi-disk-bar');
  if (diskVal) diskVal.textContent = `${diskPct.toFixed(1)}%`;
  if (diskSub) {
    diskSub.textContent = `${Number(data.disk?.used_gb ?? 0).toFixed(1)}/${Number(data.disk?.total_gb ?? 0).toFixed(0)}G`;
  }
  if (diskBar) {
    diskBar.style.width = `${Math.min(100, Math.max(0, diskPct))}%`;
    diskBar.className = `bar-fill ${diskPct >= 88 ? 'err' : diskPct >= 70 ? '' : 'ok'}`;
  }

  const { lang } = loadSettings();
  const powerVal = document.getElementById('kpi-power-val');
  const powerSub = document.getElementById('kpi-power-sub');
  const powerBar = document.getElementById('kpi-power-bar');
  const batPct = data.battery?.percent;
  const batLabel = lang === 'en' ? data.battery?.label_en : data.battery?.label_ru;
  const upLabel = lang === 'en' ? data.uptime?.label_en : data.uptime?.label_ru;
  if (powerVal) powerVal.textContent = batLabel || '—';
  if (powerSub) powerSub.textContent = upLabel || '—';
  if (powerBar) {
    const pct = batPct != null ? Math.min(100, Math.max(0, batPct)) : 100;
    powerBar.style.width = `${pct}%`;
    powerBar.className = `bar-fill ${data.battery?.is_ac === false && pct < 40 ? 'err' : 'ok'}`;
  }
}

function renderContainersTable() {
  const root = document.getElementById('containers-table-body');
  if (!root) return;

  const data = state.containersData;
  if (!data || !data.online) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(t('noData'))}</div>`;
    return;
  }

  const { lang } = loadSettings();
  const query = state.search.trim().toLowerCase();
  const filtered = (data.containers || []).filter((c) => {
    if (state.filter !== 'all' && c.stack !== state.filter) return false;
    if (query) {
      const hay = `${c.name} ${c.image} ${c.ports}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(t('emptyContainers'))}</div>`;
    return;
  }

  const groups = new Map();
  for (const c of filtered) {
    const label = lang === 'en' ? c.stack_label_en : c.stack_label_ru;
    if (!groups.has(c.stack)) {
      groups.set(c.stack, { label, items: [] });
    }
    groups.get(c.stack).items.push(c);
  }

  let html = '';
  for (const [, group] of groups.entries()) {
    html += `<div class="ct-group-title"><span>${escapeHtml(group.label)}</span><span class="mono">${group.items.length}</span></div>`;
    for (const c of group.items) {
      const isExpanded = state.expanded.has(c.id);
      const dotClass = !c.is_running || c.health_label === 'unhealthy' ? 'err' : c.health_label === 'starting' ? 'warn' : '';
      const cpuBarPct = Math.min(100, Math.max(2, c.cpu_pct * 3.5));
      const ramBarPct = Math.min(100, Math.max(2, (c.memory_mb / 512) * 100));
      const cpuHot = c.cpu_pct >= 10 ? 'hot' : '';
      const ramHot = c.memory_mb >= 256 ? 'hot' : '';
      const portsDisplay = c.ports ? c.ports : '—';
      const netDisplay = c.net_kbps > 0 ? `${c.net_kbps} KB/s` : '0 KB/s';

      html += `
        <div class="ct-row ${isExpanded ? 'expanded' : ''}" data-cid="${escapeHtml(c.id)}">
          <button type="button" class="ct-row-main" aria-expanded="${isExpanded}">
            <div class="ct-name-col">
              <span class="dot ${dotClass}"></span>
              <span class="ct-name">${escapeHtml(c.name)}</span>
            </div>
            <div class="ct-metric-col">
              <span class="ct-metric-val mono">${c.cpu_pct.toFixed(1)}%</span>
              <div class="ct-mini-bar"><div class="ct-mini-bar-fill ${cpuHot}" style="width:${cpuBarPct.toFixed(0)}%"></div></div>
            </div>
            <div class="ct-metric-col">
              <span class="ct-metric-val mono">${escapeHtml(formatRamMb(c.memory_mb))}</span>
              <div class="ct-mini-bar"><div class="ct-mini-bar-fill ${ramHot}" style="width:${ramBarPct.toFixed(0)}%"></div></div>
            </div>
          </button>
          <div class="ct-details">
            <div class="ct-detail-grid">
              <div class="ct-detail-item full">${escapeHtml(t('detailImage'))}: <strong class="mono">${escapeHtml(c.image || '—')}</strong></div>
              <div class="ct-detail-item">${escapeHtml(t('detailStatus'))}: <strong>${escapeHtml(c.status || c.health_label)}</strong></div>
              <div class="ct-detail-item">${escapeHtml(t('detailPorts'))}: <strong class="mono">${escapeHtml(portsDisplay)}</strong></div>
              <div class="ct-detail-item">${escapeHtml(t('detailNet'))}: <strong class="mono">${escapeHtml(netDisplay)}</strong></div>
              <div class="ct-detail-item">${escapeHtml(t('detailPolicy'))}: <strong class="mono">${escapeHtml(c.restart_policy)}</strong></div>
            </div>
          </div>
        </div>
      `;
    }
  }

  root.innerHTML = html;

  root.querySelectorAll('.ct-row-main').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.ct-row');
      const cid = row?.dataset.cid;
      if (!cid) return;
      if (state.expanded.has(cid)) {
        state.expanded.delete(cid);
        row.classList.remove('expanded');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        state.expanded.add(cid);
        row.classList.add('expanded');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

async function fetchAll({ isRetry = false } = {}) {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.classList.add('spinning');

  if (state.abortCtrl) {
    state.abortCtrl.abort();
  }
  if (state.retryTimer) {
    clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }

  const controller = new AbortController();
  state.abortCtrl = controller;
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let gotStale = false;
  try {
    const [ovResp, ctResp] = await Promise.all([
      fetch('/api/server/overview', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/server/containers', { cache: 'no-store', signal: controller.signal }),
    ]);
    if (ovResp.headers.get('X-SM-Cache') === 'stale' || ctResp.headers.get('X-SM-Cache') === 'stale') {
      gotStale = true;
    }
    if (ovResp.ok) {
      renderOverview(await ovResp.json());
    }
    if (ctResp.ok) {
      state.containersData = await ctResp.json();
      renderContainersTable();
    }
  } catch {
    gotStale = true;
    // Keep last visible state on transient network errors
  } finally {
    clearTimeout(timeoutId);
    if (state.abortCtrl === controller) {
      state.abortCtrl = null;
      if (refreshBtn) refreshBtn.classList.remove('spinning');
    }
    if (gotStale && !isRetry && !document.hidden) {
      state.retryTimer = setTimeout(() => {
        state.retryTimer = null;
        if (!document.hidden) fetchAll({ isRetry: true });
      }, 2500);
    }
  }
}

function scheduleRefresh() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  const { interval } = loadSettings();
  if (interval > 0) {
    state.timer = setInterval(() => {
      if (!document.hidden) fetchAll();
    }, interval * 1000);
  }
}

function resumeAndRefresh() {
  if (document.hidden) return;
  const now = Date.now();
  if (now - state.lastResumeAt < 600) return;
  state.lastResumeAt = now;
  scheduleRefresh();
  fetchAll();
}

function bindControls() {
  document.getElementById('refresh-btn')?.addEventListener('click', () => fetchAll());

  const searchToggle = document.getElementById('search-toggle-btn');
  const searchBox = document.getElementById('search-box');
  const searchInput = document.getElementById('container-search-input');

  searchToggle?.addEventListener('click', () => {
    state.searchOpen = !state.searchOpen;
    searchBox?.classList.toggle('hidden', !state.searchOpen);
    if (state.searchOpen) {
      searchInput?.focus();
    } else if (searchInput) {
      searchInput.value = '';
      state.search = '';
      renderContainersTable();
    }
  });

  searchInput?.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderContainersTable();
  });

  document.querySelectorAll('[data-stack-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.stackFilter || 'all';
      document.querySelectorAll('[data-stack-filter]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderContainersTable();
    });
  });

  document.addEventListener('visibilitychange', resumeAndRefresh);
  window.addEventListener('pageshow', resumeAndRefresh);
  window.addEventListener('focus', resumeAndRefresh);
  window.addEventListener('online', resumeAndRefresh);
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('server');
  bindControls();
  fetchAll();
  scheduleRefresh();
});
