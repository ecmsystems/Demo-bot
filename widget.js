/**
 * ECM Systems | Workshop AI Concierge Widget
 * -------------------------------------------------------------
 * Автономный чат-виджет в стиле «Заказ-наряд мастерской».
 * Поддерживает два режима работы:
 *  - Inline: встраивание в контейнер #ecm-demo в Hero-блоке
 *  - Floating: плавающая кнопка в углу экрана (с IntersectionObserver)
 *  - Автовоспроизведение первого диалога сметы (с уважением prefers-reduced-motion)
 *  - Динамическая смена тем: «Эпоксид», «Графит и медь», «Спорт»
 *  - Оформление сметы как бланка заказ-наряда с таймером брони 15:00
 *  - Полная изоляция в Shadow DOM
 */
(function () {
  'use strict';

  if (window.__ECM_WIDGET_INITIALIZED__) return;
  window.__ECM_WIDGET_INITIALIZED__ = true;

  // ─── 1. КОНФИГУРАЦИЯ СТУДИИ И ПРАЙС ──────────────────────────────
  const STUDIO_CONFIG = {
    studio_id: 'default',
    company_name: 'ECM Detailing Lab',
    city: 'Москва, ул. Автозаводская, 23',
    slots: ['10:00', '12:00', '14:00', '16:00', '18:00'],
    services: (
      '1. Комплексная полировка кузова: Седан — 18 000 ₽, Кроссовер — 22 000 ₽, Джип — 26 000 ₽.\n' +
      '2. Керамическое покрытие 9H (2 слоя): Седан — 25 000 ₽, Кроссовер/Джип — 30 000 ₽.\n' +
      '3. Оклейка зон риска полиуретановой пленкой (PPF): Седан — 65 000 ₽, Кроссовер/Джип — 75 000 ₽.\n' +
      '4. Полная химчистка салона: Седан — 15 000 ₽, Кроссовер/Джип — 18 000 ₽.'
    ),
    promo: 'Бесплатный замер толщины ЛКП и гидрофобный антидождь передней полусферы в подарок при заказе комплекса.',
    quick_prompts: [
      'Хочу PPF на Mercedes GLE',
      'Сколько стоит полировка кузова?',
      'Помоги мне с выбором',
      'Запишите на субботу'
    ]
  };

  // Чтение параметров URL для персонализированного демо (?studio=<slug>)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const studioParam = urlParams.get('studio');
    if (studioParam) {
      STUDIO_CONFIG.studio_id = studioParam;
    }
  } catch(e) {}


  // ─── 2. СИСТЕМНЫЙ ПРОМПТ ДЛЯ ИИ-АДМИНИСТРАТОРА ────────────────────
  const SYSTEM_PROMPT = `
Ты — вежливый, опытный и лаконичный администратор детейлинг-центра «${STUDIO_CONFIG.company_name}».
ТВОЙ ТОН: деловой, спокойный, строгий стиль заказ-наряда. Без слов «Конечно!», «Рад помочь!», без восклицаний и эмодзи.

ПРАЙС-ЛИСТ (СТРОГО ФИКСИРОВАННЫЙ):
- Седан / Купе (BMW 3/5, F10, Mercedes E/C, Audi A4/A6, Camry): Полировка 18 000 ₽, Керамика 9H 25 000 ₽, PPF 65 000 ₽, Химчистка 15 000 ₽.
- Кроссовер (BMW X3, Audi Q5, Mercedes GLC, Tiguan, RAV4, Monjaro): Полировка 22 000 ₽, Керамика 9H 30 000 ₽, PPF 75 000 ₽, Химчистка 18 000 ₽.
- Джип / Внедорожник (BMW X5/X7, Mercedes GLE/GLS, Land Cruiser): Полировка 26 000 ₽, Керамика 9H 30 000 ₽, PPF 75 000 ₽, Химчистка 18 000 ₽.

ПРАВИЛО ДОПРОДАЖИ:
К полировке всегда предлагай закрепить результат 2 слоями керамики 9H (+25 000 ₽ для седана), а антидождь по акции идёт в подарок (0 ₽). Смету считай честно сложением.
К оклейке PPF предлагай керамику на оставшуюся часть кузова.

БРОНИРОВАНИЕ:
Ближайший свободный слот: суббота в 14:00 (удержание окна 15 минут). Проси номер телефона для закрепления брони.
`.trim();

  // ─── 3. ДЕМО-КЛЮЧ И СЕССИЯ ────────────────────────────────────────
  const DEFAULT_KEY = (function () {
    try {
      return atob('QVEuQWI4Uk42S282X0wya0pnNzVaWjRrc3JxQkExb2ItcGdxSlpWQVpDdUdJWGtJd2VGdHc=');
    } catch (e) { return ''; }
  })();

  const SESSION_KEY = `ecm_session_${STUDIO_CONFIG.studio_id}`;
  const MSGS_KEY = `ecm_msgs_${STUDIO_CONFIG.studio_id}`;
  const USAGE_KEY = `ecm_usage_${STUDIO_CONFIG.studio_id}`;
  const MAX_DEMO_MESSAGES = 50;

  function generateUUID() {
    return 'ecm-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }

  function getMessageCount() {
    try { return parseInt(localStorage.getItem(USAGE_KEY) || '0', 10); } catch (e) { return 0; }
  }
  function incrementMessageCount() {
    try {
      const c = getMessageCount() + 1;
      localStorage.setItem(USAGE_KEY, String(c));
      return c;
    } catch (e) { return 1; }
  }

  // ─── 4. ТЕМЫ СТИЛЕЙ СТУДИИ ────────────────────────────────────────
  const THEMES = {
    dark: {
      name: 'dark',
      bg: '#090A0D',
      panel: '#111319',
      card_bg: '#161922',
      ink: '#F1F3F7',
      muted: '#8F97A6',
      rule: '#232734',
      accent: '#2563EB',
      accent_ink: '#FFFFFF',
      ok: '#22C55E',
      hold_bg: 'rgba(37, 99, 235, 0.1)',
      hold_text: '#60A5FA',
      upsell_bg: 'rgba(37, 99, 235, 0.14)',
      upsell_tag_bg: '#2563EB',
      upsell_tag_color: '#FFFFFF',
      upsell_tag_shadow: '0 1px 2px rgba(0,0,0,0.7)',
      upsell_tag_stroke: '0.2px rgba(0,0,0,0.5)',
      avatar_bg: 'rgba(255, 255, 255, 0.08)',
      avatar_border: 'rgba(255, 255, 255, 0.14)',
      logo_filter: 'none',
      radius_win: '14px',
      radius_card: '4px',
      radius_btn: '6px',
      font: "'Golos Text', -apple-system, BlinkMacSystemFont, sans-serif",
      font_head: "'Fira Sans Extra Condensed', sans-serif"
    },
    copper: {
      name: 'copper',
      bg: '#15181B',
      panel: '#1F2327',
      card_bg: '#1A1E22',
      ink: '#ECEEEF',
      muted: '#9AA2A9',
      rule: '#2C3238',
      accent: '#D97736',
      accent_ink: '#FFFFFF',
      ok: '#FDBA74',
      hold_bg: 'rgba(217, 119, 54, 0.12)',
      hold_text: '#FDBA74',
      upsell_bg: 'rgba(217, 119, 54, 0.14)',
      upsell_tag_bg: '#D97706',
      upsell_tag_color: '#FFFFFF',
      upsell_tag_shadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
      upsell_tag_stroke: 'none',
      avatar_bg: 'rgba(255, 255, 255, 0.08)',
      avatar_border: 'rgba(255, 255, 255, 0.14)',
      logo_filter: 'none',
      radius_win: '14px',
      radius_card: '6px',
      radius_btn: '6px',
      font: "'Golos Text', -apple-system, BlinkMacSystemFont, sans-serif",
      font_head: "'Fira Sans Extra Condensed', sans-serif"
    },
    epoxy: {
      name: 'epoxy',
      bg: '#E7E9EA',
      panel: '#F6F7F7',
      card_bg: '#FFFFFF',
      ink: '#1A1D21',
      muted: '#5E666D',
      rule: '#C5CACE',
      accent: '#F5C518',
      accent_ink: '#1A1D21',
      ok: '#1B6E44',
      hold_bg: 'rgba(27, 110, 68, 0.08)',
      hold_text: '#1B6E44',
      upsell_bg: 'rgba(245, 197, 24, 0.12)',
      upsell_tag_bg: '#F5C518',
      upsell_tag_color: '#1A1D21',
      upsell_tag_shadow: 'none',
      upsell_tag_stroke: 'none',
      avatar_bg: '#EAECEE',
      avatar_border: '#C5CACE',
      logo_filter: 'invert(1)',
      radius_win: '14px',
      radius_card: '4px',
      radius_btn: '6px',
      font: "'Golos Text', -apple-system, BlinkMacSystemFont, sans-serif",
      font_head: "'Fira Sans Extra Condensed', sans-serif"
    }
  };

  const prefersDarkInitial = (function() {
    try {
      const attr = document.documentElement.getAttribute('data-site-theme');
      if (attr) return attr === 'dark';
      const saved = localStorage.getItem('ecm_site_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) { return false; }
  })();

  let activeTheme = prefersDarkInitial ? THEMES.dark : THEMES.epoxy;

  // ─── 5. SVG ИКОНКИ (ТЕХНИЧЕСКИЕ) ──────────────────────────────────
  const SVG_CHAT = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;

  const SVG_CLOSE = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;

  const SVG_SEND = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  `;

  const SVG_RESET = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  `;

  // Логотип ECM в Base64
  const ECM_LOGO_DATA_URI = 'data:image/png;base64,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';

  // ─── 6. СТИЛИ ТЕНЕВОГО DOM (ДИНАМИЧЕСКИЕ ТОКЕНЫ) ─────────────────
  function generateStyles(theme) {
    return `
      :host {
        --w-bg: ${theme.bg};
        --w-panel: ${theme.panel};
        --w-card: ${theme.card_bg};
        --w-ink: ${theme.ink};
        --w-muted: ${theme.muted};
        --w-rule: ${theme.rule};
        --w-accent: ${theme.accent};
        --w-accent-ink: ${theme.accent_ink};
        --w-ok: ${theme.ok};
        --w-r-win: ${theme.radius_win};
        --w-r-card: ${theme.radius_card};
        --w-r-btn: ${theme.radius_btn};
        --w-font: ${theme.font};
        --w-font-head: ${theme.font_head};

        font-family: var(--w-font);
        color: var(--w-ink);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
      }

      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: inherit;
      }

      .tabular {
        font-variant-numeric: tabular-nums;
      }

      /* Плавающий режим: кнопка в углу (фирменный скругленный блок ECM) */
      .ecm-floating-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: #111114;
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.6);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
        user-select: none;
        padding: 0;
        outline: none;
      }
      .ecm-floating-launcher:hover {
        background: #17171C;
        border-color: rgba(255, 255, 255, 0.28);
        transform: translateY(-2px);
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.75);
      }
      .ecm-floating-launcher:active {
        transform: translateY(0);
      }
      .ecm-floating-launcher:focus-visible {
        outline: 2px solid var(--w-ink);
        outline-offset: 3px;
      }

      .ecm-launcher-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        color: #FAFAFA;
      }
      .ecm-launcher-logo {
        width: 32px;
        height: auto;
        display: block;
      }
      .ecm-launcher-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #22C55E;
        border: 2px solid #08080A;
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.7);
      }
      .ecm-floating-launcher.is-open .ecm-launcher-dot {
        display: none;
      }

      /* Окно чата (Floating & Inline) */
      .ecm-chat-window {
        background: var(--w-panel);
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-win);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }

      /* Модальный плавающий контейнер */
      .ecm-modal-overlay {
        position: fixed;
        bottom: 86px;
        right: 24px;
        width: 380px;
        height: 580px;
        max-height: calc(100vh - 100px);
        max-width: calc(100vw - 32px);
        z-index: 2147483647;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
        border-radius: var(--w-r-win);
        display: flex;
        opacity: 0;
        pointer-events: none;
        transform: translateY(12px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .ecm-modal-overlay.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      /* Шапка виджета */
      .ecm-header {
        background: var(--w-card);
        border-bottom: 1px solid var(--w-rule);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .ecm-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .ecm-avatar {
        width: 30px;
        height: 30px;
        border-radius: var(--w-r-btn);
        background: ${theme.avatar_bg || 'rgba(255, 255, 255, 0.08)'};
        border: 1px solid ${theme.avatar_border || 'rgba(255, 255, 255, 0.14)'};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ecm-avatar img {
        height: 13px;
        width: auto;
        display: block;
        filter: ${theme.logo_filter || 'none'};
      }

      .ecm-title {
        font-size: 14.5px;
        font-weight: 600;
        color: var(--w-ink);
        letter-spacing: -0.01em;
      }

      .ecm-sub {
        font-size: 11.5px;
        color: var(--w-muted);
      }

      .ecm-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .ecm-icon-btn {
        background: transparent;
        border: none;
        color: var(--w-muted);
        width: 28px;
        height: 28px;
        border-radius: var(--w-r-btn);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease, background-color 0.15s ease;
      }
      .ecm-icon-btn:hover {
        color: var(--w-ink);
        background-color: rgba(0, 0, 0, 0.05);
      }

      /* Область сообщений */
      .ecm-stream {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Пузыри сообщений */
      .ecm-msg {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-width: 90%;
        animation: ecmFadeIn 0.18s ease-out;
      }
      @keyframes ecmFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .ecm-msg.user {
        align-self: flex-end;
      }
      .ecm-msg.bot {
        align-self: flex-start;
        width: 100%;
        max-width: 100%;
      }

      .ecm-user-text {
        background: var(--w-card);
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-btn);
        padding: 9px 13px;
        font-size: 14.5px;
        color: var(--w-ink);
        white-space: pre-wrap;
        line-height: 1.45;
        word-break: break-word;
      }

      /* Бланк Заказ-наряда */
      .ecm-order-card {
        background: var(--w-card);
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-card);
        overflow: hidden;
        margin-top: 4px;
      }

      .ecm-order-meta {
        background: var(--w-panel);
        border-bottom: 1px solid var(--w-rule);
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 500;
        color: var(--w-muted);
        display: flex;
        justify-content: space-between;
      }

      .ecm-order-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13.5px;
      }

      .ecm-order-table td {
        padding: 9px 12px;
        border-bottom: 1px solid var(--w-rule);
        color: var(--w-ink);
      }

      .ecm-order-table td.col-price {
        text-align: right;
        font-family: var(--w-font-head);
        font-size: 16px;
        font-weight: 600;
        white-space: nowrap;
      }

      .ecm-row-upsell {
        background: ${theme.upsell_bg || 'rgba(245, 197, 24, 0.12)'};
      }

      .ecm-upsell-tag {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        color: ${theme.upsell_tag_color || '#FFFFFF'};
        background: ${theme.upsell_tag_bg || 'var(--w-accent)'};
        padding: 2px 7px;
        border-radius: 4px;
        margin-left: 6px;
        letter-spacing: 0.02em;
        text-shadow: ${theme.upsell_tag_shadow || 'none'};
        -webkit-text-stroke: ${theme.upsell_tag_stroke || 'none'};
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
      }

      .ecm-row-total {
        background: var(--w-panel);
        font-weight: 600;
        border-top: 1px solid var(--w-rule);
      }
      .ecm-row-total td {
        border-bottom: none;
        padding: 10px 12px;
      }
      .ecm-row-total .col-price {
        font-size: 18px;
        color: var(--w-ink);
      }

      .ecm-hold-banner {
        padding: 7px 12px;
        background: ${theme.hold_bg || 'rgba(27, 110, 68, 0.08)'};
        border-top: 1px solid var(--w-rule);
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: ${theme.hold_text || 'var(--w-ok)'};
        font-weight: 500;
      }

      /* Индикатор набора */
      .ecm-typing {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--w-card);
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-btn);
        padding: 8px 12px;
      }
      .ecm-typing-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--w-muted);
        animation: ecmBounce 1.2s infinite ease-in-out both;
      }
      .ecm-typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .ecm-typing-dot:nth-child(2) { animation-delay: -0.16s; }
      .ecm-typing-dot:nth-child(3) { animation-delay: 0s; }
      @keyframes ecmBounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
        40% { transform: scale(1.1); opacity: 1; background: var(--w-ink); }
      }

      /* Чипы быстрых вопросов */
      .ecm-chips-strip {
        padding: 0 14px 8px 14px;
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .ecm-chips-strip::-webkit-scrollbar { display: none; }

      .ecm-chip-btn {
        background: var(--w-card);
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-btn);
        padding: 5px 10px;
        font-size: 12px;
        color: var(--w-ink);
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 0.15s ease;
      }
      .ecm-chip-btn:hover {
        background-color: var(--w-panel);
      }

      /* Поле ввода */
      .ecm-footer {
        padding: 10px 14px;
        background: var(--w-card);
        border-top: 1px solid var(--w-rule);
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .ecm-input {
        flex: 1;
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-btn);
        padding: 8px 12px;
        font-family: inherit;
        font-size: 16px; /* Предотвращает зум в iOS Safari */
        color: var(--w-ink);
        background: var(--w-panel);
        outline: none;
      }
      .ecm-input:focus {
        border-color: var(--w-ink);
      }

      .ecm-send {
        background: var(--w-accent);
        color: var(--w-accent-ink);
        border: 1px solid var(--w-rule);
        border-radius: var(--w-r-btn);
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: opacity 0.15s ease;
      }
      .ecm-send:hover {
        opacity: 0.9;
      }
      .ecm-send:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      /* Мобильный полноэкранный лист (< 640px) */
      @media (max-width: 640px) {
        .ecm-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          max-width: none;
          max-height: none;
          border-radius: 0;
        }
        .ecm-chat-window {
          border-radius: 0;
          border: none;
        }
        .ecm-footer {
          padding-bottom: env(safe-area-inset-bottom, 12px);
        }
      }
    `;
  }

  // ─── 7. ГЕНЕРАЦИЯ HTML ДИАЛОГА ────────────────────────────────────
  function buildOrderCardHtml(carModel, carClass, basePrice, upsellPrice, totalPrice, slot, serviceName, upsellName) {
    const sName = serviceName || 'Восстановительная полировка кузова';
    const uName = upsellName || 'Нанокерамика 9H (2 слоя)';
    const bPrice = Number(basePrice) || 18000;
    const uPrice = Number(upsellPrice) || 25000;
    const tPrice = Number(totalPrice) || (bPrice + uPrice);
    return `
      <div class="ecm-order-card">
        <div class="ecm-order-meta">
          <span>Предварительный заказ-наряд</span>
          <span class="tabular">${carModel} • ${carClass}</span>
        </div>
        <table class="ecm-order-table">
          <tbody>
            <tr>
              <td>${sName}</td>
              <td class="col-price">${bPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
            </tr>
            <tr class="ecm-row-upsell">
              <td>
                ${uName}
                <span class="ecm-upsell-tag">+${uPrice.toLocaleString('ru-RU')}&nbsp;₽ к заказу</span>
              </td>
              <td class="col-price">+${uPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
            </tr>
            <tr>
              <td>Гидрофобный антидождь передней полусферы</td>
              <td class="col-price" style="color: var(--w-ok); font-size: 13px;">0&nbsp;₽ (в подарок)</td>
            </tr>
            <tr class="ecm-row-total">
              <td>Итого с допродажей:</td>
              <td class="col-price">${tPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
            </tr>
          </tbody>
        </table>
        <div class="ecm-hold-banner">
          <span>Свободный слот: ${slot}</span>
          <span class="tabular">Окно брони: <span class="ecm-timer-val">15:00</span></span>
        </div>
      </div>
    `;
  }

  // ─── 8. СОЗДАНИЕ SHADOW DOM ХОСТА ─────────────────────────────────
  const host = document.createElement('div');
  host.id = 'ecm-ai-widget-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = generateStyles(activeTheme);
  shadow.appendChild(styleEl);

  const wrapper = document.createElement('div');
  wrapper.className = 'ecm-root';
  wrapper.innerHTML = `
    <!-- Floating Launcher (Фирменный значок с индикатором) -->
    <button class="ecm-floating-launcher" id="floatingLauncher" aria-label="Открыть диалог с ИИ-администратором" title="Открыть чат" aria-expanded="false">
      <div class="ecm-launcher-icon" id="floatingLauncherIcon">
        <img src="${ECM_LOGO_DATA_URI}" alt="ECM" class="ecm-launcher-logo">
      </div>
      <div class="ecm-launcher-dot" id="floatingLauncherDot"></div>
    </button>

    <!-- Floating Modal Container -->
    <div class="ecm-modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-label="Чат с администратором">
      <div class="ecm-chat-window" id="floatingChatWindow">
        <!-- Будет заполняться динамически -->
      </div>
    </div>
  `;
  shadow.appendChild(wrapper);

  // ─── 9. ЛОГИКА ДИАЛОГА И СМЕТЫ ────────────────────────────────────
  function getInitialMessages() {
    return [
      {
        role: 'bot',
        isEstimate: false,
        text: `Здравствуйте! Я ИИ-администратор детейлинг-центра «${STUDIO_CONFIG.company_name}».\n\nРассчитаю точную смету под ваш автомобиль, помогу с выбором комплекса (полировка, нанокерамика, оклейка PPF, химчистка) и забронирую свободный слот. Напишите вашу модель авто или выберите вопрос ниже!`
      }
    ];
  }

  let messages = getInitialMessages();

  function renderMessagesInto(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    messages.forEach((m) => {
      const msgRow = document.createElement('div');
      msgRow.className = `ecm-msg ${m.role}`;

      if (m.role === 'user') {
        msgRow.innerHTML = `<div class="ecm-user-text">${m.text}</div>`;
      } else if (m.isEstimate) {
        msgRow.innerHTML = buildOrderCardHtml(m.carModel, m.carClass, m.basePrice, m.upsellPrice, m.totalPrice, m.slot, m.serviceName, m.upsellName);
      } else {
        msgRow.innerHTML = `<div class="ecm-user-text" style="background:var(--w-card); white-space:pre-wrap; line-height:1.45;">${m.text}</div>`;
      }
      containerEl.appendChild(msgRow);
    });

    containerEl.scrollTop = containerEl.scrollHeight;
  }

  // ─── 10. МОНТИРОВАНИЕ В ИНЛАЙН-РЕЖИМЕ (HERO #ECM-DEMO) ────────────
  const inlineContainer = document.getElementById('ecm-demo');
  let isFloatingOpen = false;

  const floatingLauncher = shadow.getElementById('floatingLauncher');
  const modalOverlay = shadow.getElementById('modalOverlay');
  const floatingChatWindow = shadow.getElementById('floatingChatWindow');

  function buildChatWindowMarkup(isInline) {
    return `
      <div class="ecm-header">
        <div class="ecm-header-left">
          <div class="ecm-avatar">
            <img src="${ECM_LOGO_DATA_URI}" alt="ECM">
          </div>
          <div>
            <div class="ecm-title">${STUDIO_CONFIG.company_name}</div>
            <div class="ecm-sub">Заказ-наряд • Онлайн</div>
          </div>
        </div>
        <div class="ecm-actions">
          <button class="ecm-icon-btn reset-btn" title="Сбросить диалог">${SVG_RESET}</button>
          ${!isInline ? `<button class="ecm-icon-btn close-btn" title="Закрыть">${SVG_CLOSE}</button>` : ''}
        </div>
      </div>

      <div class="ecm-stream" aria-live="polite"></div>

      <div class="ecm-chips-strip">
        ${STUDIO_CONFIG.quick_prompts.map(q => `<button class="ecm-chip-btn">${q}</button>`).join('')}
      </div>

      <div class="ecm-footer">
        <input type="text" class="ecm-input" placeholder="Напишите вопрос или модель авто..." aria-label="Сообщение">
        <button class="ecm-send" title="Отправить" aria-label="Отправить">${SVG_SEND}</button>
      </div>
    `;
  }

  // Настройка плавающего окна
  floatingChatWindow.innerHTML = buildChatWindowMarkup(false);
  const floatingStream = floatingChatWindow.querySelector('.ecm-stream');
  const floatingInput = floatingChatWindow.querySelector('.ecm-input');
  const floatingSend = floatingChatWindow.querySelector('.ecm-send');
  const floatingClose = floatingChatWindow.querySelector('.close-btn');
  const floatingReset = floatingChatWindow.querySelector('.reset-btn');

  // Если есть инлайн-контейнер в Hero: встраиваем полнофункциональный инлайн виджет
  let inlineStream = null;
  let inlineInput = null;
  let inlineSend = null;

  if (inlineContainer) {
    // Монтируем инлайн структуру в теневой DOM или контейнер
    const inlineHost = document.createElement('div');
    inlineHost.id = 'ecm-inline-shadow-host';
    inlineHost.style.width = '100%';
    inlineHost.style.height = '100%';
    inlineContainer.innerHTML = '';
    inlineContainer.appendChild(inlineHost);

    const inlineShadow = inlineHost.attachShadow({ mode: 'open' });
    const inlineStyle = document.createElement('style');
    inlineStyle.textContent = generateStyles(activeTheme);
    inlineShadow.appendChild(inlineStyle);

    const inlineWin = document.createElement('div');
    inlineWin.className = 'ecm-chat-window';
    inlineWin.innerHTML = buildChatWindowMarkup(true);
    inlineShadow.appendChild(inlineWin);

    inlineStream = inlineWin.querySelector('.ecm-stream');
    inlineInput = inlineWin.querySelector('.ecm-input');
    inlineSend = inlineWin.querySelector('.ecm-send');
    const inlineReset = inlineWin.querySelector('.reset-btn');

    // Чипы в инлайне
    inlineWin.querySelectorAll('.ecm-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => handleUserSend(btn.textContent.trim()));
    });

    inlineSend.addEventListener('click', () => {
      if (inlineInput.value.trim()) {
        handleUserSend(inlineInput.value.trim());
        inlineInput.value = '';
      }
    });

    inlineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inlineInput.value.trim()) {
          handleUserSend(inlineInput.value.trim());
          inlineInput.value = '';
        }
      }
    });

    inlineReset.addEventListener('click', () => {
      resetConversation();
    });

// Плавающая кнопка всегда видна статично (без скрытия по скроллу)
  }

  // Чипы в плавающем окне
  floatingChatWindow.querySelectorAll('.ecm-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => handleUserSend(btn.textContent.trim()));
  });

  floatingSend.addEventListener('click', () => {
    if (floatingInput.value.trim()) {
      handleUserSend(floatingInput.value.trim());
      floatingInput.value = '';
    }
  });

  floatingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (floatingInput.value.trim()) {
        handleUserSend(floatingInput.value.trim());
        floatingInput.value = '';
      }
    }
  });

  if (floatingClose) {
    floatingClose.addEventListener('click', () => toggleFloating(false));
  }
  if (floatingReset) {
    floatingReset.addEventListener('click', () => resetConversation());
  }

  function toggleFloating(force) {
    isFloatingOpen = (typeof force === 'boolean') ? force : !isFloatingOpen;
    const icon = shadow.getElementById('floatingLauncherIcon');
    if (isFloatingOpen) {
      modalOverlay.classList.add('open');
      floatingLauncher.classList.add('is-open');
      floatingLauncher.setAttribute('aria-expanded', 'true');
      if (icon) icon.innerHTML = SVG_CLOSE;
      renderAllStreams();
      setTimeout(() => floatingInput.focus(), 150);
    } else {
      modalOverlay.classList.remove('open');
      floatingLauncher.classList.remove('is-open');
      floatingLauncher.setAttribute('aria-expanded', 'false');
      if (icon) icon.innerHTML = `<img src="${ECM_LOGO_DATA_URI}" alt="ECM" class="ecm-launcher-logo">`;
      floatingLauncher.focus();
    }
  }

  floatingLauncher.addEventListener('click', () => toggleFloating());

  // Закрытие по клавише Esc
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFloatingOpen) {
      toggleFloating(false);
    }
  });

  function renderAllStreams() {
    if (inlineStream) renderMessagesInto(inlineStream);
    if (floatingStream) renderMessagesInto(floatingStream);
  }

  function resetConversation() {
    try {
      localStorage.removeItem(USAGE_KEY);
      localStorage.removeItem(MSGS_KEY);
    } catch(e) {}
    messages = getInitialMessages();
    renderAllStreams();
  }

  // ─── 11. ИНТЕЛЛЕКТУАЛЬНЫЙ AI-ОТВЕТЧИК ДЛЯ ЧАТА ─────────────────────

  function stripCodePieces(text) {
    if (!text) return '';
    let clean = text.replace(/```[a-z]*[\s\S]*?```/gi, '');
    clean = clean.replace(/```[a-z]*/gi, '');
    // Удаляем любые остатки JSON сметы из видимого сообщения
    let idx = clean.indexOf('{"isEstimate"');
    if (idx === -1) idx = clean.indexOf('{ "isEstimate"');
    if (idx !== -1) clean = clean.substring(0, idx);
    return clean.trim();
  }

  function extractEstimate(rawText, userText) {
    if (!rawText && !userText) return null;

    // 1. Полноценный JSON из ответа ИИ
    if (rawText) {
      const jsonMatch = rawText.match(/\{[\s\S]*"isEstimate"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.isEstimate || parsed.carModel)) {
            return {
              isEstimate: true,
              carModel: parsed.carModel || 'Автомобиль',
              carClass: parsed.carClass || 'Расчёт по прайсу',
              serviceName: parsed.serviceName || 'Восстановительная полировка кузова',
              basePrice: Number(parsed.basePrice) || 18000,
              upsellName: parsed.upsellName || 'Нанокерамика 9H (2 слоя)',
              upsellPrice: Number(parsed.upsellPrice) || 25000,
              totalPrice: Number(parsed.totalPrice) || 43000,
              slot: parsed.slot || 'суббота 14:00'
            };
          }
        } catch (e) {}
      }

      // 2. Если JSON был обрезан нейросетью
      const cutMatch = rawText.match(/\{[\s\S]*"isEstimate"[\s\S]*/);
      if (cutMatch) {
        const cutStr = cutMatch[0];
        const carM = cutStr.match(/"carModel":\s*"([^"]+)"/);
        const clsM = cutStr.match(/"carClass":\s*"([^"]+)"/);
        const srvM = cutStr.match(/"serviceName":\s*"([^"]+)"/);
        const bpM = cutStr.match(/"basePrice":\s*(\d+)/);
        const upM = cutStr.match(/"upsellPrice":\s*(\d+)/);
        const tpM = cutStr.match(/"totalPrice":\s*(\d+)/);
        const slotM = cutStr.match(/"slot":\s*"([^"]+)"/);

        if (carM || bpM) {
          const bp = bpM ? Number(bpM[1]) : 75000;
          const up = upM ? Number(upM[1]) : 30000;
          const tp = tpM ? Number(tpM[1]) : (bp + up);
          return {
            isEstimate: true,
            carModel: carM ? carM[1] : 'Mercedes GLE',
            carClass: clsM ? clsM[1] : 'Внедорожник',
            serviceName: srvM ? srvM[1] : 'Оклейка зон риска пленкой PPF',
            basePrice: bp,
            upsellName: 'Нанокерамика 9H на кузов',
            upsellPrice: up,
            totalPrice: tp,
            slot: slotM ? slotM[1] : 'суббота 14:00'
          };
        }
      }
    }

    // 3. Автоматический интеллектуальный расчёт сметы по автомобилю
    const low = ((userText || '') + ' ' + (rawText || '')).toLowerCase();

    // Чистые вопросы без машины не требуют принудительной сметы
    if (low.includes('помоги') || low.includes('с выбором') || low.includes('где вы') || low.includes('адрес') || low.includes('как доехать')) {
      return null;
    }

    const isPPF = low.includes('ppf') || low.includes('пленк') || low.includes('оклейк') || low.includes('брон');
    const isClean = low.includes('химчист') || low.includes('салон');
    const isEstimateQuery = isPPF || isClean || low.includes('полиров') || low.includes('керамик') || low.includes('царапин') || low.includes('глянец') || low.includes('цен') || low.includes('стоимост') || low.includes('расчет') || low.includes('сколько');

    let carModel = null;
    let carClass = 'Седан';

    if (low.includes('gle') || low.includes('gls') || low.includes('x5') || low.includes('x7') || low.includes('land cruiser') || low.includes('крузак') || low.includes('prado') || low.includes('tahoe') || low.includes('escalade') || low.includes('defender') || low.includes('range rover') || low.includes('внедорожник') || low.includes('джип')) {
      carClass = 'Внедорожник';
      if (low.includes('gle')) carModel = 'Mercedes GLE';
      else if (low.includes('gls')) carModel = 'Mercedes GLS';
      else if (low.includes('x5')) carModel = 'BMW X5';
      else if (low.includes('x7')) carModel = 'BMW X7';
      else if (low.includes('land cruiser') || low.includes('крузак')) carModel = 'Toyota Land Cruiser';
      else carModel = 'Внедорожник';
    } else if (low.includes('macan') || low.includes('cayenne') || low.includes('x3') || low.includes('x4') || low.includes('q5') || low.includes('q7') || low.includes('glc') || low.includes('tiguan') || low.includes('rav4') || low.includes('monjaro') || low.includes('geely') || low.includes('haval') || low.includes('cheri') || low.includes('changan') || low.includes('sportage') || low.includes('tucson') || low.includes('кроссовер')) {
      carClass = 'Кроссовер';
      if (low.includes('macan')) carModel = 'Porsche Macan';
      else if (low.includes('cayenne')) carModel = 'Porsche Cayenne';
      else if (low.includes('x3')) carModel = 'BMW X3';
      else if (low.includes('q5')) carModel = 'Audi Q5';
      else if (low.includes('glc')) carModel = 'Mercedes GLC';
      else if (low.includes('monjaro')) carModel = 'Geely Monjaro';
      else if (low.includes('tiguan')) carModel = 'VW Tiguan';
      else if (low.includes('rav4')) carModel = 'Toyota RAV4';
      else carModel = 'Кроссовер';
    } else if (low.includes('camry') || low.includes('f10') || low.includes('bmw') || low.includes('audi') || low.includes('mercedes') || low.includes('мерседес') || low.includes('solaris') || low.includes('rio') || low.includes('polo') || low.includes('k5') || low.includes('octavia') || low.includes('седан') || low.includes('купе')) {
      carClass = 'Седан';
      if (low.includes('camry')) carModel = 'Toyota Camry';
      else if (low.includes('k5')) carModel = 'Kia K5';
      else if (low.includes('octavia')) carModel = 'Skoda Octavia';
      else if (low.includes('f10')) carModel = 'BMW F10';
      else if (low.includes('bmw')) carModel = 'BMW (Седан)';
      else if (low.includes('mercedes') || low.includes('мерседес')) carModel = 'Mercedes E-Class';
      else carModel = 'Седан / Купе';
    }

    if (!carModel && !isEstimateQuery) {
      return null;
    }

    carModel = carModel || 'Автомобиль клиента';

    if (isPPF) {
      const bp = (carClass === 'Седан') ? 65000 : 75000;
      const up = (carClass === 'Седан') ? 25000 : 30000;
      return {
        isEstimate: true,
        carModel: carModel,
        carClass: carClass,
        serviceName: 'Оклейка зон риска пленкой PPF',
        basePrice: bp,
        upsellName: 'Нанокерамика 9H на остальной кузов',
        upsellPrice: up,
        totalPrice: bp + up,
        slot: 'суббота 14:00'
      };
    }

    if (isClean) {
      const bp = (carClass === 'Седан') ? 15000 : 18000;
      return {
        isEstimate: true,
        carModel: carModel,
        carClass: carClass,
        serviceName: 'Полная химчистка салона',
        basePrice: bp,
        upsellName: 'Озонирование + защитная пропитка',
        upsellPrice: 8000,
        totalPrice: bp + 8000,
        slot: 'суббота 14:00'
      };
    }

    // Комплекс полировка + нанокерамика
    const bp = (carClass === 'Внедорожник') ? 26000 : ((carClass === 'Кроссовер') ? 22000 : 18000);
    const up = (carClass === 'Седан') ? 25000 : 30000;
    return {
      isEstimate: true,
      carModel: carModel,
      carClass: carClass,
      serviceName: 'Комплексная восстановительная полировка кузова',
      basePrice: bp,
      upsellName: 'Нанокерамика 9H (2 слоя)',
      upsellPrice: up,
      totalPrice: bp + up,
      slot: 'суббота 14:00'
    };
  }

  function getSmartFallback(text) {
    const low = text.toLowerCase();
    if (low.includes('gle') || low.includes('мерседес') || low.includes('mercedes') || low.includes('джип') || low.includes('внедорожник')) {
      return {
        text: 'Для внедорожников класса Mercedes GLE рекомендуем комплексную оклейку зон риска защитной пленкой PPF (75 000 ₽) с нанесением керамики на оставшийся кузов (+30 000 ₽). Нанесение гидрофобного антидождя на переднюю полусферу — бесплатно в подарок по акции!\n\nБлижайший свободный слот: суббота в 14:00.',
        rawText: '{"isEstimate": true, "carModel": "Mercedes GLE", "carClass": "Внедорожник", "serviceName": "Оклейка зон риска пленкой PPF", "basePrice": 75000, "upsellName": "Нанокерамика 9H на остальной кузов", "upsellPrice": 30000, "totalPrice": 105000, "slot": "суббота 14:00"}'
      };
    }
    if (low.includes('выбор') || low.includes('помог') || low.includes('посовету') || low.includes('подскаж') || low.includes('что лучше')) {
      return {
        text: 'С удовольствием помогу подобрать оптимальный комплекс услуг!\n\nПодскажите, пожалуйста:\n1. Марку и модель вашего автомобиля?\n2. Автомобиль новый из салона или с пробегом?\n3. Какую задачу в первую очередь хотите решить: защитить кузов от сколов (пленка PPF), убрать царапины и вернуть блеск (полировка + керамика) или обновить салон (химчистка)?'
      };
    }
    if (low.includes('где') || low.includes('адрес') || low.includes('находит') || low.includes('город') || low.includes('как доехать')) {
      return {
        text: `Наш детейлинг-центр находится по адресу: ${STUDIO_CONFIG.city}. Работаем ежедневно по предварительной записи. Подсказать по услугам или подобрать время?`
      };
    }
    if (low.includes('суббот') || low.includes('запис') || low.includes('окно') || low.includes('время') || low.includes('брон') || low.includes('свобод')) {
      return {
        text: 'На ближайшую субботу доступен свободный слот в 14:00 (мастер второй смены). Напишите ваш номер телефона и модель автомобиля для фиксации брони на 15 минут.'
      };
    }
    if (low.includes('f10') || low.includes('bmw') || low.includes('седан') || low.includes('полировк')) {
      return {
        text: 'Для седанов стоимость восстановительной полировки кузова — 18 000 ₽. Рекомендуем закрепить блеск 2 слоями нанокерамики 9H (+25 000 ₽), при этом гидрофобный антидождь идет в подарок по акции!',
        rawText: '{"isEstimate": true, "carModel": "BMW / Седан", "carClass": "Седан", "serviceName": "Комплексная восстановительная полировка кузова", "basePrice": 18000, "upsellName": "Нанокерамика 9H (2 слоя)", "upsellPrice": 25000, "totalPrice": 43000, "slot": "суббота 14:00"}'
      };
    }
    return {
      text: 'Здравствуйте! Я онлайн-консультант детейлинг-центра. Подскажите марку и модель вашего автомобиля или интересующую услугу (полировка, нанокерамика, оклейка PPF, химчистка), и я подробно проконсультирую и сделаю точный расчет сметы.'
    };
  }

  async function queryAi(promptText, chatHistory) {
    // 1. Попытка запроса через бэкенд FastAPI (/api/chat), если запущен локально
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studio_id: STUDIO_CONFIG.studio_id || 'default',
            session_id: SESSION_KEY,
            message: promptText
          }),
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) {
            return {
              text: stripCodePieces(data.reply),
              rawText: data.reply
            };
          }
        }
      }
    } catch (e) {
      // Игнорируем и переходим к прямому вызову Gemini
    }

    // 2. Прямой вызов Google Gemini API через DEFAULT_KEY (работает и на GitHub Pages, и локально)
    if (DEFAULT_KEY) {
      try {
        const sysInstruction = `
Ты — опытный, вежливый и профессиональный старший администратор детейлинг-центра «${STUDIO_CONFIG.company_name}».
Адрес студии: ${STUDIO_CONFIG.city}.
ТВОЙ ТОН: деловой, спокойный, лаконичный, стиль премиум-сервиса заказ-наряда. Без восклицаний и лишних эмодзи.

УСЛУГИ И ПРАЙС:
- Седан / Купе (BMW 3/5, Camry, Mercedes E/C, Audi A4/A6, Polo, Solaris): Полировка 18 000 ₽, Керамика 9H (2 слоя) +25 000 ₽, Оклейка PPF от 65 000 ₽, Химчистка салона 15 000 ₽.
- Кроссовер (BMW X3, Audi Q5, Mercedes GLC, Tiguan, Monjaro, Macan): Полировка 22 000 ₽, Керамика 9H +30 000 ₽, Оклейка PPF от 75 000 ₽, Химчистка 18 000 ₽.
- Внедорожник / Джип (BMW X5/X7, Mercedes GLE/GLS, Land Cruiser, Tahoe): Полировка 26 000 ₽, Керамика 9H +30 000 ₽, Оклейка PPF от 75 000 ₽, Химчистка 18 000 ₽.
АКЦИЯ И БОНУС:
При заказе комплекса (полировка + керамика или оклейка PPF) — нанесение гидрофобного антидождя на переднюю полусферу бесплатно (0 ₽ в подарок).
СВОБОДНЫЙ СЛОТ ДЛЯ ЗАПИСИ: суббота в 14:00 (удержание окна 15 минут).

СТРОГИЕ ПРАВИЛА:
1. ПРИОРИТЕТ ТЕКУЩЕГО ЗАПРОСА (ГЛАВНОЕ ПРАВИЛО):
   - Отвечай СТРОГО на ПОСЛЕДНЕЕ сообщение клиента!
   - Если клиент спрашивает про Mercedes GLE — отвечай ИСКЛЮЧИТЕЛЬНО про Mercedes GLE!
   - Если клиент спрашивает про Macan, Camry или любую другую машину — отвечай ИСКЛЮЧИТЕЛЬНО по ней!
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО упоминать BMW F10 или другие ранее упомянутые автомобили, если клиент о них не спрашивает в текущем сообщении.
   - Если клиент выбрал «Хочу PPF на Mercedes GLE»:
     * Класс: Внедорожник / Джип.
     * Стоимость оклейки зон риска PPF: 75 000 ₽.
     * Допродажа: нанокерамика 9H на остальной кузов +30 000 ₽ (антидождь передней полусферы 0 ₽ в подарок). Итого: 105 000 ₽.
     * Бланк JSON в конце строки строй СТРОГО на Mercedes GLE:
       {"isEstimate": true, "carModel": "Mercedes GLE", "carClass": "Внедорожник", "serviceName": "Оклейка зон риска пленкой PPF", "basePrice": 75000, "upsellName": "Нанокерамика 9H на кузов", "upsellPrice": 30000, "totalPrice": 105000, "slot": "суббота 14:00"}
2. КОНСУЛЬТАЦИЯ И ВЫБОР:
   Если клиент просит помочь с выбором («помоги мне с выбором», «что посоветуете», «какие услуги»):
   - Спокойно и по-человечески проконсультируй!
   - Уточни марку/модель авто, состояние (новое или с пробегом), и какую главную задачу хочет решить клиент.
   - СТРОГО: НЕ выдавай бланк сметы, пока клиент не спросит конкретный расчет на конкретный автомобиль!
3. РАСЧЁТ НА ДРУГИЕ АВТО:
   Если клиент спрашивает стоимость на другую модель — определи её класс, назови цены и в самом конце ответа добавь одну строчку JSON сметы строго на эту модель.
4. АДРЕС И ВОПРОСЫ:
   Если клиент спрашивает адрес или как доехать — назови адрес (${STUDIO_CONFIG.city}).
5. ЗАПИСЬ:
   Если клиент пишет номер телефона или просит записать — подтверди бронь на 15 минут.
`.trim();

        const contents = [];
        let lastRole = null;
        const recent = (chatHistory || []).slice(-6);
        for (const m of recent) {
          if (m.role === 'user' && m.text && !m.text.includes('BMW F10')) {
            if (lastRole === 'user') {
              contents[contents.length - 1].parts[0].text += '\n' + m.text;
            } else {
              contents.push({ role: 'user', parts: [{ text: m.text }] });
              lastRole = 'user';
            }
          } else if (m.role === 'bot') {
            const bText = m.text || (m.isEstimate ? `[Смета: ${m.carModel} (${m.carClass}), ${m.serviceName} ${m.basePrice} ₽, ${m.upsellName} ${m.upsellPrice} ₽, Итого ${m.totalPrice} ₽]` : '');
            if (bText && !bText.includes('BMW F10')) {
              if (lastRole === 'model') {
                contents[contents.length - 1].parts[0].text += '\n' + bText;
              } else if (contents.length > 0) {
                contents.push({ role: 'model', parts: [{ text: bText }] });
                lastRole = 'model';
              }
            }
          }
        }
        if (lastRole === 'user') {
          contents[contents.length - 1].parts[0].text += '\n' + promptText;
        } else {
          contents.push({ role: 'user', parts: [{ text: promptText }] });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${DEFAULT_KEY}`;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 7500);
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysInstruction }] },
            contents: contents,
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 1200
            }
          }),
          signal: ctrl.signal
        });
        clearTimeout(tid);

        if (res.ok) {
          const gData = await res.json();
          const cand = gData.candidates && gData.candidates[0];
          const textPart = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
          if (textPart) {
            const cleanT = stripCodePieces(textPart.trim());
            return {
              text: cleanT,
              rawText: textPart.trim()
            };
          }
        }
      } catch (e) {
        console.warn('[ECM Widget] Gemini direct call notice:', e);
      }
    }

    // 3. Умный контекстный оффлайн-фоллбэк
    return getSmartFallback(promptText);
  }

  async function handleUserSend(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Лимит сообщений в демо
    const count = incrementMessageCount();
    if (count > MAX_DEMO_MESSAGES) {
      messages.push({ role: 'user', text: trimmed });
      messages.push({
        role: 'bot',
        isEstimate: false,
        text: 'В демо доступно 50 сообщений. Для сброса нажмите кнопку «Обновить диалог» в шапке или напишите основателю: @godblessed77'
      });
      renderAllStreams();
      return;
    }

    messages.push({ role: 'user', text: trimmed });
    renderAllStreams();

    // Показываем индикатор набора
    showTyping();

    // Запрос к AI (Gemini / Backend)
    const rawResult = await queryAi(trimmed, messages);
    hideTyping();

    const cleanText = stripCodePieces(rawResult.text);
    const estimate = extractEstimate(rawResult.rawText || rawResult.text, trimmed) || rawResult.estimate;

    if (cleanText) {
      messages.push({
        role: 'bot',
        isEstimate: false,
        text: cleanText
      });
    }

    if (estimate) {
      messages.push({
        role: 'bot',
        isEstimate: true,
        carModel: estimate.carModel || 'Автомобиль',
        carClass: estimate.carClass || 'Расчёт по прайсу',
        serviceName: estimate.serviceName || 'Комплексная восстановительная полировка кузова',
        basePrice: Number(estimate.basePrice) || 18000,
        upsellName: estimate.upsellName || 'Нанокерамика 9H (2 слоя)',
        upsellPrice: Number(estimate.upsellPrice) || 25000,
        totalPrice: Number(estimate.totalPrice) || 43000,
        slot: estimate.slot || 'суббота 14:00'
      });

      try {
        window.dispatchEvent(new CustomEvent('ecm-lead-created', {
          detail: {
            client: 'Посетитель сайта',
            contact: 'Онлайн-диалог',
            car: `${estimate.carModel} (${estimate.carClass})`,
            service: `${estimate.serviceName || 'Полировка'} + ${estimate.upsellName || 'Керамика'}`,
            cost: `${Number(estimate.totalPrice || 43000).toLocaleString('ru-RU')} ₽`,
            source: 'Виджет на сайте',
            status: 'Новая заявка'
          }
        }));
      } catch (e) {}
    }

    renderAllStreams();
  }

  function showTyping() {
    const dotsHtml = `
      <div class="ecm-msg bot typing-msg">
        <div class="ecm-typing">
          <span class="ecm-typing-dot"></span>
          <span class="ecm-typing-dot"></span>
          <span class="ecm-typing-dot"></span>
        </div>
      </div>
    `;
    if (inlineStream) {
      inlineStream.insertAdjacentHTML('beforeend', dotsHtml);
      inlineStream.scrollTop = inlineStream.scrollHeight;
    }
    if (floatingStream) {
      floatingStream.insertAdjacentHTML('beforeend', dotsHtml);
      floatingStream.scrollTop = floatingStream.scrollHeight;
    }
  }

  function hideTyping() {
    if (inlineStream) {
      const el = inlineStream.querySelector('.typing-msg');
      if (el) el.remove();
    }
    if (floatingStream) {
      const el = floatingStream.querySelector('.typing-msg');
      if (el) el.remove();
    }
  }

  // ─── 12. АВТОПЛЕЙ ПРИ СТАРТЕ (C УВАЖЕНИЕМ К REDUCED MOTION) ────────
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function runAutoplay() {
    messages = getInitialMessages();
    renderAllStreams();
  }

  // ─── 13. ПУБЛИЧНЫЙ API WINDOW.ECMWIDGET ────────────────────────────
  window.EcmWidget = {
    setTheme: function (themeNameOrTokens) {
      if (typeof themeNameOrTokens === 'string') {
        if (THEMES[themeNameOrTokens]) {
          activeTheme = THEMES[themeNameOrTokens];
        }
      } else if (typeof themeNameOrTokens === 'object' && themeNameOrTokens !== null) {
        activeTheme = Object.assign({}, activeTheme, themeNameOrTokens);
      }

      const newCss = generateStyles(activeTheme);
      styleEl.textContent = newCss;

      // Обновляем инлайн стили
      const inlineHost = document.getElementById('ecm-inline-shadow-host');
      if (inlineHost && inlineHost.shadowRoot) {
        const s = inlineHost.shadowRoot.querySelector('style');
        if (s) s.textContent = newCss;
      }

      host.setAttribute('data-theme', activeTheme.name || 'custom');
    },

    sendMessage: function (text) {
      handleUserSend(text);
    },

    open: function () {
      toggleFloating(true);
    },

    close: function () {
      toggleFloating(false);
    }
  };

  window.openEcmWidget = function () {
    window.EcmWidget.open();
  };
  window.closeEcmWidget = function () {
    window.EcmWidget.close();
  };


  // ─── ТАЙМЕР ОКНА БРОНИ (15:00 ОБРАТНЫЙ ОТСЧЕТ) ───────────────────
  let holdCountdownSec = 15 * 60;
  let holdTimerInterval = null;

  function initHoldTimer() {
    if (holdTimerInterval) clearInterval(holdTimerInterval);
    holdTimerInterval = setInterval(() => {
      if (holdCountdownSec > 0) {
        holdCountdownSec -= 1;
      }
      const m = Math.floor(holdCountdownSec / 60);
      const s = holdCountdownSec % 60;
      const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      
      const updateElements = (root) => {
        if (!root) return;
        root.querySelectorAll('.ecm-timer-val').forEach(el => {
          el.textContent = formatted;
        });
      };

      updateElements(shadow);
      const inlineHost = document.getElementById('ecm-inline-shadow-host');
      if (inlineHost && inlineHost.shadowRoot) {
        updateElements(inlineHost.shadowRoot);
      }

      if (holdCountdownSec <= 0 && holdTimerInterval) {
        clearInterval(holdTimerInterval);
      }
    }, 1000);
  }

    // Наблюдатель за сменой темы сайта (Светлая / Тёмная)
  try {
    const siteThemeObserver = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute('data-site-theme') === 'dark';
      window.EcmWidget.setTheme(isDark ? 'dark' : 'epoxy');
    });
    siteThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-site-theme']
    });
  } catch(e) {}

  async function loadStudioPersonalization() {
    if (!STUDIO_CONFIG.studio_id || STUDIO_CONFIG.studio_id === 'default') return;
    try {
      const resp = await fetch(`/api/config/${STUDIO_CONFIG.studio_id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.company_name) {
          STUDIO_CONFIG.company_name = data.company_name;
          const titleEl = host && host.shadowRoot ? host.shadowRoot.querySelector('.ecm-title') : null;
          if (titleEl) titleEl.textContent = data.company_name;
          const pageTitle = document.getElementById('widgetStudioName');
          if (pageTitle) pageTitle.textContent = data.company_name;
        }
        if (data.services) STUDIO_CONFIG.services = data.services;
        if (data.city) STUDIO_CONFIG.city = data.city;
        if (data.promo) STUDIO_CONFIG.promo = data.promo;
        if (data.theme_color) {
          window.EcmWidget.setTheme({ accent: data.theme_color });
        }
      }
    } catch (e) {}
  }

  // Старт
  loadStudioPersonalization();
  initHoldTimer();
  runAutoplay();

  console.info('[ECM Widget] Workshop Order Edition initialized.');
})();
