/* ==========================================================================
   Page 2: Power, Nokia 6.1 Agent, Server Sensors, Network & Telegram Watchdogs
   ========================================================================== */

import { loadSettings, t } from '../core/settings.js';
import { escapeHtml, initShell, sparklineSvg } from '../core/shell.js';

let refreshTimer = null;

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

function formatRate(bps) {
  const b = Number(bps) || 0;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB/s`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB/s`;
  return `${Math.round(b)} B/s`;
}

function formatRelativeTime(isoStr) {
  if (!isoStr) return '—';
  const ts = Date.parse(isoStr);
  if (Number.isNaN(ts)) return '—';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  const { lang } = loadSettings();
  if (diffMin < 1) return lang === 'en' ? 'just now' : 'только что';
  if (diffMin < 60) return lang === 'en' ? `${diffMin}m ago` : `${diffMin}м назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) return lang === 'en' ? `${diffH}h ago` : `${diffH}ч назад`;
  const diffD = Math.floor(diffH / 24);
  return lang === 'en' ? `${diffD}d ago` : `${diffD}д назад`;
}

function renderNokia(nokia) {
  const levelEl = document.getElementById('nokia-level');
  const statusEl = document.getElementById('nokia-status-pill');
  const barEl = document.getElementById('nokia-bar');
  const sparkEl = document.getElementById('nokia-spark');
  const updatedEl = document.getElementById('nokia-updated');

  const lvl = nokia?.battery_level;
  if (levelEl) levelEl.textContent = lvl != null ? `${lvl}%` : '—';

  if (statusEl) {
    if (lvl == null) {
      statusEl.className = 'pill';
      statusEl.textContent = t('nokiaOffline');
    } else if (nokia.charging) {
      statusEl.className = 'pill pill-live';
      statusEl.textContent = t('nokiaCharging');
    } else {
      statusEl.className = 'pill pill-accent';
      statusEl.textContent = t('nokiaBattery');
    }
  }

  if (barEl) {
    const pct = lvl != null ? Math.min(100, Math.max(0, lvl)) : 0;
    barEl.style.width = `${pct}%`;
    barEl.className = `bar-fill ${pct <= 20 ? 'err' : nokia?.charging ? 'ok' : ''}`;
  }

  if (sparkEl) {
    const pts = (nokia?.history || []).map((p) => p.level);
    sparkEl.innerHTML = pts.length >= 2 ? sparklineSvg(pts, 'grad-nokia', 100, 'var(--ok)') : '';
  }

  if (updatedEl) {
    updatedEl.textContent = `${t('nokiaUpdated')}: ${formatRelativeTime(nokia?.updated_at)}`;
  }
}

function renderSensorsAndNetwork(data) {
  const root = document.getElementById('sensors-list');
  if (!root) return;

  const rows = [];
  const temps = data.sensors?.temps || {};
  for (const [k, v] of Object.entries(temps)) {
    const pretty = k.replace('coretemp_core_', 'Core ').replaceAll('_', ' ');
    rows.push({ key: pretty, val: `${v}°C` });
  }

  const la = data.sensors?.load;
  if (la) {
    rows.push({ key: t('loadAvgLabel'), val: `${la.min1} / ${la.min5} / ${la.min15}` });
  }

  if (data.sensors?.swap_total_gb > 0) {
    rows.push({
      key: t('swapLabel'),
      val: `${Number(data.sensors.swap_used_gb).toFixed(2)} / ${Number(data.sensors.swap_total_gb).toFixed(2)} GB`,
    });
  }

  if (data.wifi?.ssid || data.wifi?.rssi_dbm != null) {
    const ssid = data.wifi.ssid ? `${data.wifi.ssid} ` : '';
    const rssi = data.wifi.rssi_dbm != null ? `${data.wifi.rssi_dbm} dBm` : '';
    rows.push({ key: t('wifiLabel'), val: `${ssid}${rssi}`.trim() });
  }

  for (const iface of data.interfaces || []) {
    rows.push({
      key: `${iface.name} (↓ / ↑)`,
      val: `${formatRate(iface.rx_bps)} / ${formatRate(iface.tx_bps)} • ${formatBytes(iface.rx_total_bytes)}`,
    });
  }

  if (!rows.length) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(t('noData'))}</div>`;
    return;
  }

  root.innerHTML = rows
    .map(
      (r) => `
      <div class="kv-row">
        <span class="kv-key">${escapeHtml(r.key)}</span>
        <span class="kv-val mono">${escapeHtml(r.val)}</span>
      </div>
    `
    )
    .join('');
}

function renderWatchdogs(data) {
  const root = document.getElementById('watchdogs-list');
  if (!root) return;
  const { lang } = loadSettings();

  root.innerHTML = (data.watchdogs || [])
    .map((w) => {
      const name = lang === 'en' ? w.name_en : w.name_ru;
      const pillCls = w.active ? 'pill-live' : 'pill-err';
      const pillTxt = w.active ? t('activePill') : t('offlinePill');
      return `
        <div class="kv-row">
          <span class="kv-key">${escapeHtml(name)} <span class="mono">(${escapeHtml(w.interval)})</span></span>
          <span class="pill ${pillCls}">${escapeHtml(pillTxt)}</span>
        </div>
      `;
    })
    .join('');
}

function updateQuickLinks(links) {
  const host = window.location.hostname || '127.0.0.1';
  const beszelEl = document.getElementById('link-beszel');
  const adguardEl = document.getElementById('link-adguard');
  if (beszelEl && links?.beszel) beszelEl.href = `http://${host}:${links.beszel}`;
  if (adguardEl && links?.adguard) adguardEl.href = `http://${host}:${links.adguard}`;
}

async function fetchAgents() {
  const btn = document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  try {
    const resp = await fetch('/api/agents/overview', { cache: 'no-store' });
    if (!resp.ok) return;
    const data = await resp.json();
    renderNokia(data.nokia);
    renderSensorsAndNetwork(data);
    renderWatchdogs(data);
    updateQuickLinks(data.quick_links);
  } catch {
    // Graceful no-op on transient outage
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('agents');
  document.getElementById('refresh-btn')?.addEventListener('click', fetchAgents);
  fetchAgents();

  const { interval } = loadSettings();
  if (interval > 0) {
    refreshTimer = setInterval(() => {
      if (!document.hidden) fetchAgents();
    }, interval * 1000);
  }
});
