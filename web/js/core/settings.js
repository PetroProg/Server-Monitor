/* ==========================================================================
   Settings, Themes & RU/EN i18n (Strictly RU and EN only)
   ========================================================================== */

const STORAGE_KEY = 'sm_settings_v1';

export const THEME_PRESETS = [
  {
    id: 'obsidian-amber',
    name: 'Obsidian Amber',
    themeColor: '#0d0d0f',
    swatches: ['#0d0d0f', '#16161a', '#f59e0b'],
    tag_ru: 'Тёмная',
    tag_en: 'Dark',
  },
  {
    id: 'nordic-paper',
    name: 'Nordic Paper',
    themeColor: '#f6f5f0',
    swatches: ['#f6f5f0', '#ffffff', '#ea580c'],
    tag_ru: 'Светлая',
    tag_en: 'Light',
  },
  {
    id: 'emerald-ops',
    name: 'Emerald Ops',
    themeColor: '#090e0c',
    swatches: ['#090e0c', '#111916', '#34d399'],
    tag_ru: 'Тёмная',
    tag_en: 'Dark',
  },
  {
    id: 'velvet-coral',
    name: 'Velvet Coral',
    themeColor: '#110e15',
    swatches: ['#110e15', '#1b1622', '#fb7185'],
    tag_ru: 'Тёмная',
    tag_en: 'Dark',
  },
];

export const REFRESH_INTERVALS = [5, 10, 30, 60, 0];

const DEFAULT_SETTINGS = {
  theme: 'obsidian-amber',
  interval: 10,
  lang: 'ru',
};

const DICT = {
  ru: {
    navServer: 'Сервер',
    navAgents: 'Агенты',
    navSettings: 'Настройки',
    serverTitle: 'Сервер petroprog',
    agentsTitle: 'Питание и Агенты',
    settingsTitle: 'Настройки',
    beszelLive: 'Beszel Live',
    beszelOffline: 'Beszel Оффлайн',
    kpiCpu: 'CPU',
    kpiRam: 'RAM',
    kpiDisk: 'SSD',
    kpiPower: 'Питание',
    containersTitle: 'Docker-контейнеры',
    filterAll: 'Все',
    filterAi: 'AI News',
    filterMedia: 'Медиа и сервисы',
    filterOther: 'Прочие',
    searchPlaceholder: 'Поиск по имени или образу...',
    colName: 'Контейнер',
    colCpu: 'CPU %',
    colRam: 'RAM',
    detailImage: 'Образ',
    detailStatus: 'Статус',
    detailPorts: 'Порты',
    detailNet: 'Сеть',
    detailPolicy: 'Перезапуск',
    emptyContainers: 'Контейнеры не найдены',
    nokiaTitle: 'Nokia 6.1',
    nokiaCharging: 'Заряжается',
    nokiaBattery: 'От батареи',
    nokiaOffline: 'Нет данных',
    nokiaHistoryLabel: 'Разряд 24ч',
    nokiaUpdated: 'Обновлено',
    sensorsTitle: 'Сенсоры и Сеть',
    watchdogsTitle: 'Telegram Watchdogs',
    linksTitle: 'Сервисы сервера',
    activePill: 'Активен',
    offlinePill: 'Оффлайн',
    loadAvgLabel: 'Нагрузка (1/5/15м)',
    swapLabel: 'Файл подкачки (Swap)',
    wifiLabel: 'Wi-Fi сигнал',
    themeSection: 'Тема оформления',
    intervalSection: 'Интервал обновления',
    intervalOff: 'Выкл',
    langSection: 'Язык интерфейса',
    pwaSection: 'Приложение (PWA)',
    pwaInstallBtn: 'Установить приложение',
    pwaInstalledBtn: 'Установлено как PWA',
    pwaResetBtn: 'Сбросить кэш',
    pwaHintIos: 'На iPhone/iPad: нажмите «Поделиться» в Safari и выберите «На экран Домой».',
    pwaHintAndroid: 'Если кнопка недоступна, откройте меню браузера и выберите «Установить приложение».',
    cacheCleared: 'Кэш очищен, перезагрузка...',
    settingsSaved: 'Настройки сохранены',
    noData: 'Нет данных от Beszel Hub',
  },
  en: {
    navServer: 'Server',
    navAgents: 'Agents',
    navSettings: 'Settings',
    serverTitle: 'Server petroprog',
    agentsTitle: 'Power & Agents',
    settingsTitle: 'Settings',
    beszelLive: 'Beszel Live',
    beszelOffline: 'Beszel Offline',
    kpiCpu: 'CPU',
    kpiRam: 'RAM',
    kpiDisk: 'SSD',
    kpiPower: 'Power',
    containersTitle: 'Docker Containers',
    filterAll: 'All',
    filterAi: 'AI News',
    filterMedia: 'Media & Apps',
    filterOther: 'Other',
    searchPlaceholder: 'Filter by name or image...',
    colName: 'Container',
    colCpu: 'CPU %',
    colRam: 'RAM',
    detailImage: 'Image',
    detailStatus: 'Status',
    detailPorts: 'Ports',
    detailNet: 'Network',
    detailPolicy: 'Restart',
    emptyContainers: 'No containers found',
    nokiaTitle: 'Nokia 6.1',
    nokiaCharging: 'Charging',
    nokiaBattery: 'On battery',
    nokiaOffline: 'No signal',
    nokiaHistoryLabel: '24h history',
    nokiaUpdated: 'Updated',
    sensorsTitle: 'Sensors & Network',
    watchdogsTitle: 'Telegram Watchdogs',
    linksTitle: 'Server Services',
    activePill: 'Active',
    offlinePill: 'Offline',
    loadAvgLabel: 'Load Avg (1/5/15m)',
    swapLabel: 'Swap memory',
    wifiLabel: 'Wi-Fi signal',
    themeSection: 'Appearance Theme',
    intervalSection: 'Refresh Interval',
    intervalOff: 'Off',
    langSection: 'Language',
    pwaSection: 'App & PWA',
    pwaInstallBtn: 'Install App',
    pwaInstalledBtn: 'Running as PWA',
    pwaResetBtn: 'Reset Cache',
    pwaHintIos: 'On iPhone/iPad: tap Share in Safari and choose "Add to Home Screen".',
    pwaHintAndroid: 'If unavailable, open your browser menu and select "Install app".',
    cacheCleared: 'Cache cleared, reloading...',
    settingsSaved: 'Settings updated',
    noData: 'Waiting for Beszel Hub',
  },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const theme = THEME_PRESETS.some((p) => p.id === parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme;
    const interval = REFRESH_INTERVALS.includes(Number(parsed.interval)) ? Number(parsed.interval) : DEFAULT_SETTINGS.interval;
    const lang = parsed.lang === 'en' ? 'en' : 'ru';
    return { theme, interval, lang };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  if (!THEME_PRESETS.some((p) => p.id === next.theme)) next.theme = DEFAULT_SETTINGS.theme;
  if (!REFRESH_INTERVALS.includes(Number(next.interval))) next.interval = DEFAULT_SETTINGS.interval;
  next.lang = next.lang === 'en' ? 'en' : 'ru';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyTheme(next.theme);
  return next;
}

export function applyTheme(themeId) {
  const preset = THEME_PRESETS.find((p) => p.id === themeId) || THEME_PRESETS[0];
  document.documentElement.dataset.theme = preset.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', preset.themeColor);
}

export function t(key) {
  const { lang } = loadSettings();
  return (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
}

export function applyI18n(root = document) {
  const { lang } = loadSettings();
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPh));
  });
}
