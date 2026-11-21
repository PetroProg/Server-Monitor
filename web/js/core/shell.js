/* ==========================================================================
   Shared UI Shell: Safe HTML escaping, Navigation, Sparklines, PWA & Toasts
   ========================================================================== */

import { applyI18n, applyTheme, loadSettings } from './settings.js';

let deferredInstallPrompt = null;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(message) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

export function sparklineSvg(points, gradId, maxVal = 100, colorVar = 'var(--accent)') {
  if (!Array.isArray(points) || points.length < 2) {
    return '';
  }
  const w = 140;
  const h = 26;
  const vals = points.map((v) => Math.max(0, Number(v) || 0));
  const peak = Math.max(maxVal, ...vals, 1);
  const step = w / (vals.length - 1);

  const coords = vals.map((v, idx) => {
    const x = (idx * step).toFixed(1);
    const y = (h - 2 - (v / peak) * (h - 5)).toFixed(1);
    return `${x},${y}`;
  });

  const linePath = `M ${coords.join(' L ')}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${escapeHtml(gradId)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colorVar}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${colorVar}" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${escapeHtml(gradId)})" />
      <path d="${linePath}" fill="none" stroke="${colorVar}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

export function initShell(activePage) {
  const settings = loadSettings();
  applyTheme(settings.theme);
  applyI18n();

  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === activePage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('sm:pwa-install-ready'));
  });
}

export function isStandalonePwa() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function hasInstallPrompt() {
  return Boolean(deferredInstallPrompt);
}

export async function triggerInstallPrompt() {
  if (!deferredInstallPrompt) return 'unavailable';
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return choice?.outcome || 'dismissed';
}
