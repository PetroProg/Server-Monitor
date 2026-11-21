/* ==========================================================================
   Page 3: Settings (4 Theme Presets, Refresh Interval, RU/EN Only, PWA)
   ========================================================================== */

import {
  applyI18n,
  loadSettings,
  REFRESH_INTERVALS,
  saveSettings,
  t,
  THEME_PRESETS,
} from '../core/settings.js';
import {
  escapeHtml,
  hasInstallPrompt,
  initShell,
  isStandalonePwa,
  showToast,
  triggerInstallPrompt,
} from '../core/shell.js';

function renderThemes() {
  const root = document.getElementById('theme-grid');
  if (!root) return;
  const { theme, lang } = loadSettings();

  root.innerHTML = THEME_PRESETS.map((p) => {
    const active = p.id === theme;
    const tag = lang === 'en' ? p.tag_en : p.tag_ru;
    return `
      <button type="button" class="theme-card ${active ? 'active' : ''}" data-theme-pick="${escapeHtml(p.id)}">
        <div class="theme-swatch">
          <span style="background:${escapeHtml(p.swatches[0])}"></span>
          <span style="background:${escapeHtml(p.swatches[1])}"></span>
          <span style="background:${escapeHtml(p.swatches[2])}"></span>
        </div>
        <div class="theme-name">
          <span>${escapeHtml(p.name)}</span>
          <span class="pill">${escapeHtml(tag)}</span>
        </div>
      </button>
    `;
  }).join('');

  root.querySelectorAll('[data-theme-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveSettings({ theme: btn.dataset.themePick });
      renderThemes();
      showToast(t('settingsSaved'));
    });
  });
}

function renderIntervals() {
  const root = document.getElementById('interval-seg');
  if (!root) return;
  const { interval, lang } = loadSettings();

  root.innerHTML = REFRESH_INTERVALS.map((sec) => {
    const active = sec === interval;
    const label = sec === 0 ? t('intervalOff') : `${sec}${lang === 'en' ? 's' : 'с'}`;
    return `<button type="button" class="seg-btn ${active ? 'active' : ''}" data-interval-pick="${sec}">${escapeHtml(
      label
    )}</button>`;
  }).join('');

  root.querySelectorAll('[data-interval-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveSettings({ interval: Number(btn.dataset.intervalPick) });
      renderIntervals();
      showToast(t('settingsSaved'));
    });
  });
}

function renderLanguages() {
  const root = document.getElementById('lang-seg');
  if (!root) return;
  const { lang } = loadSettings();

  const langs = [
    { id: 'ru', label: 'Русский' },
    { id: 'en', label: 'English' },
  ];

  root.innerHTML = langs
    .map(
      (l) =>
        `<button type="button" class="seg-btn ${lang === l.id ? 'active' : ''}" data-lang-pick="${l.id}">${escapeHtml(
          l.label
        )}</button>`
    )
    .join('');

  root.querySelectorAll('[data-lang-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      saveSettings({ lang: btn.dataset.langPick });
      applyI18n();
      renderThemes();
      renderIntervals();
      renderLanguages();
      updatePwaSection();
      showToast(t('settingsSaved'));
    });
  });
}

function updatePwaSection() {
  const installBtn = document.getElementById('pwa-install-btn');
  const hintBox = document.getElementById('pwa-hint-box');
  if (!installBtn || !hintBox) return;

  if (isStandalonePwa()) {
    installBtn.textContent = t('pwaInstalledBtn');
    installBtn.disabled = true;
    installBtn.style.opacity = '0.7';
    hintBox.classList.add('hidden');
    return;
  }

  installBtn.textContent = t('pwaInstallBtn');
  installBtn.disabled = false;
  installBtn.style.opacity = '1';

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  hintBox.textContent = isIos ? t('pwaHintIos') : t('pwaHintAndroid');
  hintBox.classList.toggle('hidden', hasInstallPrompt());
}

function bindPwaButtons() {
  document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (isStandalonePwa()) return;
    const outcome = await triggerInstallPrompt();
    if (outcome === 'unavailable') {
      const hintBox = document.getElementById('pwa-hint-box');
      if (hintBox) hintBox.classList.remove('hidden');
      showToast(t('pwaHintAndroid'));
    } else if (outcome === 'accepted') {
      updatePwaSection();
    }
  });

  document.getElementById('pwa-reset-btn')?.addEventListener('click', async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // Ignore cleanup failures
    }
    showToast(t('cacheCleared'));
    setTimeout(() => window.location.reload(), 650);
  });

  window.addEventListener('sm:pwa-install-ready', updatePwaSection);
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('settings');
  renderThemes();
  renderIntervals();
  renderLanguages();
  updatePwaSection();
  bindPwaButtons();
});
