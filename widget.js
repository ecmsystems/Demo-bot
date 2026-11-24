/**
 * Detailing Lab | Interactive Concierge Widget
 * Shadow DOM chat widget with inline Hero embedding, scroll-triggered floating mode,
 * smooth CSS-variable theming, typing/streaming replies, and CRM sync.
 */
(function () {
  'use strict';

  if (window.__ECM_WIDGET_INITIALIZED__) return;
  window.__ECM_WIDGET_INITIALIZED__ = true;

  // ─── 1. КОНФИГУРАЦИЯ СТУДИИ И ПРАЙС ──────────────────────────────
  const STUDIO_CONFIG = {
    studio_id: 'default',
    company_name: 'Detailing Lab',
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
      'Полировка кузова',
      'Оклейка PPF',
      'Керамика 9H'
    ]
  };

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const studioParam = urlParams.get('studio');
    if (studioParam) {
      STUDIO_CONFIG.studio_id = studioParam;
    }
  } catch (e) {}

  // ─── 2. СЕССИЯ И ЛИМИТЫ ДЕМО ──────────────────────────────────────
  const SESSION_KEY = `ecm_session_${STUDIO_CONFIG.studio_id}`;
  const MSGS_KEY = `ecm_msgs_${STUDIO_CONFIG.studio_id}`;
  const USAGE_KEY = `ecm_usage_${STUDIO_CONFIG.studio_id}`;
  const MAX_DEMO_MESSAGES = 500;

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

  // ─── 3. ТЕМЫ ВИДЖЕТА (ПЛАВНАЯ СМЕНА ПЕРЕМЕННЫХ) ───────────────────
  const THEMES = {
    dark: {
      name: 'dark',
      bg: '#0B0B0D',
      panel: '#0E0E11',
      card_bg: '#151519',
      elevated_bg: '#1B1B20',
      ink: '#F4F4F5',
      muted: '#A1A1AA',
      faint: '#71717A',
      rule: 'rgba(255, 255, 255, 0.08)',
      rule_strong: 'rgba(255, 255, 255, 0.14)',
      accent: '#F4F4F5',
      accent_ink: '#0B0B0D',
      champagne: '#D6B37C',
      upsell_bg: 'rgba(214, 179, 124, 0.07)',
      tag_bg: 'rgba(214, 179, 124, 0.14)',
      tag_ink: '#E5C694',
      tag_border: 'rgba(214, 179, 124, 0.28)',
      hold_bg: 'rgba(255, 255, 255, 0.025)',
      hold_ink: '#A1A1AA',
      avatar_bg: '#18181D',
      avatar_border: 'rgba(255, 255, 255, 0.12)',
      chip_bg: '#151519',
      chip_hover: '#1F1F25',
      input_bg: '#121215',
      radius_win: '10px',
      radius_card: '8px',
      radius_btn: '6px',
      font: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    },
    copper: {
      name: 'copper',
      bg: '#101012',
      panel: '#141417',
      card_bg: '#1C1C20',
      elevated_bg: '#242429',
      ink: '#F4F4F5',
      muted: '#A1A1AA',
      faint: '#787882',
      rule: 'rgba(214, 179, 124, 0.14)',
      rule_strong: 'rgba(214, 179, 124, 0.28)',
      accent: '#D6B37C',
      accent_ink: '#0B0B0D',
      champagne: '#E3C38E',
      upsell_bg: 'rgba(214, 179, 124, 0.1)',
      tag_bg: 'rgba(214, 179, 124, 0.18)',
      tag_ink: '#F0D4A6',
      tag_border: 'rgba(214, 179, 124, 0.36)',
      hold_bg: 'rgba(214, 179, 124, 0.06)',
      hold_ink: '#D6B37C',
      avatar_bg: 'rgba(214, 179, 124, 0.1)',
      avatar_border: 'rgba(214, 179, 124, 0.28)',
      chip_bg: '#1C1C20',
      chip_hover: '#26262C',
      input_bg: '#111114',
      radius_win: '10px',
      radius_card: '8px',
      radius_btn: '6px',
      font: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    },
    epoxy: {
      name: 'epoxy',
      bg: '#F2F2F5',
      panel: '#FAFAFC',
      card_bg: '#FFFFFF',
      elevated_bg: '#EFEFF3',
      ink: '#111113',
      muted: '#52525B',
      faint: '#71717A',
      rule: 'rgba(0, 0, 0, 0.08)',
      rule_strong: 'rgba(0, 0, 0, 0.16)',
      accent: '#111113',
      accent_ink: '#FFFFFF',
      champagne: '#8E6A33',
      upsell_bg: 'rgba(180, 138, 74, 0.08)',
      tag_bg: 'rgba(180, 138, 74, 0.14)',
      tag_ink: '#755320',
      tag_border: 'rgba(180, 138, 74, 0.3)',
      hold_bg: 'rgba(0, 0, 0, 0.03)',
      hold_ink: '#52525B',
      avatar_bg: '#EFEFF3',
      avatar_border: 'rgba(0, 0, 0, 0.1)',
      chip_bg: '#FFFFFF',
      chip_hover: '#EFEFF3',
      input_bg: '#F4F4F7',
      radius_win: '10px',
      radius_card: '8px',
      radius_btn: '6px',
      font: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }
  };

  let activeTheme = THEMES.dark;

  // ─── 4. SVG ИКОНКИ (СТРОГИЙ ТЕХНИЧЕСКИЙ МИНИМАЛИЗМ) ──────────────
  const SVG_CLOSE = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;

  const SVG_SEND = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  `;

  const SVG_RESET = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  `;

  const SVG_STUDIO_MARK = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 6H8C10.5 6 11.8 7.6 11.8 10.1V13.9C11.8 16.4 10.5 18 8 18H3.5Z" stroke="var(--w-ink, #F4F4F5)" stroke-width="2" stroke-linejoin="miter"/>
      <path d="M15.2 6V18H20.8" stroke="var(--w-champagne, #D6B37C)" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
    </svg>
  `;

  const SVG_LAUNCHER_CHAT = `
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;

  // ─── 5. СТИЛИ SHADOW DOM (ПЕРЕМЕННЫЕ И БАЗОВАЯ СТИЛИСТИКА) ────────
  function generateThemeVarsCss(theme) {
    return `
      :host {
        --w-bg: ${theme.bg};
        --w-panel: ${theme.panel};
        --w-card: ${theme.card_bg};
        --w-elevated: ${theme.elevated_bg};
        --w-ink: ${theme.ink};
        --w-muted: ${theme.muted};
        --w-faint: ${theme.faint};
        --w-rule: ${theme.rule};
        --w-rule-strong: ${theme.rule_strong};
        --w-accent: ${theme.accent};
        --w-accent-ink: ${theme.accent_ink};
        --w-champagne: ${theme.champagne};
        --w-upsell-bg: ${theme.upsell_bg};
        --w-tag-bg: ${theme.tag_bg};
        --w-tag-ink: ${theme.tag_ink};
        --w-tag-border: ${theme.tag_border};
        --w-hold-bg: ${theme.hold_bg};
        --w-hold-ink: ${theme.hold_ink};
        --w-avatar-bg: ${theme.avatar_bg};
        --w-avatar-border: ${theme.avatar_border};
        --w-chip-bg: ${theme.chip_bg};
        --w-chip-hover: ${theme.chip_hover};
        --w-input-bg: ${theme.input_bg};
        --w-r-win: ${theme.radius_win};
        --w-r-card: ${theme.radius_card};
        --w-r-btn: ${theme.radius_btn};
        --w-font: ${theme.font};
      }
    `;
  }

  const BASE_SHADOW_CSS = `
    :host {
      font-family: var(--w-font);
      color: var(--w-ink);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box;
      display: block;
      width: 100%;
      height: 100%;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: inherit;
    }

    .tabular {
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }

    /* Плавающий лаунчер: скрыт по умолчанию, появляется при скролле ниже Hero */
    .ecm-floating-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 52px;
      height: 52px;
      border-radius: 10px;
      background: rgba(18, 18, 22, 0.88);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow:
        inset 0 1px 0 0 rgba(255, 255, 255, 0.16),
        0 12px 32px rgba(0, 0, 0, 0.55);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(12px) scale(0.92);
      transition:
        opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
        visibility 0.25s ease,
        border-color 0.2s ease,
        background-color 0.2s ease;
      user-select: none;
      padding: 0;
      outline: none;
      color: #F4F4F5;
    }
    .ecm-floating-launcher.is-visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .ecm-floating-launcher.is-visible:hover {
      background: rgba(26, 26, 32, 0.94);
      border-color: rgba(214, 179, 124, 0.45);
      transform: translateY(-2px) scale(1);
    }
    .ecm-floating-launcher:focus-visible {
      outline: 2px solid #D6B37C;
      outline-offset: 3px;
    }

    .ecm-launcher-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ecm-launcher-dot {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #D6B37C;
      box-shadow: 0 0 0 2px rgba(18, 18, 22, 0.9);
    }
    .ecm-floating-launcher.is-open .ecm-launcher-dot {
      display: none;
    }

    /* Основное окно чата */
    .ecm-chat-window {
      background: var(--w-panel);
      border: 1px solid var(--w-rule);
      border-radius: var(--w-r-win);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      width: 100%;
      height: 100%;
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    /* Плавающее окно диалога */
    .ecm-modal-overlay {
      position: fixed;
      bottom: 88px;
      right: 24px;
      width: 396px;
      height: 580px;
      max-height: calc(100vh - 110px);
      max-width: calc(100vw - 32px);
      z-index: 2147483647;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
      border-radius: var(--w-r-win);
      display: flex;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(12px) scale(0.98);
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s ease;
    }
    .ecm-modal-overlay.open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    /* Шапка виджета */
    .ecm-header {
      background: var(--w-card);
      border-bottom: 1px solid var(--w-rule);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      transition: background-color 0.28s ease, border-color 0.28s ease;
    }

    .ecm-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .ecm-avatar {
      width: 32px;
      height: 32px;
      border-radius: var(--w-r-btn);
      background: var(--w-avatar-bg);
      border: 1px solid var(--w-avatar-border);
      color: var(--w-champagne);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    .ecm-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--w-ink);
      letter-spacing: -0.01em;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.28s ease;
    }

    .ecm-sub {
      font-size: 11.5px;
      color: var(--w-muted);
      display: flex;
      align-items: center;
      margin-top: 2px;
      transition: color 0.28s ease;
    }

    .ecm-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .ecm-icon-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--w-muted);
      width: 30px;
      height: 30px;
      border-radius: var(--w-r-btn);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
    }
    .ecm-icon-btn:hover {
      color: var(--w-ink);
      background-color: var(--w-elevated);
      border-color: var(--w-rule);
    }

    /* Поток сообщений: строго flex-start + отступ сверху, чтобы приветствие не обрезалось шапкой */
    .ecm-stream {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 18px 16px 16px 16px;
      scroll-padding-top: 18px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: var(--w-rule-strong) transparent;
    }
    .ecm-stream::-webkit-scrollbar {
      width: 5px;
    }
    .ecm-stream::-webkit-scrollbar-thumb {
      background: var(--w-rule-strong);
      border-radius: 999px;
    }

    /* Сообщения */
    .ecm-msg {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 90%;
      flex-shrink: 0;
      animation: ecmFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes ecmFadeIn {
      from { opacity: 0; transform: translateY(6px); }
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
      background: var(--w-elevated);
      border: 1px solid var(--w-rule);
      border-radius: 8px 8px 4px 8px;
      padding: 10px 14px;
      font-size: 13.5px;
      color: var(--w-ink);
      white-space: pre-wrap;
      line-height: 1.5;
      word-break: break-word;
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    .ecm-bot-bubble {
      background: var(--w-card);
      border: 1px solid var(--w-rule);
      border-radius: 8px 8px 8px 4px;
      padding: 11px 14px;
      font-size: 13.5px;
      color: var(--w-ink);
      white-space: pre-wrap;
      line-height: 1.52;
      word-break: break-word;
      max-width: 96%;
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    /* Компактная таблица сметы / тарифов в ответе бота */
    .ecm-breakdown-card {
      background: var(--w-card);
      border: 1px solid var(--w-rule);
      border-radius: var(--w-r-card);
      overflow: hidden;
      margin-top: 4px;
      max-width: 96%;
      transition: background-color 0.28s ease, border-color 0.28s ease;
    }
    .ecm-breakdown-card.is-staggered {
      animation: ecmFadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ecm-breakdown-card.is-staggered tr.stagger-row {
      opacity: 0;
      transform: translateY(5px);
      animation: ecmRowReveal 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .ecm-breakdown-card.is-staggered tr.stagger-1 { animation-delay: 40ms; }
    .ecm-breakdown-card.is-staggered tr.stagger-2 { animation-delay: 100ms; }
    .ecm-breakdown-card.is-staggered tr.stagger-3 { animation-delay: 160ms; }
    .ecm-breakdown-card.is-staggered tr.stagger-4 { animation-delay: 220ms; }
    .ecm-breakdown-card.is-staggered tr.stagger-5 { animation-delay: 280ms; }
    .ecm-breakdown-card.is-staggered tr.stagger-6 { animation-delay: 340ms; }
    .ecm-breakdown-foot {
      padding: 9px 13px;
      font-size: 12.5px;
      line-height: 1.45;
      color: var(--w-muted);
      background: var(--w-hold-bg);
      border-top: 1px solid var(--w-rule);
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    .ecm-stream-caret {
      display: inline-block;
      width: 2px;
      height: 13px;
      background: var(--w-champagne);
      margin-left: 3px;
      vertical-align: -2px;
      animation: ecmCaretBlink 0.75s infinite;
    }
    @keyframes ecmCaretBlink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }

    /* Карточка «Предварительный расчёт» в монохромной эстетике */
    .ecm-order-card {
      background: var(--w-card);
      border: 1px solid var(--w-rule);
      border-radius: var(--w-r-card);
      overflow: hidden;
      margin-top: 2px;
      transition: background-color 0.28s ease, border-color 0.28s ease;
    }

    .ecm-order-meta {
      background: var(--w-elevated);
      border-bottom: 1px solid var(--w-rule);
      padding: 9px 13px;
      font-size: 12px;
      font-weight: 500;
      color: var(--w-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    .ecm-order-title {
      color: var(--w-ink);
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .ecm-order-car {
      font-size: 12px;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: var(--w-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ecm-order-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .ecm-order-table td {
      padding: 9px 13px;
      border-bottom: 1px solid var(--w-rule);
      color: var(--w-ink);
      vertical-align: middle;
      transition: border-color 0.28s ease, color 0.28s ease, background-color 0.28s ease;
    }

    .ecm-order-table td.col-price {
      text-align: right;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
      font-size: 13.5px;
      font-weight: 600;
      white-space: nowrap;
      color: var(--w-ink);
    }

    .ecm-row-upsell {
      background: var(--w-upsell-bg);
    }

    .ecm-rec-tag {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 600;
      color: var(--w-tag-ink);
      background: var(--w-tag-bg);
      border: 1px solid var(--w-tag-border);
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: 6px;
      vertical-align: middle;
      letter-spacing: 0.01em;
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    .ecm-gift-val {
      color: var(--w-champagne);
      font-size: 12px;
      font-weight: 500;
    }

    .ecm-row-total {
      background: var(--w-panel);
      font-weight: 600;
      transition: background-color 0.28s ease;
    }
    .ecm-row-total td {
      border-bottom: none;
      padding: 10px 13px;
      font-size: 13.5px;
    }
    .ecm-row-total .col-price {
      font-size: 16px;
      font-weight: 600;
      color: var(--w-ink);
    }

    .ecm-hold-banner {
      padding: 8px 13px;
      background: var(--w-hold-bg);
      border-top: 1px solid var(--w-rule);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 11.5px;
      color: var(--w-hold-ink);
      transition: background-color 0.28s ease, border-color 0.28s ease, color 0.28s ease;
    }

    .ecm-slot-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ecm-slot-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--w-champagne);
      flex-shrink: 0;
    }

    /* Поочередное появление позиций сметы (stagger animation) */
    .ecm-order-card.is-staggered tr.stagger-row {
      opacity: 0;
      transform: translateY(6px);
      animation: ecmRowReveal 0.34s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .ecm-order-card.is-staggered tr.stagger-1 { animation-delay: 60ms; }
    .ecm-order-card.is-staggered tr.stagger-2 { animation-delay: 200ms; }
    .ecm-order-card.is-staggered tr.stagger-3 { animation-delay: 340ms; }
    .ecm-order-card.is-staggered tr.stagger-4 { animation-delay: 460ms; }
    .ecm-order-card.is-staggered .ecm-hold-banner {
      opacity: 0;
      animation: ecmRowReveal 0.32s cubic-bezier(0.16, 1, 0.3, 1) 560ms forwards;
    }
    @keyframes ecmRowReveal {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Индикатор набора «печатает...» */
    .ecm-typing {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--w-card);
      border: 1px solid var(--w-rule);
      border-radius: 8px 8px 8px 4px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--w-muted);
    }
    .ecm-typing-dots {
      display: inline-flex;
      align-items: center;
      gap: 3.5px;
    }
    .ecm-typing-dot {
      width: 4.5px;
      height: 4.5px;
      border-radius: 50%;
      background: var(--w-muted);
      animation: ecmBounce 1.2s infinite ease-in-out both;
    }
    .ecm-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .ecm-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    .ecm-typing-dot:nth-child(3) { animation-delay: 0s; }
    @keyframes ecmBounce {
      0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
      40% { transform: scale(1.1); opacity: 1; background: var(--w-champagne); }
    }

    /* Компактная панель быстрых запросов без горизонтальной обрезки */
    .ecm-chips-wrap {
      flex-shrink: 0;
      padding: 4px 14px 8px 14px;
      background: var(--w-panel);
      transition: background-color 0.28s ease;
    }
    .ecm-chips-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ecm-chip-btn {
      background: var(--w-chip-bg);
      border: 1px solid var(--w-rule);
      border-radius: var(--w-r-btn);
      padding: 6px 11px;
      font-size: 12px;
      font-weight: 500;
      color: var(--w-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .ecm-chip-btn:hover {
      background-color: var(--w-chip-hover);
      border-color: var(--w-rule-strong);
      color: var(--w-ink);
    }

    /* Поле ввода */
    .ecm-footer {
      padding: 10px 14px;
      background: var(--w-card);
      border-top: 1px solid var(--w-rule);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
      transition: background-color 0.28s ease, border-color 0.28s ease;
    }

    .ecm-input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--w-rule);
      border-radius: var(--w-r-btn);
      padding: 9px 12px;
      font-family: inherit;
      font-size: 14px;
      color: var(--w-ink);
      background: var(--w-input-bg);
      outline: none;
      transition: border-color 0.2s ease, background-color 0.28s ease, color 0.28s ease;
    }
    .ecm-input::placeholder {
      color: var(--w-faint);
    }
    .ecm-input:focus {
      border-color: var(--w-rule-strong);
    }

    .ecm-send {
      background: var(--w-accent);
      color: var(--w-accent-ink);
      border: none;
      border-radius: var(--w-r-btn);
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: opacity 0.15s ease, transform 0.15s ease, background-color 0.28s ease, color 0.28s ease;
    }
    .ecm-send:hover {
      opacity: 0.9;
    }
    .ecm-send:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .ecm-chip-btn, .ecm-send, .ecm-icon-btn, .ecm-floating-launcher {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    .ecm-chip-btn:active, .ecm-send:active {
      transform: scale(0.96);
    }

    @media (prefers-reduced-motion: reduce) {
      .ecm-msg, .ecm-order-card.is-staggered tr.stagger-row, .ecm-order-card.is-staggered .ecm-hold-banner {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      .ecm-stream-caret {
        display: none;
      }
    }

    /* Мобильный полноэкранный лист (< 640px) */
    @media (max-width: 640px) {
      .ecm-input {
        font-size: 16px; /* Исключает зум в iOS Safari */
      }
      .ecm-modal-overlay {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        width: 100dvw;
        height: 100vh;
        height: 100dvh;
        max-width: none;
        max-height: none;
        border-radius: 0;
      }
      .ecm-modal-overlay .ecm-chat-window {
        border-radius: 0;
        border: none;
      }
      .ecm-modal-overlay .ecm-header {
        padding-top: max(14px, env(safe-area-inset-top, 14px));
        padding-left: max(16px, env(safe-area-inset-left, 16px));
        padding-right: max(16px, env(safe-area-inset-right, 16px));
      }
      .ecm-modal-overlay .ecm-footer {
        padding-left: max(12px, env(safe-area-inset-left, 12px));
        padding-right: max(12px, env(safe-area-inset-right, 12px));
        padding-bottom: max(14px, env(safe-area-inset-bottom, 14px));
      }
      .ecm-stream {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding: 16px 14px 12px 14px;
        scroll-padding-top: 16px;
        gap: 10px;
      }
      .ecm-floating-launcher {
        bottom: max(16px, env(safe-area-inset-bottom, 16px));
        right: 16px;
        width: 48px;
        height: 48px;
      }
      .ecm-order-table td {
        padding: 8px 10px;
        font-size: 12.5px;
      }
      .ecm-order-table td.col-price {
        font-size: 12.5px;
      }
      .ecm-row-total .col-price {
        font-size: 15px;
      }
    }
  `;

  // ─── 6. ГЕНЕРАЦИЯ КАРТОЧКИ «ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ» ───────────────
  function buildOrderCardHtml(carModel, carClass, basePrice, upsellPrice, totalPrice, slot, serviceName, upsellName, options = {}) {
    const sName = serviceName || 'Восстановительная полировка кузова';
    const bPrice = (basePrice !== undefined && basePrice !== null) ? Number(basePrice) : 18000;
    const uPrice = (upsellPrice !== undefined && upsellPrice !== null && !isNaN(upsellPrice)) ? Number(upsellPrice) : 25000;
    const hasUpsell = uPrice > 0;
    const uName = upsellName || (hasUpsell ? 'Нанокерамика 9H (2 слоя)' : 'Без дополнительных опций');
    const tPrice = (totalPrice !== undefined && totalPrice !== null) ? Number(totalPrice) : (bPrice + uPrice);
    const displaySlot = (slot && slot !== 'суббота 14:00' && !slot.includes('суббота 14:00')) ? slot : 'по согласованию';
    const isStaggered = !!options.stagger;
    const initialDisplayedTotal = (typeof options.initialTotalStart === 'number') ? options.initialTotalStart : tPrice;

    const upsellRowHtml = hasUpsell ? `
      <tr class="ecm-row-upsell ${isStaggered ? 'stagger-row stagger-2' : ''}">
        <td>
          <span>${uName}</span>
          <span class="ecm-rec-tag">Рекомендуем</span>
        </td>
        <td class="col-price">+${uPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
      </tr>
    ` : `
      <tr class="${isStaggered ? 'stagger-row stagger-2' : ''}" style="opacity: 0.65;">
        <td>${uName}</td>
        <td class="col-price" style="color: var(--w-muted);">0&nbsp;₽</td>
      </tr>
    `;

    return `
      <div class="ecm-order-card ${isStaggered ? 'is-staggered' : ''}">
        <div class="ecm-order-meta">
          <span class="ecm-order-title">Предварительный расчёт</span>
          <span class="ecm-order-car tabular">${carModel} · ${carClass}</span>
        </div>
        <table class="ecm-order-table">
          <tbody>
            <tr class="${isStaggered ? 'stagger-row stagger-1' : ''}">
              <td>${sName}</td>
              <td class="col-price">${bPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
            </tr>
            ${upsellRowHtml}
            <tr class="${isStaggered ? 'stagger-row stagger-3' : ''}">
              <td>Гидрофобный антидождь передней полусферы</td>
              <td class="col-price"><span class="ecm-gift-val">В подарок</span></td>
            </tr>
            <tr class="ecm-row-total ${isStaggered ? 'stagger-row stagger-4' : ''}">
              <td>Итого</td>
              <td class="col-price"><span class="ecm-total-num">${initialDisplayedTotal.toLocaleString('ru-RU')}</span>&nbsp;₽</td>
            </tr>
          </tbody>
        </table>
        <div class="ecm-hold-banner">
          <span class="ecm-slot-status"><span class="ecm-slot-dot"></span>Слот: ${displaySlot}</span>
          <span class="tabular">Резерв: <span class="ecm-timer-val">15:00</span></span>
        </div>
      </div>
    `;
  }

  // ─── 7. СОЗДАНИЕ SHADOW DOM ХОСТА ─────────────────────────────────
  const host = document.createElement('div');
  host.id = 'ecm-ai-widget-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const floatingVarsStyleEl = document.createElement('style');
  floatingVarsStyleEl.textContent = generateThemeVarsCss(activeTheme);
  shadow.appendChild(floatingVarsStyleEl);

  const floatingBaseStyleEl = document.createElement('style');
  floatingBaseStyleEl.textContent = BASE_SHADOW_CSS;
  shadow.appendChild(floatingBaseStyleEl);

  const wrapper = document.createElement('div');
  wrapper.className = 'ecm-root';
  wrapper.innerHTML = `
    <button class="ecm-floating-launcher" id="floatingLauncher" aria-label="Открыть чат с консультантом" title="Открыть чат" aria-expanded="false">
      <div class="ecm-launcher-icon" id="floatingLauncherIcon">
        ${SVG_LAUNCHER_CHAT}
      </div>
      <div class="ecm-launcher-dot" id="floatingLauncherDot"></div>
    </button>

    <div class="ecm-modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-label="Чат с консультантом">
      <div class="ecm-chat-window" id="floatingChatWindow"></div>
    </div>
  `;
  shadow.appendChild(wrapper);

  // ─── 8. ЛОГИКА НАЧАЛЬНОГО ДИАЛОГА И ПРОКРУТКИ ЧИПСОВ ──────────────
  function getInitialMessages() {
    return [
      {
        role: 'bot',
        isEstimate: false,
        isInitialSample: true,
        text: `Здравствуйте. Я онлайн-консультант ${STUDIO_CONFIG.company_name}.\nНиже — пример предварительного расчёта. Назовите модель автомобиля или выберите запрос ниже — подготовлю смету и свободные окна.`
      },
      {
        role: 'bot',
        isEstimate: true,
        isInitialSample: true,
        carModel: 'BMW 5',
        carClass: 'Седан',
        serviceName: 'Восстановительная полировка кузова',
        basePrice: 18000,
        upsellName: 'Нанокерамика 9H (2 слоя)',
        upsellPrice: 25000,
        totalPrice: 43000,
        slot: 'суббота 14:00'
      }
    ];
  }

  let messages = [];
  let inlineStream = null;
  let inlineInput = null;
  let inlineSend = null;
  let floatingStream = null;
  let floatingInput = null;
  let floatingSend = null;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildBreakdownCardHtml(breakdown, options = {}) {
    if (!breakdown || !Array.isArray(breakdown.rows) || !breakdown.rows.length) return '';
    const isStaggered = !!options.stagger;
    const rowsHtml = breakdown.rows.map((row, idx) => `
      <tr class="${row.isHighlight ? 'ecm-row-upsell ' : ''}${isStaggered ? `stagger-row stagger-${Math.min(idx + 1, 6)}` : ''}">
        <td>
          <span>${escapeHtml(row.label)}</span>
          ${row.tag ? `<span class="ecm-rec-tag">${escapeHtml(row.tag)}</span>` : ''}
        </td>
        <td class="col-price${row.isGift ? ' ecm-gift-val' : ''}">${escapeHtml(row.price)}</td>
      </tr>
    `).join('');

    const totalRowHtml = breakdown.totalPrice ? `
      <tr class="ecm-row-total${isStaggered ? ` stagger-row stagger-${Math.min(breakdown.rows.length + 1, 6)}` : ''}">
        <td>${escapeHtml(breakdown.totalLabel || 'Итого за комплекс')}</td>
        <td class="col-price">${escapeHtml(breakdown.totalPrice)}</td>
      </tr>
    ` : '';

    return `
      <div class="ecm-breakdown-card${isStaggered ? ' is-staggered' : ''}">
        <div class="ecm-order-meta">
          <span class="ecm-order-title">${escapeHtml(breakdown.headerLabel || 'Расчёт по прайсу')}</span>
          ${breakdown.metaLabel ? `<span class="ecm-order-car">${escapeHtml(breakdown.metaLabel)}</span>` : ''}
        </div>
        <table class="ecm-order-table">
          <tbody>
            ${rowsHtml}
            ${totalRowHtml}
          </tbody>
        </table>
        ${breakdown.footerNote ? `<div class="ecm-breakdown-foot">${escapeHtml(breakdown.footerNote)}</div>` : ''}
      </div>
    `;
  }

  function extractBreakdownFromText(rawText) {
    if (!rawText) return { leadText: '', breakdown: null };
    const lines = rawText.split('\n');
    const bulletRows = [];
    const leadLines = [];
    const footerLines = [];
    let seenRows = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const bulletMatch = trimmed.match(/^(?:[•\-\*]|\d+[.)])\s+(.+?)\s+[—–-]\s+(.+)$/);
      if (bulletMatch && /(?:₽|руб|подарок|бесплат)/i.test(bulletMatch[2])) {
        seenRows = true;
        bulletRows.push({
          label: bulletMatch[1].trim(),
          price: bulletMatch[2].trim(),
          isGift: /подарок|бесплат/i.test(bulletMatch[2])
        });
      } else if (!seenRows) {
        leadLines.push(lines[i]);
      } else if (trimmed) {
        footerLines.push(trimmed);
      }
    }

    if (bulletRows.length < 2) {
      return { leadText: rawText, breakdown: null };
    }

    return {
      leadText: leadLines.join('\n').trim() || 'Подобрали позиции по вашему запросу:',
      breakdown: {
        headerLabel: 'Расчёт по прайсу',
        rows: bulletRows,
        footerNote: footerLines.join(' ').trim()
      }
    };
  }

  function createMessageElement(m, options = {}) {
    const msgRow = document.createElement('div');
    msgRow.className = `ecm-msg ${m.role}`;

    if (m.role === 'user') {
      const bubble = document.createElement('div');
      bubble.className = 'ecm-user-text';
      bubble.textContent = m.text;
      msgRow.appendChild(bubble);
    } else if (m.isEstimate) {
      msgRow.innerHTML = buildOrderCardHtml(
        m.carModel,
        m.carClass,
        m.basePrice,
        m.upsellPrice,
        m.totalPrice,
        m.slot,
        m.serviceName,
        m.upsellName,
        options
      );
    } else {
      if (m.text) {
        const bubble = document.createElement('div');
        bubble.className = 'ecm-bot-bubble';
        bubble.textContent = m.text;
        msgRow.appendChild(bubble);
      }
      if (m.breakdown) {
        const temp = document.createElement('div');
        temp.innerHTML = buildBreakdownCardHtml(m.breakdown, options).trim();
        if (temp.firstElementChild) msgRow.appendChild(temp.firstElementChild);
      }
    }
    return msgRow;
  }

  function renderMessagesInto(containerEl, scrollMode = 'bottom') {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    messages.forEach(m => fragment.appendChild(createMessageElement(m)));
    containerEl.appendChild(fragment);

    requestAnimationFrame(() => {
      if (scrollMode === 'top') {
        containerEl.scrollTop = 0;
      } else {
        containerEl.scrollTop = containerEl.scrollHeight;
      }
    });
  }

  // ─── 9. МОНТИРОВАНИЕ В ИНЛАЙН И ПЛАВАЮЩИЙ РЕЖИМЫ ──────────────────
  const inlineContainer = document.getElementById('ecm-demo');
  let isFloatingOpen = false;

  const floatingLauncher = shadow.getElementById('floatingLauncher');
  const modalOverlay = shadow.getElementById('modalOverlay');
  const floatingChatWindow = shadow.getElementById('floatingChatWindow');

  function buildChatWindowMarkup(isInline) {
    return `
      <div class="ecm-header">
        <div class="ecm-header-left">
          <div class="ecm-avatar">${SVG_STUDIO_MARK}</div>
          <div style="min-width:0;">
            <div class="ecm-title">${STUDIO_CONFIG.company_name}</div>
            <div class="ecm-sub"><span>Расчёт сметы · Онлайн</span></div>
          </div>
        </div>
        <div class="ecm-actions">
          <button type="button" class="ecm-icon-btn reset-btn" title="Сбросить диалог" aria-label="Сбросить диалог">${SVG_RESET}</button>
          ${!isInline ? `<button type="button" class="ecm-icon-btn close-btn" title="Закрыть" aria-label="Закрыть">${SVG_CLOSE}</button>` : ''}
        </div>
      </div>

      <div class="ecm-stream" aria-live="polite"></div>

      <div class="ecm-chips-wrap">
        <div class="ecm-chips-strip">
          ${STUDIO_CONFIG.quick_prompts.map(q => `<button type="button" class="ecm-chip-btn">${q}</button>`).join('')}
        </div>
      </div>

      <div class="ecm-footer">
        <input type="text" class="ecm-input" placeholder="Модель авто или вопрос..." aria-label="Сообщение">
        <button type="button" class="ecm-send" title="Отправить" aria-label="Отправить">${SVG_SEND}</button>
      </div>
    `;
  }

  floatingChatWindow.innerHTML = buildChatWindowMarkup(false);
  floatingStream = floatingChatWindow.querySelector('.ecm-stream');
  floatingInput = floatingChatWindow.querySelector('.ecm-input');
  floatingSend = floatingChatWindow.querySelector('.ecm-send');
  const floatingClose = floatingChatWindow.querySelector('.close-btn');
  const floatingReset = floatingChatWindow.querySelector('.reset-btn');

  let inlineVarsStyleEl = null;

  if (inlineContainer) {
    const inlineHost = document.createElement('div');
    inlineHost.id = 'ecm-inline-shadow-host';
    inlineHost.style.width = '100%';
    inlineHost.style.height = '100%';
    inlineContainer.innerHTML = '';
    inlineContainer.appendChild(inlineHost);

    const inlineShadow = inlineHost.attachShadow({ mode: 'open' });

    inlineVarsStyleEl = document.createElement('style');
    inlineVarsStyleEl.textContent = generateThemeVarsCss(activeTheme);
    inlineShadow.appendChild(inlineVarsStyleEl);

    const inlineBaseStyleEl = document.createElement('style');
    inlineBaseStyleEl.textContent = BASE_SHADOW_CSS;
    inlineShadow.appendChild(inlineBaseStyleEl);

    const inlineWin = document.createElement('div');
    inlineWin.className = 'ecm-chat-window';
    inlineWin.innerHTML = buildChatWindowMarkup(true);
    inlineShadow.appendChild(inlineWin);

    inlineStream = inlineWin.querySelector('.ecm-stream');
    inlineInput = inlineWin.querySelector('.ecm-input');
    inlineSend = inlineWin.querySelector('.ecm-send');
    const inlineReset = inlineWin.querySelector('.reset-btn');

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

    inlineReset.addEventListener('click', () => resetConversation());
  }

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
      renderMessagesInto(floatingStream, messages.length <= 2 ? 'top' : 'bottom');
      if (window.innerWidth > 640) {
        setTimeout(() => floatingInput && floatingInput.focus(), 160);
      }
    } else {
      modalOverlay.classList.remove('open');
      floatingLauncher.classList.remove('is-open');
      floatingLauncher.setAttribute('aria-expanded', 'false');
      if (icon) icon.innerHTML = SVG_LAUNCHER_CHAT;
      floatingLauncher.focus();
    }
  }

  floatingLauncher.addEventListener('click', () => toggleFloating());

  // Показываем плавающую кнопку ТОЛЬКО после прокрутки ниже Hero-виджета (или сразу если #ecm-demo нет)
  function syncFloatingLauncherVisibility() {
    if (!inlineContainer) {
      floatingLauncher.classList.add('is-visible');
      return;
    }
    const rect = inlineContainer.getBoundingClientRect();
    const isHeroVisible = rect.bottom > 100 && rect.top < window.innerHeight;
    if (isHeroVisible) {
      floatingLauncher.classList.remove('is-visible');
      if (isFloatingOpen) toggleFloating(false);
    } else {
      floatingLauncher.classList.add('is-visible');
    }
  }

  if (inlineContainer && window.IntersectionObserver) {
    try {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            floatingLauncher.classList.remove('is-visible');
          } else {
            floatingLauncher.classList.add('is-visible');
          }
        });
      }, { threshold: 0.12 });
      heroObserver.observe(inlineContainer);
      syncFloatingLauncherVisibility();
    } catch (e) {
      window.addEventListener('scroll', syncFloatingLauncherVisibility, { passive: true });
      syncFloatingLauncherVisibility();
    }
  } else {
    floatingLauncher.classList.add('is-visible');
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFloatingOpen) {
      toggleFloating(false);
    }
  });

  function renderAllStreams(scrollMode = 'bottom') {
    if (inlineStream) renderMessagesInto(inlineStream, scrollMode);
    if (floatingStream) renderMessagesInto(floatingStream, scrollMode);
  }

  // ─── 10. СОСТОЯНИЕ ЗАКАЗА И ИНТЕЛЛЕКТУАЛЬНЫЙ ПАРСЕР ──────────────
  let activeOrderState = {
    carModel: null,
    carClass: null,
    brand: null,
    serviceName: null,
    serviceCategory: null,
    basePrice: 0,
    upsellName: null,
    upsellPrice: 0,
    totalPrice: 0,
    slot: 'по согласованию',
    upsellExcluded: false,
    carAge: null,
    stage: 'idle'
  };

  function resetActiveOrderState() {
    activeOrderState = {
      carModel: null,
      carClass: null,
      brand: null,
      serviceName: null,
      serviceCategory: null,
      basePrice: 0,
      upsellName: null,
      upsellPrice: 0,
      totalPrice: 0,
      slot: 'по согласованию',
      upsellExcluded: false,
      carAge: null,
      stage: 'idle'
    };
  }

  function extractContactInfo(text) {
    if (!text) return null;
    const trimmed = text.trim();

    const phoneMatch = trimmed.match(/(?:\+?7|8)[\s\-\(]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/) || trimmed.match(/\b\d{10,11}\b/);
    if (phoneMatch) {
      const cleanWithoutPhone = trimmed.replace(phoneMatch[0], '').replace(/[+\-()]/g, '').replace(/тел[ефон]*[.:]?/i, '').replace(/меня зовут/i, '').trim();
      const nameMatch = cleanWithoutPhone.match(/[a-zA-Zа-яА-ЯёЁ]{2,20}/);
      const clientName = nameMatch ? nameMatch[0] : null;
      return {
        type: 'phone',
        value: phoneMatch[0],
        phone: phoneMatch[0],
        name: clientName,
        display: clientName ? `${clientName} (${phoneMatch[0]})` : `тел. ${phoneMatch[0]}`
      };
    }

    const tgUrl = trimmed.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{3,32})/i);
    if (tgUrl) {
      const cleanWithoutTg = trimmed.replace(tgUrl[0], '').replace(/меня зовут/i, '').trim();
      const nameMatch = cleanWithoutTg.match(/[a-zA-Zа-яА-ЯёЁ]{2,20}/);
      const clientName = nameMatch ? nameMatch[0] : null;
      return {
        type: 'telegram',
        value: '@' + tgUrl[1],
        telegram: '@' + tgUrl[1],
        name: clientName,
        display: clientName ? `${clientName} (@${tgUrl[1]})` : `Telegram @${tgUrl[1]}`
      };
    }
    const tgHandle = trimmed.match(/@([a-zA-Z0-9_]{3,32})/);
    if (tgHandle) {
      const cleanWithoutTg = trimmed.replace(tgHandle[0], '').replace(/меня зовут/i, '').trim();
      const nameMatch = cleanWithoutTg.match(/[a-zA-Zа-яА-ЯёЁ]{2,20}/);
      const clientName = nameMatch ? nameMatch[0] : null;
      return {
        type: 'telegram',
        value: '@' + tgHandle[1],
        telegram: '@' + tgHandle[1],
        name: clientName,
        display: clientName ? `${clientName} (@${tgHandle[1]})` : `Telegram @${tgHandle[1]}`
      };
    }
    const tgWord = trimmed.match(/(?:тг|телеграм|телега|tg)\s*[:\-—]?\s*@?([a-zA-Z0-9_]{3,32})/i);
    if (tgWord) {
      const cleanWithoutTg = trimmed.replace(tgWord[0], '').replace(/меня зовут/i, '').trim();
      const nameMatch = cleanWithoutTg.match(/[a-zA-Zа-яА-ЯёЁ]{2,20}/);
      const clientName = nameMatch ? nameMatch[0] : null;
      return {
        type: 'telegram',
        value: '@' + tgWord[1],
        telegram: '@' + tgWord[1],
        name: clientName,
        display: clientName ? `${clientName} (@${tgWord[1]})` : `Telegram @${tgWord[1]}`
      };
    }

    const vkUrl = trimmed.match(/(?:https?:\/\/)?(?:www\.)?vk\.(?:com|ru)\/([a-zA-Z0-9_\.]{2,50})/i);
    if (vkUrl) {
      return {
        type: 'vk',
        value: 'vk.com/' + vkUrl[1],
        vk: 'vk.com/' + vkUrl[1],
        display: `ВКонтакте vk.com/${vkUrl[1]}`
      };
    }
    const vkWord = trimmed.match(/(?:вк|vk)\s*[:\-—]?\s*@?([a-zA-Z0-9_\.]{2,50})/i);
    if (vkWord && !['да', 'нет', 'ок', 'добрый', 'привет'].includes(vkWord[1].toLowerCase())) {
      return {
        type: 'vk',
        value: 'vk.com/' + vkWord[1],
        vk: 'vk.com/' + vkWord[1],
        display: `ВКонтакте vk.com/${vkWord[1]}`
      };
    }

    return null;
  }

  function parseTimeEntity(text) {
    if (!text) return null;
    const raw = text.toLowerCase().replace(/ё/g, 'е');

    const exactMatch = raw.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (exactMatch) {
      const h = parseInt(exactMatch[1], 10);
      const m = exactMatch[2];
      const hh = h < 10 ? '0' + h : '' + h;
      return { hour: h, minute: parseInt(m, 10), formatted: `${hh}:${m}`, raw: exactMatch[0] };
    }

    const wordItems = [
      { words: ['два', 'двум', 'двух', 'двумя'], h: 14 },
      { words: ['три', 'трем', 'трех', 'тремя'], h: 15 },
      { words: ['четыре', 'четырем', 'четырех'], h: 16 },
      { words: ['пять', 'пяти'], h: 17 },
      { words: ['шесть', 'шести'], h: 18 },
      { words: ['семь', 'семи'], h: 19 },
      { words: ['восемь', 'восьми'], h: 20 },
      { words: ['девять', 'девяти'], h: 9 },
      { words: ['десять', 'десяти'], h: 10 },
      { words: ['одиннадцать', 'одиннадцати'], h: 11 },
      { words: ['двенадцать', 'двенадцати'], h: 12 },
      { words: ['полдень'], h: 12 },
      { words: ['обед'], h: 13 },
      { words: ['час', 'часу', 'один', 'одному', 'единицу'], h: 13 }
    ];

    for (const item of wordItems) {
      for (const w of item.words) {
        const rx = new RegExp('(?:^|\\s)(?:(?:в|к|около|примерно|часа? в)\\s+)?' + w + '(?:\\s+час[а-я]*)?(?:\\s+(?:дня|вечера|утра|ночи))?(?:\\s|$|[.,!?;:])', 'i');
        if (rx.test(raw)) {
          const hasTimeMarker = /(?:^|\s)(?:в|к|около|примерно|часа? в|приеду|буду|заеду|записат|свободно)/i.test(raw) ||
            raw.includes('час') || raw.includes('дня') || raw.includes('утра') || raw.includes('вечера');
          if (hasTimeMarker) {
            let h = item.h;
            if (raw.includes('утра') && h >= 12) h -= 12;
            const hh = h < 10 ? '0' + h : '' + h;
            return { hour: h, minute: 0, formatted: `${hh}:00`, raw: w };
          }
        }
      }
    }

    const hasDigitTimeContext = /(?:^|\s)(?:в|к|около|примерно|после|до)\s+(\d{1,2})(?:\s*(?:ч|час|часа|часов|дня|вечера|утра|ночи))?(?:\s|$|[.,!?;:])/i.test(raw) ||
      /(?:^|\s)(\d{1,2})\s*(?:ч\b|час|часа|часов|дня|вечера|утра|ночи)(?:\s|$|[.,!?;:])/i.test(raw);

    if (hasDigitTimeContext) {
      const m = raw.match(/(?:(?:^|\s)(?:в|к|около|примерно|после|до)\s+(\d{1,2}))|(?:(?:^|\s)(\d{1,2})\s*(?:ч\b|час|часа|часов|дня|вечера|утра|ночи))/i);
      if (m) {
        const numStr = m[1] || m[2];
        let num = parseInt(numStr, 10);
        if (num >= 0 && num <= 24) {
          if (num >= 1 && num <= 7 && !raw.includes('ночи') && !raw.includes('утра')) {
            num += 12;
          }
          const hh = num < 10 ? '0' + num : '' + num;
          return { hour: num, minute: 0, formatted: `${hh}:00`, raw: m[0].trim() };
        }
      }
    }

    return null;
  }

  function extractTimePreference(text) {
    if (!text) return null;
    const parsedTime = parseTimeEntity(text);
    const dayMatch = text.match(/(?:в\s+)?(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|завтра|сегодня|выходные|будни)/i);

    if (dayMatch && parsedTime) {
      return `${dayMatch[0].trim()} в ${parsedTime.formatted}`;
    }
    if (parsedTime) {
      return `в ${parsedTime.formatted}`;
    }
    if (dayMatch) {
      return dayMatch[0].trim();
    }
    return null;
  }

  function normalizeCarText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()?"«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripNegatedServicePhrases(norm) {
    return (norm || '')
      .replace(/(?:^|\s)без\s+(?:[а-яa-z0-9]+\s+){0,2}?(?:нано\s*керамик[а-я]*|керамик[а-я]*|9h|жидк[а-я]*\s+стекл[а-я]*|полиров[а-я]*|озонир[а-я]*|пропитк[а-я]*|защитн[а-я]*|покрыт[а-я]*|доп[а-я]*|опци[а-я]*)/gi, ' ')
      .replace(/(?:^|\s)(?:нано\s*керамик[а-я]*|керамик[а-я]*|озонир[а-я]*|пропитк[а-я]*|полиров[а-я]*)\s+(?:не\s+(?:нужн|надо|хочу|будем)|убер[а-я]*|убрат[а-я]*|исключ[а-я]*|отмен[а-я]*)/gi, ' ')
      .replace(/(?:^|\s)(?:убер[а-я]*|убрат[а-я]*|исключ[а-я]*|отмен[а-я]*|не\s+(?:надо|нужн[аоы]?))\s+(?:[а-я]+\s+)?(?:нано\s*керамик[а-я]*|керамик[а-я]*|озонир[а-я]*|пропитк[а-я]*|полиров[а-я]*)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isUpsellExclusionQuery(text) {
    if (!text) return false;
    const norm = normalizeCarText(text || '').toLowerCase();

    if (norm.includes('без проблем') || norm.includes('без разниц') || norm.includes('без опоздан') || norm.includes('без задерж')) {
      return false;
    }
    if (/(?:^|\s)(?:толь[кеоае]{1,2}|толк|тока|ток|прост[оа]?|чист[оа]?|лишь)\s+(?:одну\s+)?(?:хим\s*чист|чистк|химк|полиров|пленк|оклейк|баз|салон|одну|один)/i.test(norm)) {
      return true;
    }
    if (/(?:^|\s)(?:толь[кеоае]{1,2}|толк|тока|ток|прост[оа]?|чист[оа]?|лишь)\s+(?:за\s+)?(?:\d+\s*(?:к|тыс|руб|р)?|баз)/i.test(norm)) {
      return true;
    }
    if (/(?:давайте|давате|давай|хочу|можно|мне|нам|сделайте|оставьте|будем)\s+(?:толь[кеоае]{1,2}|толк|тока|ток|прост[оа]?|чист[оа]?|лишь)(?:\s|$)/i.test(norm)) {
      return true;
    }
    if (norm.includes('без ')) {
      if (/без\s+(?:[а-я]+\s+)?(?:этого|нее|него|них|доп|пропит|припит|припт|керам|нано|озон|лишн|навяз|второг|покрыт|опци|услуг|плюшек|подготов)/i.test(norm)) {
        return true;
      }
      if (/(?:давайте|давате|давай|можно|хочу|лучше|только|будем|мне|нам)\s+без(?:\s|$)/i.test(norm) || norm.startsWith('без ')) {
        return true;
      }
    }
    if (/доп[а-я]*\s+(?:не\s+(?:нужн|надо)|не\s+хочу)/i.test(norm) || /не\s+(?:нужн|надо)\s+доп/i.test(norm)) {
      return true;
    }
    if (/дополнительн[а-я]*\s+(?:не\s+(?:нужн|надо)|ничего)/i.test(norm)) {
      return true;
    }
    if (/не\s+(?:надо|нужн[аоы]?)\s+(?:никак[а-я]*\s+)?(?:керамик|нано|пропит|припит|доп|лишн|этого|ее|его)/i.test(norm)) {
      return true;
    }
    if (/(?:керамик[а-я]*|нано\s*керамик[а-я]*|пропитк[а-я]*|озонир[а-я]*)\s+не\s+(?:нужн[аоы]?|надо)/i.test(norm)) {
      return true;
    }
    if (/уберите\s+(?:керамик|нано|пропит|припит|доп|лишн|это|ее|его)/i.test(norm)) {
      return true;
    }
    if (/(?:хим\s*чист|чистк|полиров|оклейк|пленк)[а-я]*\s+(?:и\s+все|больше\s+ничего|без\s+всего)/i.test(norm)) {
      return true;
    }
    if (norm.includes('одну услуг') || norm.includes('один комплекс') || norm.includes('только баз') || norm.includes('без доп')) {
      return true;
    }
    return false;
  }

  function isBookingRequest(text) {
    if (!text) return false;
    const low = text.toLowerCase();
    if (isUpsellExclusionQuery(low)) return false;
    const bookingWords = [
      'запис', 'забронир', 'брон', 'подходит', 'согласен', 'зафиксир', 'слот',
      'заехать', 'приехать', 'сделать', 'можно к вам', 'привезу', 'подъехать',
      'заскочить', 'загнать', 'окна', 'свободно'
    ];
    return bookingWords.some(w => low.includes(w)) || (low.startsWith('давайте') && !low.includes('без'));
  }

  function isRefusal(userText, botText) {
    const lowU = (userText || '').toLowerCase().replace(/ё/g, 'е').trim();
    const lowB = (botText || '').toLowerCase().replace(/ё/g, 'е').trim();

    const refusalWords = [
      'лада', 'lada', 'ваз', 'vaz', 'газ', 'уаз', 'москвич', 'приора', 'гранта', 'веста', 'калина', 'нива',
      'жигули', 'жигуль', 'шестерка', 'семерка', 'девятка', 'четырка', 'буханка', 'патриот',
      'шиномонтаж', 'ремонт двигателя', 'ремонт мотора', 'сход-развал', 'покраска кузова', 'сварка'
    ];
    for (const kw of refusalWords) {
      const rx = new RegExp('(^|[^a-zа-я0-9_])' + kw + '([^a-zа-я0-9_]|$)', 'i');
      if (rx.test(lowU)) return true;
    }

    const botRefusalPhrases = [
      'не входят в список', 'не сможем предложить', 'к сожалению, не сможем',
      'не принимаем', 'не занимаемся', 'не обслуживаем', 'отечественного производства'
    ];
    for (const phrase of botRefusalPhrases) {
      if (lowB.includes(phrase)) return true;
    }

    return false;
  }

  function isCreatorOrDevQuery(text) {
    if (!text) return false;
    const low = text.toLowerCase();
    if (/[св]о[зс]д[аое]тел|[св]а[зс]д[аое]тел/i.test(low)) return true;
    if (/разработчик|разраб[а-я]*|программист|автор[а-я]*/i.test(low)) return true;
    if (/кто\s+(?:тебя|тебе|вас|бота|виджет)\s+(?:[св]оздал|[св]делал|написал|[св]очинил|придумал|разработал)/i.test(low)) return true;
    if (/кто\s+(?:твой|ваш)\s+(?:[св]оздатель|[св]оздател|автор|разработчик|хозяин|папа|шеф)/i.test(low)) return true;
    if (/связаться\s+с\s+(?:[св]оздател|разработчик|автор|тем\s+кто|кем\s+то\s+кто\s+сделал)/i.test(low)) return true;
    if (/(?:купить|заказать|сделать|хочу|подключить)\s+(?:такого\s*(?:же\s*)?)?(?:бота|виджет|систему|чат)/i.test(low)) return true;
    if (/сколько\s+стоит\s+(?:бот|виджет|чат|система)/i.test(low)) return true;
    return false;
  }

  function isLeadershipQuery(text) {
    if (!text) return false;
    const low = text.toLowerCase();
    if (/главн[а-я]*|руковод[а-я]*|директор[а-я]*|владел[а-я]*|собственник[а-я]*|начальни[а-я]*|шеф[а-я]*|босс[а-я]*|управляющ[а-я]*/i.test(low)) return true;
    if (/(?:контакт|номер|телефон|связь|поговорить|позовите|позови|свяжите|свяжи|связать)\s+(?:с\s+)?(?:главн|старш|руковод|директор|управляющ|шеф|босс|человек|оператор|живым)/i.test(low)) return true;
    if (/живой\s+(?:человек|оператор|менеджер)|позови\s+человека|дай\s+человека|человек[а-я]*\s+позови|свяжи\s+с\s+человеком/i.test(low)) return true;
    return false;
  }

  function isLeadershipOrB2bQuery(text) {
    return isCreatorOrDevQuery(text) || isLeadershipQuery(text);
  }

  function parseDateIntent(text) {
    const norm = normalizeCarText(text || '');
    let hasDate = false;
    let display = null;
    let time = null;

    if (norm.includes('завтра')) {
      hasDate = true; display = 'завтра';
    } else if (norm.includes('послезавтра')) {
      hasDate = true; display = 'послезавтра';
    } else if (norm.includes('сегодня')) {
      hasDate = true; display = 'сегодня';
    } else if (norm.includes('суббот')) {
      hasDate = true; display = 'эту субботу';
    } else if (norm.includes('воскресень')) {
      hasDate = true; display = 'это воскресенье';
    } else if (norm.includes('пятниц')) {
      hasDate = true; display = 'эту пятницу';
    } else if (norm.includes('четверг')) {
      hasDate = true; display = 'этот четверг';
    } else if (norm.includes('сред')) {
      hasDate = true; display = 'эту среду';
    } else if (norm.includes('вторник')) {
      hasDate = true; display = 'этот вторник';
    } else if (norm.includes('понедельник')) {
      hasDate = true; display = 'этот понедельник';
    } else if (norm.includes('выходн')) {
      hasDate = true; display = 'эти выходные';
    }

    const parsedTime = parseTimeEntity(text);
    if (parsedTime) {
      time = parsedTime.formatted;
      if (!hasDate) {
        hasDate = true;
        display = 'это время';
      }
    } else if (norm.includes('утром') || norm.includes('с утра')) {
      time = 'утреннее время';
    } else if (norm.includes('вечером')) {
      time = 'вечернее время';
    } else if (norm.includes('днем')) {
      time = 'дневное время';
    }

    return { hasDate, display, time };
  }

  function parseBookingIntent(text) {
    const norm = normalizeCarText(text || '');
    const words = [
      'заехать', 'приехать', 'записаться', 'записат', 'запись', 'свободно',
      'окна', 'окон', 'можно к вам', 'сделать', 'забронировать', 'бронь',
      'привезу', 'подъехать', 'заскочить', 'загнать', 'подходит', 'согласен'
    ];
    return words.some(w => norm.includes(w));
  }

  function parseServiceIntent(text) {
    const norm = stripNegatedServicePhrases(normalizeCarText(text || ''));
    if (/хим\s*чист|химчист|химчиск|чистк|почист|салон|сиден|озонир|химк[аеуоы]/i.test(norm)) {
      return { category: 'clean', name: 'Полная химчистка салона' };
    }
    if (/ppf|ппф|пленк|плёнк|оклейк|оклеить|брон|заклеит|затянут|закатат|зоны риска/i.test(norm)) {
      return { category: 'ppf', name: 'Оклейка зон риска пленкой PPF' };
    }
    if (/полиров|палиров|глянец|блеск|паутинк|царапин/i.test(norm)) {
      return { category: 'polishing', name: 'Восстановительная полировка кузова' };
    }
    if (norm.includes('керамик') || norm.includes('9h') || norm.includes('жидкое стекло')) {
      return { category: 'ceramic', name: 'Нанокерамика 9H (2 слоя)' };
    }
    if (norm.includes('шумк') || norm.includes('шумоизоляц')) {
      return { category: 'noise', name: 'Шумоизоляция салона' };
    }
    if (norm.includes('антидожд')) {
      return { category: 'antirain', name: 'Гидрофобный антидождь' };
    }
    if (norm.includes('мойк')) {
      return { category: 'wash', name: 'Детейлинг-мойка' };
    }
    return { category: null, name: null };
  }

  function detectCar(text) {
    const norm = normalizeCarText(text);
    if (!norm) return { carModel: null, carClass: null, brand: null, isDomestic: false, rawMention: null };

    function hasRx(pattern) {
      const rx = new RegExp('(?:^|\\s)(?:' + pattern + ')(?:\\s|$)', 'i');
      return rx.test(norm);
    }

    if (hasRx('жигул[иейяь]?|жигуле|жигуль|ваз|таз|девятк[аеуоы]|четырк[аеуоы]|сем[ее]рк[аеуоы]|приор[аеуоы]|priora|грант[аеуоы]|granta|вест[аеуоы]|vesta|лада|lada')) {
      if (hasRx('нив[аеуоы]|niva')) {
        return { carModel: 'Lada Niva', carClass: 'Внедорожник', brand: 'Lada', isDomestic: true, rawMention: null };
      }
      return { carModel: 'Lada / Жигули', carClass: 'Седан', brand: 'Lada', isDomestic: true, rawMention: null };
    }
    if (hasRx('уаз|патриот[аеуом]?|patriot|хантер[аеуом]?')) {
      return { carModel: 'УАЗ Патриот', carClass: 'Внедорожник', brand: 'UAZ', isDomestic: true, rawMention: null };
    }

    const hasPradoWord = hasRx('прад(?:ик[аеуом]?|[оеауы]|ом)?|prado');
    const hasCruiserWord = hasRx('крузак[аеуом]?|крузер[аеуом]?|двухсотк[аеуоы]?|трехсотк[аеуоы]?|land\\s*cruiser|тлк|lc\\s*(?:200|300)?|лс\\s*(?:200|300)?');
    const has200or300 = hasRx('(?:200|300|150|120|100)(?:\\s*(?:ка|ку|ке))?');

    if (hasPradoWord || (hasCruiserWord && hasRx('прад')) || (has200or300 && hasRx('прад(?:ик[аеуом]?|[оеауы]|ом)?'))) {
      return { carModel: 'Toyota Land Cruiser Prado', carClass: 'Внедорожник', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasCruiserWord || (has200or300 && (hasRx('тойот|круз|крузак|тлк|lc|лс') || norm.includes('круз')))) {
      const model = hasRx('300|трехсотк') ? 'Toyota Land Cruiser 300' : 'Toyota Land Cruiser 200';
      return { carModel: model, carClass: 'Внедорожник', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasRx('хайлендер[аеуом]?|highlander')) {
      return { carModel: 'Toyota Highlander', carClass: 'Кроссовер', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasRx('равчик[аеуом]?|рав\\s*4|rav\\s*4|рав4|rav4')) {
      return { carModel: 'Toyota RAV4', carClass: 'Кроссовер', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasRx('камр[иеяю]|камрюх[аеуоы]|камрюш[аеуоы]|camry')) {
      return { carModel: 'Toyota Camry', carClass: 'Бизнес-седан', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasRx('альфард[аеуом]?|alphard')) {
      return { carModel: 'Toyota Alphard', carClass: 'Микроавтобус', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasRx('королл[аеуоы]|corolla')) {
      return { carModel: 'Toyota Corolla', carClass: 'Седан', brand: 'Toyota', isDomestic: false, rawMention: null };
    }
    if (hasRx('lx\\s*(?:570|600|470)?|лх\\s*(?:570|600)?|gx\\s*(?:460|550|470)?|гх|570|460|470')) {
      if (hasRx('lx|лх|gx|гх|лех|лексус|lexus|570|460|470')) {
        return { carModel: 'Lexus LX/GX', carClass: 'Внедорожник', brand: 'Lexus', isDomestic: false, rawMention: null };
      }
    }
    if (hasRx('rx\\s*(?:350|300|500)?|рх|nx\\s*(?:200|250|300)?|нх')) {
      return { carModel: 'Lexus RX/NX', carClass: 'Кроссовер', brand: 'Lexus', isDomestic: false, rawMention: null };
    }
    if (hasRx('es|ес|is|ис|ls|лс') && hasRx('лех|лексус|lexus|тойот')) {
      return { carModel: 'Lexus ES/LS', carClass: 'Бизнес-седан', brand: 'Lexus', isDomestic: false, rawMention: null };
    }
    if (hasRx('лех[аеуоы]|лехус[аеуом]?|лексус[аеуом]?|lexus')) {
      return { carModel: 'Lexus', carClass: 'Внедорожник', brand: 'Lexus', isDomestic: false, rawMention: null };
    }
    if (hasRx('тойот[аеуоы]|toyota')) {
      return { carModel: 'Toyota', carClass: 'Кроссовер', brand: 'Toyota', isDomestic: false, rawMention: null };
    }

    if (hasRx('гелик[аеуом]?|гелендваген[аеуом]?|g\\s*class|г\\s*класс|g\\s*63|g\\s*500|g63|g500')) {
      return { carModel: 'Mercedes G-Class', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('63\\s*амг|амг\\s*63|amg\\s*63|63\\s*amg|амг|amg') && hasRx('мерс|мерин|мерседес|mercedes|63')) {
      if (hasRx('гелик|г\\s*класс|g\\s*class|джип|внедорожник')) {
        return { carModel: 'Mercedes-AMG G63', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false, rawMention: null };
      }
      return { carModel: 'Mercedes-AMG 63', carClass: 'Бизнес-седан', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('глс|gls|гле|gle')) {
      return { carModel: 'Mercedes GLE/GLS', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('глц|glc|гла|gla|глб|glb')) {
      return { carModel: 'Mercedes GLC/GLA', carClass: 'Кроссовер', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('ешк[аеуоы]|e\\s*class|е\\s*класс|e200|e300|e350|e400|e53|e63')) {
      return { carModel: 'Mercedes E-Class', carClass: 'Бизнес-седан', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('цэшк[аеуоы]|c\\s*class|с\\s*класс|c180|c200|c300')) {
      return { carModel: 'Mercedes C-Class', carClass: 'Седан', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('эск[аеуоы]|s\\s*class|s\\s*класс|майбах[аеуом]?|maybach|s350|s500|s580')) {
      return { carModel: 'Mercedes S-Class / Maybach', carClass: 'Бизнес-седан', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('v\\s*class|v\\s*класс|вито|vito|виан[ое]|viano')) {
      return { carModel: 'Mercedes V-Class', carClass: 'Микроавтобус', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }
    if (hasRx('мерин[аеуом]?|мерс[аеуом]?|мерседес[аеуом]?|mercedes')) {
      return { carModel: 'Mercedes-Benz', carClass: 'Бизнес-седан', brand: 'Mercedes', isDomestic: false, rawMention: null };
    }

    if (hasRx('х\\s*[567]|x\\s*[567]|икс\\s*[567]|xm|хм|х5|х6|х7|x5|x6|x7')) {
      return { carModel: 'BMW X5/X6/X7', carClass: 'Внедорожник', brand: 'BMW', isDomestic: false, rawMention: null };
    }
    if (hasRx('х\\s*[1234]|x\\s*[1234]|икс\\s*[1234]|х1|х2|х3|х4|x1|x2|x3|x4')) {
      return { carModel: 'BMW X1–X4', carClass: 'Кроссовер', brand: 'BMW', isDomestic: false, rawMention: null };
    }
    if (hasRx('тройк[аеуоы]|пятерк[аеуоы]|семерк[аеуоы]|f10|f30|g30|g20|[357]\\s*сери[яиею]')) {
      return { carModel: 'BMW 3/5/7 серии', carClass: 'Седан', brand: 'BMW', isDomestic: false, rawMention: null };
    }
    if (hasRx('бэх[аеуоы]|бумер[аеуом]?|бмв|bmw')) {
      return { carModel: 'BMW', carClass: 'Седан', brand: 'BMW', isDomestic: false, rawMention: null };
    }

    if (hasRx('ку\\s*[78]|q\\s*[78]|ку7|ку8|q7|q8|e\\s*tron|етрон')) {
      return { carModel: 'Audi Q7/Q8', carClass: 'Внедорожник', brand: 'Audi', isDomestic: false, rawMention: null };
    }
    if (hasRx('ку\\s*[35]|q\\s*[35]|ку3|ку5|q3|q5')) {
      return { carModel: 'Audi Q3/Q5', carClass: 'Кроссовер', brand: 'Audi', isDomestic: false, rawMention: null };
    }
    if (hasRx('аудюх[аеуоы]|ауди|audi')) {
      if (hasRx('а\\s*[3-8]|a\\s*[3-8]|а3|а4|а5|а6|а7|а8|a3|a4|a5|a6|a7|a8')) {
        return { carModel: 'Audi A-серии', carClass: 'Седан', brand: 'Audi', isDomestic: false, rawMention: null };
      }
      return { carModel: 'Audi', carClass: 'Седан', brand: 'Audi', isDomestic: false, rawMention: null };
    }

    if (hasRx('кай|кайен[аеуом]?|cayenne')) {
      return { carModel: 'Porsche Cayenne', carClass: 'Внедорожник', brand: 'Porsche', isDomestic: false, rawMention: null };
    }
    if (hasRx('макан[аеуом]?|macan')) {
      return { carModel: 'Porsche Macan', carClass: 'Кроссовер', brand: 'Porsche', isDomestic: false, rawMention: null };
    }
    if (hasRx('панам[аеуоы]|панамер[аеуоы]|panamera|тайкан[аеуом]?|taycan|911')) {
      return { carModel: 'Porsche Panamera/Taycan', carClass: 'Бизнес-седан / Купе', brand: 'Porsche', isDomestic: false, rawMention: null };
    }
    if (hasRx('порш[аеуом]?|порше|porsche')) {
      return { carModel: 'Porsche', carClass: 'Внедорожник', brand: 'Porsche', isDomestic: false, rawMention: null };
    }

    if (hasRx('танк[аеуом]?|tank')) {
      let model = 'Tank 300';
      if (hasRx('500|пятьсот')) model = 'Tank 500';
      else if (hasRx('400|четыреста')) model = 'Tank 400';
      else if (hasRx('700|семьсот')) model = 'Tank 700';
      return { carModel: model, carClass: 'Внедорожник', brand: 'Tank', isDomestic: false, rawMention: null };
    }

    if (hasRx('лисян[аеуом]?|ли\\s*сян|li\\s*auto|lixiang|ли\\s*[6789]|li\\s*[6789]|l[6789]|л[6789]')) {
      let model = 'Li Auto L9';
      if (hasRx('8|л8|l8')) model = 'Li Auto L8';
      else if (hasRx('7|л7|l7')) model = 'Li Auto L7';
      else if (hasRx('6|л6|l6')) model = 'Li Auto L6';
      return { carModel: model, carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false, rawMention: null };
    }

    if (hasRx('зикр[аеуом]?|zeekr')) {
      if (hasRx('009')) return { carModel: 'Zeekr 009', carClass: 'Микроавтобус', brand: 'Zeekr', isDomestic: false, rawMention: null };
      if (hasRx('7x|7х|x|х|икс')) return { carModel: 'Zeekr X/7X', carClass: 'Кроссовер', brand: 'Zeekr', isDomestic: false, rawMention: null };
      return { carModel: 'Zeekr 001', carClass: 'Бизнес-седан / Лифтбек', brand: 'Zeekr', isDomestic: false, rawMention: null };
    }

    if (hasRx('монжар[оеауы]?|монж[аеуом]?|monjaro')) return { carModel: 'Geely Monjaro', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    if (hasRx('тугелл?[аеуоы]?|tugella')) return { carModel: 'Geely Tugella', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    if (hasRx('атлас[аеуом]?|atlas|кулрей[аеуом]?|coolray|окаванго|okavango')) return { carModel: 'Geely Atlas / Coolray', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    if (hasRx('префейс[аеуом]?|preface|эмгранд[аеуом]?|emgrand')) return { carModel: 'Geely Preface / Emgrand', carClass: 'Седан', brand: 'Geely', isDomestic: false, rawMention: null };
    if (hasRx('джили|geely')) return { carModel: 'Geely', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };

    if (hasRx('дарг[оеауы]?|dargo|h\\s*9|н\\s*9')) return { carModel: 'Haval Dargo / H9', carClass: 'Внедорожник', brand: 'Haval', isDomestic: false, rawMention: null };
    if (hasRx('джолион[аеуом]?|jolion|f\\s*7|ф\\s*7|m\\s*6|м\\s*6')) return { carModel: 'Haval Jolion / F7', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false, rawMention: null };
    if (hasRx('хавал[аеуом]?|хавейл[аеуом]?|haval')) return { carModel: 'Haval', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false, rawMention: null };

    if (hasRx('тигг[оеауы]?|tiggo|аризз[оеауы]|arrizo|черей|chery')) {
      if (hasRx('аризз|arrizo')) return { carModel: 'Chery Arrizo', carClass: 'Седан', brand: 'Chery', isDomestic: false, rawMention: null };
      return { carModel: 'Chery Tiggo', carClass: 'Кроссовер', brand: 'Chery', isDomestic: false, rawMention: null };
    }
    if (hasRx('эксид[аеуом]?|exeed')) {
      if (hasRx('vx|вх')) return { carModel: 'Exeed VX', carClass: 'Внедорожник', brand: 'Exeed', isDomestic: false, rawMention: null };
      return { carModel: 'Exeed TXL/RX', carClass: 'Кроссовер', brand: 'Exeed', isDomestic: false, rawMention: null };
    }
    if (hasRx('джетур[аеуом]?|jetour|т\\s*2|t\\s*2|дашинг|dashing')) return { carModel: 'Jetour T2 / Dashing', carClass: 'Внедорожник', brand: 'Jetour', isDomestic: false, rawMention: null };
    if (hasRx('омод[аеуоы]|omoda|с\\s*5|c\\s*5|s\\s*5|с5|c5|s5|джейк[уо]|jaecoo|j\\s*7|j7')) return { carModel: 'Omoda C5 / Jaecoo J7', carClass: 'Кроссовер', brand: 'Omoda', isDomestic: false, rawMention: null };
    if (hasRx('чанган[аеуом]?|changan|юни|uni|cs\\s*55|cs\\s*75')) return { carModel: 'Changan UNI / CS', carClass: 'Кроссовер', brand: 'Changan', isDomestic: false, rawMention: null };
    if (hasRx('воях[аеуом]?|вой[яеи]|voyah')) {
      if (hasRx('дрим|dream')) return { carModel: 'Voyah Dream', carClass: 'Микроавтобус', brand: 'Voyah', isDomestic: false, rawMention: null };
      return { carModel: 'Voyah Free', carClass: 'Кроссовер', brand: 'Voyah', isDomestic: false, rawMention: null };
    }

    if (hasRx('туарег[аеуом]?|touareg|терамонт[аеуом]?|teramont')) return { carModel: 'VW Touareg', carClass: 'Внедорожник', brand: 'VW', isDomestic: false, rawMention: null };
    if (hasRx('тиг[аеуоы]|тигуан[аеуом]?|tiguan|кодиак[аеуом]?|kodiaq|карок[аеуом]?|karoq|таос|taos')) return { carModel: 'VW Tiguan / Skoda Kodiaq', carClass: 'Кроссовер', brand: 'VW', isDomestic: false, rawMention: null };
    if (hasRx('октах[аеуоы]?|октави[яиею]|octavia|суперб[аеуом]?|superb|рапид[аеуом]?|rapid|поло|polo|пассат[аеуом]?|passat|джетт[аеуоы]|jetta|гольф|golf')) return { carModel: 'Skoda / VW', carClass: 'Седан', brand: 'VW', isDomestic: false, rawMention: null };
    if (hasRx('мультивен|multivan|каравелл[аеуоы]|caravelle')) return { carModel: 'VW Multivan', carClass: 'Микроавтобус', brand: 'VW', isDomestic: false, rawMention: null };

    if (hasRx('сорент[оеауы]|sorento|мохав[еауы]?|mohave|палисад[аеуом]?|palisade|санта\\s*фе|santa\\s*fe')) return { carModel: 'Kia Sorento / Hyundai Palisade', carClass: 'Внедорожник', brand: 'Kia', isDomestic: false, rawMention: null };
    if (hasRx('спортейдж[аеуом]?|спортидж[аеуом]?|sportage|туссан[аеуом]?|тусон|tucson|крет[аеуоы]|creta|селтос[аеуом]?|seltos')) return { carModel: 'Kia Sportage / Hyundai Tucson', carClass: 'Кроссовер', brand: 'Kia', isDomestic: false, rawMention: null };
    if (hasRx('карнивал[аеуом]?|carnival|стари[яиею]|staria')) return { carModel: 'Kia Carnival / Hyundai Staria', carClass: 'Микроавтобус', brand: 'Kia', isDomestic: false, rawMention: null };
    if (hasRx('солярис[аеуом]?|соляр[аеуоы]?|solaris|рио|rio|к\\s*5|k\\s*5|к5|k5|оптим[аеуоы]|optima|сонат[аеуоы]|sonata|церато|cerato|элантр[аеуоы]|elantra|круз[аеуом]?|cruze|генезис|genesis')) return { carModel: 'Kia / Hyundai / Chevrolet', carClass: 'Седан', brand: 'Kia', isDomestic: false, rawMention: null };

    if (hasRx('внедорожник[аеуом]?|джип[аеуом]?|рамник[аеуом]?|пикап[аеуом]?')) return { carModel: 'Внедорожник', carClass: 'Внедорожник', brand: null, isDomestic: false, rawMention: null };
    if (hasRx('кроссовер[аеуом]?|паркетник[аеуом]?')) return { carModel: 'Кроссовер', carClass: 'Кроссовер', brand: null, isDomestic: false, rawMention: null };
    if (hasRx('микроавтобус[аеуом]?|минивэн[аеуом]?|минивен[аеуом]?|бус[аеуом]?')) return { carModel: 'Микроавтобус', carClass: 'Микроавтобус', brand: null, isDomestic: false, rawMention: null };
    if (hasRx('седан[аеуом]?|хэтчбек[аеуом]?|универсал[аеуом]?|купе|лифтбек[аеуом]?')) return { carModel: 'Седан', carClass: 'Седан', brand: null, isDomestic: false, rawMention: null };

    const rawMatch = norm.match(/(?:^|\s)(?:на|у меня|для|машин[аеу]|авто|автомобил[еяь])\s+([a-zа-я0-9\s]{2,25}?)(?=\s+(?:химчист|полиров|оклейк|пленк|брон|керамик|сделать|заехать|приехать|записат|почистит|покрыт|$))/i);
    if (rawMatch) {
      const candidate = rawMatch[1].trim();
      const skipWords = ['завтра', 'сегодня', 'днях', 'выходных', 'этой', 'следующей', 'неделе', 'время', 'час', 'утро', 'вечер', 'день', 'мойку', 'полировку', 'химчистку'];
      if (!skipWords.includes(candidate) && candidate.length > 1) {
        return { carModel: null, carClass: null, brand: null, isDomestic: false, rawMention: candidate };
      }
    }

    return { carModel: null, carClass: null, brand: null, isDomestic: false, rawMention: null };
  }

  function parseMessageEntities(text) {
    return {
      norm: normalizeCarText(text || ''),
      car: detectCar(text),
      service: parseServiceIntent(text),
      dateIntent: parseDateIntent(text),
      bookingIntent: parseBookingIntent(text),
      contactInfo: extractContactInfo(text)
    };
  }

  const detectCarDetails = detectCar;

  function getCarExpertDetail(carModel, carClass, brand) {
    const low = (carModel || '').toLowerCase();
    const cClass = carClass || '';

    if (low.includes('prado') || low.includes('прадо') || low.includes('land cruiser') || low.includes('крузак')) {
      return 'На Land Cruiser просторный салон с плотной кожей — вернём заводскую матовость и аккуратно проработаем все стыки.';
    }
    if (low.includes('tank') || low.includes('танк')) {
      return 'У Tank 300 вертикальное лобовое стекло и массивные расширители арок — зона риска по трассе, а фактурный пластик в салоне требует бережной чистки.';
    }
    if (low.includes('audi q8') || low.includes('ку8')) {
      return 'У Q8 сложный рельеф кузова и глянцевые стойки Shadow Line — уделим внимание каждой кромке.';
    }
    if (low.includes('bmw x5') || low.includes('x6') || low.includes('x7')) {
      return 'Для крупных BMW особое внимание уделяем деликатному глянцу, оптике и коже салона.';
    }
    if (low.includes('g-class') || low.includes('гелик')) {
      return 'У G-Class плоский вертикальный кузов и рельефный интерьер — работаем точечно по каждой панели и строчке.';
    }
    if (low.includes('gle') || low.includes('gls')) {
      return 'На GLE/GLS деликатная отделка и большой объём фронтальных деталей — используем составы Koch Chemie и полиуретан 200 мкм.';
    }
    if (brand === 'LiXiang' || low.includes('li auto')) {
      return 'На Li Auto мягкий заводской лак и светлый салон — защита полиуретаном и пропиткой кожи здесь критична.';
    }
    if (brand === 'Zeekr' || low.includes('zeekr')) {
      return 'У Zeekr обилие глянцевых панелей и аэродинамичный передок — полируем и защищаем без голограмм и шагрени.';
    }
    if (brand === 'Geely' || low.includes('monjaro')) {
      return 'На Monjaro комбинированный салон с алькантарой и мягкий лак — работаем низкообразивными пастами без перегрева.';
    }
    if (brand === 'Mercedes' || low.includes('mercedes')) {
      return 'Для Mercedes используем составы под заводскую фактуру кожи и лака с высокой твёрдостью.';
    }
    if (brand === 'BMW' || low.includes('bmw')) {
      return 'На BMW с твёрдым лаком и элементами Shadow Line требуется многоступенчатая полировка и аккуратная фиксация плёнки.';
    }
    if (brand === 'Audi' || low.includes('audi')) {
      return 'На Audi выводим лак в чистое зеркало и сохраняем матовую текстуру декоративных вставок.';
    }
    if (brand === 'Porsche' || low.includes('porsche')) {
      return 'Для Porsche работаем по стандартам премиальной приёмки — без жирного блеска на коже и с подворотом плёнки без видимых швов.';
    }
    if (brand === 'Lexus' || low.includes('lexus')) {
      return 'У Lexus мягкий заводской лак и тонкая кожа — подбираем деликатные круги и защитные бальзамы.';
    }
    if (cClass === 'Внедорожник') {
      return 'Для полноразмерного внедорожника учитываем увеличенную площадь кузова и объём салона.';
    }
    if (cClass === 'Кроссовер') {
      return 'Для кроссовера просчитываем фронтальную проекцию и все уязвимые зоны пластика.';
    }
    if (cClass.includes('Седан')) {
      return 'Для седана уделяем внимание передней части кузова, оптике и глубине глянца по бортам.';
    }
    return '';
  }

  function isEstimateRequest(userText) {
    if (!userText) return false;
    if (isLeadershipOrB2bQuery(userText)) return false;
    const norm = normalizeCarText(userText);

    const priceKws = [
      'скольк', 'сольк', 'скоко', 'скока', 'склько', 'почем',
      'цен', 'стоимост', 'стоит', 'прайс', 'рассчит', 'посчит', 'тариф',
      'смет', 'расчет', 'оцен', 'выход', 'выйдет', 'обойдет'
    ];
    if (priceKws.some(k => norm.includes(k))) return true;
    if (isUpsellExclusionQuery(norm)) return true;

    const parsedSvc = parseServiceIntent(userText);
    const hasService = !!parsedSvc.category || /ppf|ппф|пленк|оклейк|полиров|керамик|хим\s*чист|химчист|чистк|почист|салон/i.test(norm);
    const detectedCar = detectCar(userText);
    const hasCar = !!(detectedCar.carClass || detectedCar.carModel);

    if (hasService && hasCar) return true;
    if (norm.startsWith('хочу') && (hasService || hasCar)) return true;
    if (hasCar && (norm.includes('на нем') || norm.includes('на нее') || norm.includes('на него') || norm.includes('приеду')) && activeOrderState.serviceName) {
      return true;
    }

    return false;
  }

  function computeEstimateForCar(userText, baseState) {
    const norm = normalizeCarText(userText || '');
    const detected = detectCar(userText);

    let carClass = detected.carClass || (baseState && baseState.carClass) || null;
    let carModel = detected.carModel || (baseState && baseState.carModel) || null;
    if (!carClass) return null;

    const isExcl = isUpsellExclusionQuery(norm) || !!(baseState && baseState.upsellExcluded);
    const positiveNorm = stripNegatedServicePhrases(norm);
    const svcIntent = parseServiceIntent(userText);
    const hasPPFInText = svcIntent.category === 'ppf' || /ppf|ппф|пленк|плёнк|оклейк|оклеить|заклеит|затянут|закатат|брон/i.test(positiveNorm);
    const hasCleanInText = svcIntent.category === 'clean' || /хим\s*чист|химчист|химчиск|чистк|почист|салон|сиден|кожа|пропитк|озонир|химк/i.test(positiveNorm);
    const hasPolishingInText = svcIntent.category === 'polishing' || /полиров|палиров|глянец|блеск|паутинк|царапин/i.test(positiveNorm);
    const hasCeramicInText = svcIntent.category === 'ceramic' || /керамик|9h|жидк[а-я]*\s*стекл/i.test(positiveNorm);

    let isPPF = false;
    let isClean = false;
    let isCeramic = false;

    if (hasCleanInText) isClean = true;
    else if (hasPPFInText) isPPF = true;
    else if (hasPolishingInText) {
      isPPF = false;
    } else if (hasCeramicInText) {
      isCeramic = true;
    } else if (baseState && (baseState.serviceCategory || baseState.serviceName)) {
      if (baseState.serviceCategory === 'clean' || (baseState.serviceName && baseState.serviceName.includes('химчист'))) isClean = true;
      else if (baseState.serviceCategory === 'ppf' || (baseState.serviceName && (baseState.serviceName.includes('PPF') || baseState.serviceName.includes('пленк')))) isPPF = true;
      else if (baseState.serviceCategory === 'ceramic' || (baseState.serviceName && (baseState.serviceName.includes('Нанокерамик') || baseState.serviceName.includes('9H')))) isCeramic = true;
    }

    const dateIntent = parseDateIntent(userText);
    let curSlot = (baseState && baseState.slot && baseState.slot !== 'суббота 14:00') ? baseState.slot : 'по согласованию';
    if (dateIntent && dateIntent.hasDate) {
      curSlot = dateIntent.display + (dateIntent.time ? (' в ' + dateIntent.time) : ' (время на выбор)');
    }

    if (isPPF) {
      let bp = 65000;
      if (carClass === 'Внедорожник' || carClass === 'Кроссовер') bp = 75000;
      else if (carClass === 'Микроавтобус') bp = 85000;

      const up = isExcl ? 0 : (carClass === 'Седан' || carClass === 'Бизнес-седан' || carClass === 'Бизнес-седан / Лифтбек' ? 25000 : 30000);
      const uName = isExcl ? 'Без дополнительных опций' : 'Нанокерамика 9H на остальной кузов';
      return {
        isEstimate: true,
        carModel: carModel || 'Автомобиль',
        carClass: carClass,
        serviceCategory: 'ppf',
        serviceName: 'Оклейка зон риска пленкой PPF',
        basePrice: bp,
        upsellName: uName,
        upsellPrice: up,
        totalPrice: bp + up,
        slot: curSlot,
        upsellExcluded: isExcl
      };
    }

    if (isClean) {
      let bp = 15000;
      if (carClass === 'Внедорожник' || carClass === 'Кроссовер') bp = 18000;
      else if (carClass === 'Микроавтобус') bp = 22000;

      const up = isExcl ? 0 : 8000;
      const uName = isExcl ? 'Без дополнительных опций' : 'Озонирование и защитная пропитка салона';
      return {
        isEstimate: true,
        carModel: carModel || 'Автомобиль',
        carClass: carClass,
        serviceCategory: 'clean',
        serviceName: 'Полная химчистка салона',
        basePrice: bp,
        upsellName: uName,
        upsellPrice: up,
        totalPrice: bp + up,
        slot: curSlot,
        upsellExcluded: isExcl
      };
    }

    if (isCeramic) {
      let bp = 25000;
      if (carClass === 'Кроссовер' || carClass === 'Внедорожник') bp = 30000;
      else if (carClass === 'Микроавтобус') bp = 35000;

      let polUp = 18000;
      if (carClass === 'Кроссовер') polUp = 22000;
      else if (carClass === 'Внедорожник') polUp = 26000;
      else if (carClass === 'Микроавтобус') polUp = 28000;

      const up = isExcl ? 0 : polUp;
      const uName = isExcl ? 'Без дополнительных опций' : 'Подготовительная полировка кузова';
      return {
        isEstimate: true,
        carModel: carModel || 'Автомобиль',
        carClass: carClass,
        serviceCategory: 'ceramic',
        serviceName: 'Нанокерамика 9H (2 слоя)',
        basePrice: bp,
        upsellName: uName,
        upsellPrice: up,
        totalPrice: bp + up,
        slot: curSlot,
        upsellExcluded: isExcl
      };
    }

    let bp = 18000;
    if (carClass === 'Внедорожник') bp = 26000;
    else if (carClass === 'Кроссовер') bp = 22000;
    else if (carClass === 'Микроавтобус') bp = 28000;

    const up = isExcl ? 0 : (carClass === 'Седан' || carClass === 'Бизнес-седан' || carClass === 'Бизнес-седан / Лифтбек' ? 25000 : 30000);
    const uName = isExcl ? 'Без дополнительных опций' : 'Нанокерамика 9H (2 слоя)';
    return {
      isEstimate: true,
      carModel: carModel || 'Автомобиль',
      carClass: carClass,
      serviceCategory: 'polishing',
      serviceName: 'Восстановительная полировка кузова',
      basePrice: bp,
      upsellName: uName,
      upsellPrice: up,
      totalPrice: bp + up,
      slot: curSlot,
      upsellExcluded: isExcl
    };
  }

  function extractEstimate(rawText, userText, contactInfo) {
    if (!rawText && !userText) return null;

    const isEstReq = isEstimateRequest(userText);
    const hasContact = !isLeadershipOrB2bQuery(userText) && !!contactInfo;
    if (!isEstReq && !hasContact) return null;

    if (rawText) {
      const jsonMatch = rawText.match(/\{[\s\S]*"(?:isEstimate|carModel)"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.isEstimate || parsed.carModel)) {
            const autoCalc = computeEstimateForCar(userText, activeOrderState);
            const detectedInUser = detectCar(userText);
            const userNamedCar = !!(detectedInUser.carModel || detectedInUser.carClass);

            const chosenModel = userNamedCar ? (autoCalc ? autoCalc.carModel : detectedInUser.carModel) : (parsed.carModel || (autoCalc ? autoCalc.carModel : activeOrderState.carModel));
            const chosenClass = userNamedCar ? (autoCalc ? autoCalc.carClass : detectedInUser.carClass) : (parsed.carClass || (autoCalc ? autoCalc.carClass : activeOrderState.carClass));

            if (!chosenClass) return null;

            const isExcl = isUpsellExclusionQuery(userText) || !!activeOrderState.upsellExcluded;
            const declinedCeramic = /(?:без|убер[а-я]*|убрат[а-я]*|исключ[а-я]*|не\s+(?:надо|нужн[аоы]?))\s+(?:[а-я]+\s+){0,2}?(?:нано\s*)?керамик|(?:нано\s*)?керамик[а-я]*\s+не\s+(?:нужн|надо)/i.test(normalizeCarText(userText || ''));
            const keepAutoCalcOverCeramic = isExcl && declinedCeramic && autoCalc && /керамик|9h/i.test(parsed.serviceName || '') && autoCalc.serviceCategory !== 'ceramic';
            const bp = keepAutoCalcOverCeramic ? Number(autoCalc.basePrice) : ((parsed.basePrice !== undefined && parsed.basePrice !== null) ? Number(parsed.basePrice) : (autoCalc ? autoCalc.basePrice : 18000));
            const up = isExcl ? 0 : ((parsed.upsellPrice !== undefined && parsed.upsellPrice !== null) ? Number(parsed.upsellPrice) : (autoCalc ? autoCalc.upsellPrice : 25000));

            const res = {
              isEstimate: true,
              carModel: chosenModel || 'Автомобиль',
              carClass: chosenClass,
              serviceCategory: autoCalc ? autoCalc.serviceCategory : 'polishing',
              serviceName: keepAutoCalcOverCeramic ? autoCalc.serviceName : (parsed.serviceName || (autoCalc ? autoCalc.serviceName : 'Восстановительная полировка кузова')),
              basePrice: bp,
              upsellName: isExcl ? 'Без дополнительных опций' : (parsed.upsellName || (autoCalc ? autoCalc.upsellName : 'Нанокерамика 9H (2 слоя)')),
              upsellPrice: up,
              totalPrice: isExcl ? bp : ((parsed.totalPrice !== undefined && parsed.totalPrice !== null) ? Number(parsed.totalPrice) : (bp + up)),
              slot: parsed.slot || activeOrderState.slot || 'по согласованию',
              upsellExcluded: isExcl
            };
            activeOrderState = Object.assign({}, activeOrderState, res);
            return res;
          }
        } catch (e) {}
      }

      const cutMatch = rawText.match(/\{[\s\S]*"(?:isEstimate|carModel)"[\s\S]*/);
      if (cutMatch) {
        const autoCalc = computeEstimateForCar(userText, activeOrderState);
        if (autoCalc) {
          activeOrderState = Object.assign({}, activeOrderState, autoCalc);
          return autoCalc;
        }
      }
    }

    const autoEst = computeEstimateForCar(userText, activeOrderState);
    if (autoEst) {
      activeOrderState = Object.assign({}, activeOrderState, autoEst);
      return autoEst;
    }
    return null;
  }

  function getFollowUpTimingQuestion(state, entities) {
    const hasCurrentDate = entities && entities.dateIntent && entities.dateIntent.hasDate;
    const currentDay = hasCurrentDate ? entities.dateIntent.display : null;
    const currentTime = hasCurrentDate && entities.dateIntent.time ? entities.dateIntent.time : null;
    const prevSlot = (state && state.slot && state.slot !== 'по согласованию' && state.slot !== 'суббота 14:00') ? state.slot : null;

    if (currentDay && currentTime) {
      return `На ${currentDay} в ${currentTime} окно свободно. Оставьте контакт (номер телефона или Telegram), чтобы старший мастер зафиксировал бронь.`;
    }
    if (currentDay) {
      return `По времени на ${currentDay}: удобнее первая половина дня (к 11:30) или вторая (14:00 / 16:30)? И оставьте контакт для закрепления бокса.`;
    }
    if (prevSlot) {
      const lowSlot = prevSlot.toLowerCase();
      let dayMention = '';
      if (lowSlot.includes('завтра')) dayMention = 'на завтра';
      else if (lowSlot.includes('сегодня')) dayMention = 'на сегодня';
      else if (lowSlot.includes('послезавтра')) dayMention = 'на послезавтра';
      else if (lowSlot.includes('суббот')) dayMention = 'на субботу';
      else if (lowSlot.includes('воскресень')) dayMention = 'на воскресенье';
      else if (lowSlot.includes('понедельник')) dayMention = 'на понедельник';
      else if (lowSlot.includes('вторник')) dayMention = 'на вторник';
      else if (lowSlot.includes('сред')) dayMention = 'на среду';
      else if (lowSlot.includes('четверг')) dayMention = 'на четверг';
      else if (lowSlot.includes('пятниц')) dayMention = 'на пятницу';
      else if (lowSlot.includes('выходн')) dayMention = 'на выходных';

      if (dayMention) {
        return `По времени ${dayMention}: удобнее утром или ближе к вечеру? Оставьте также телефон или Telegram для подтверждения записи.`;
      }
    }
    return `В какой день вам удобнее приехать — в будни или на выходных? Подберу свободное окно.`;
  }

  function getSmartFallback(text, contactInfo) {
    const norm = normalizeCarText(text || '');
    const entities = parseMessageEntities(text);

    if (isCreatorOrDevQuery(text)) {
      return {
        text: `Я онлайн-консультант студии «${STUDIO_CONFIG.company_name}». Помогаю рассчитать стоимость работ по прайсу и подобрать свободное окно.\n\nПо вопросам сотрудничества оставьте ваш телефон или Telegram — управляющий свяжется с вами в течение 15 минут.`
      };
    }

    if (isLeadershipQuery(text)) {
      return {
        text: `Оставьте, пожалуйста, имя и номер телефона (или @ник в Telegram) — управляющий студии перезвонит вам в течение 10–15 минут.\n\nТакже доступен дежурный номер: +7 (999) 000-00-00 (ежедневно 10:00–21:00).`
      };
    }

    if (entities.car && entities.car.isDomestic) {
      return {
        text: `Мы специализируемся на современных иномарках бизнес- и премиум-класса, поэтому ${entities.car.carModel || 'данные автомобили'} в работу не берём. Спасибо за обращение.`
      };
    }

    if (norm.includes('не надо') || norm.includes('не нужн') || norm.includes('передумал') || norm.includes('отмена') || norm.includes('отбой') || (norm.includes('нет') && norm.includes('спасибо'))) {
      return {
        text: 'Хорошо, без проблем. Если появятся вопросы по защите или уходу за автомобилем — обращайтесь в любое время.'
      };
    }

    const effContact = contactInfo || entities.contactInfo;
    if (effContact) {
      const timePref = extractTimePreference(text) || (entities.dateIntent.hasDate ? (entities.dateIntent.display + (entities.dateIntent.time ? (' в ' + entities.dateIntent.time) : '')) : null);
      if (timePref) activeOrderState.slot = timePref;

      if (!activeOrderState.carModel) {
        return {
          text: `Контакт записал. Передал заявку управляющему студии — он свяжется с вами (${effContact.display}) в ближайшее время.`
        };
      }

      const car = activeOrderState.carModel || 'ваш автомобиль';
      const slot = activeOrderState.slot || 'по согласованию';
      const slotPrep = (slot.startsWith('на ') || slot.startsWith('в ') || slot.startsWith('к ')) ? slot : `на ${slot}`;

      let receiptSummary = '';
      if (activeOrderState.carModel && activeOrderState.serviceName && activeOrderState.basePrice) {
        receiptSummary = ` (${activeOrderState.serviceName} · ${activeOrderState.totalPrice.toLocaleString('ru-RU')} ₽)`;
      }

      return {
        text: `Заявка оформлена. Зарезервировал слот для ${car} ${slotPrep}${receiptSummary}.\n\nСтарший мастер получил карточку и свяжется с вами (${effContact.display}), чтобы подтвердить заезд.`
      };
    }

    if (isUpsellExclusionQuery(norm)) {
      const hasRealCar = !!((entities.car && entities.car.carModel) || activeOrderState.carModel);
      const car = (entities.car && entities.car.carModel) || activeOrderState.carModel || 'автомобиля';
      const cClass = (entities.car && entities.car.carClass) || activeOrderState.carClass || 'Внедорожник';
      const positiveNorm = stripNegatedServicePhrases(norm);
      const declinedCeramic = /(?:без|убер[а-я]*|убрат[а-я]*|исключ[а-я]*|не\s+(?:надо|нужн[аоы]?))\s+(?:[а-я]+\s+){0,2}?(?:нано\s*)?керамик|(?:нано\s*)?керамик[а-я]*\s+не\s+(?:нужн|надо)/i.test(norm);

      let sName = activeOrderState.serviceName || 'Восстановительная полировка кузова';
      let bPrice = 18000;
      let uName = 'Без дополнительных опций';
      let replyServiceWord = 'базовый комплекс';

      const isClean = (entities.service && entities.service.category === 'clean') || /хим\s*чист|чистк|салон/i.test(positiveNorm) || (activeOrderState.serviceCategory === 'clean') || (activeOrderState.serviceName && activeOrderState.serviceName.includes('химчист'));
      const isPPF = !isClean && ((entities.service && entities.service.category === 'ppf') || /ppf|пленк|оклейк|брон/i.test(positiveNorm) || (activeOrderState.serviceCategory === 'ppf') || (activeOrderState.serviceName && activeOrderState.serviceName.includes('PPF')));
      const isPol = !isClean && !isPPF && ((entities.service && entities.service.category === 'polishing') || /полиров/i.test(positiveNorm) || (activeOrderState.serviceCategory === 'polishing') || (activeOrderState.serviceName && activeOrderState.serviceName.includes('полиров')));
      const isCer = !isClean && !isPPF && !isPol && !declinedCeramic && ((entities.service && entities.service.category === 'ceramic') || /керамик|9h/i.test(positiveNorm) || (activeOrderState.serviceCategory === 'ceramic') || (activeOrderState.serviceName && (activeOrderState.serviceName.includes('Нанокерамик') || activeOrderState.serviceName.includes('9H'))));

      if (isClean) {
        sName = 'Полная химчистка салона';
        bPrice = (cClass === 'Седан' || cClass === 'Бизнес-седан' || cClass === 'Бизнес-седан / Лифтбек') ? 15000 : 18000;
        replyServiceWord = 'Полная химчистка салона';
      } else if (isPPF) {
        sName = 'Оклейка зон риска пленкой PPF';
        bPrice = (cClass === 'Седан' || cClass === 'Бизнес-седан' || cClass === 'Бизнес-седан / Лифтбек') ? 65000 : 75000;
        replyServiceWord = 'Оклейка зон риска PPF';
      } else if (isCer) {
        sName = 'Нанокерамика 9H (2 слоя)';
        bPrice = (cClass === 'Седан' || cClass === 'Бизнес-седан' || cClass === 'Бизнес-седан / Лифтбек') ? 25000 : 30000;
        replyServiceWord = 'Нанокерамика 9H (2 слоя)';
      } else {
        sName = 'Восстановительная полировка кузова';
        bPrice = (cClass === 'Внедорожник') ? 26000 : ((cClass === 'Кроссовер') ? 22000 : 18000);
        replyServiceWord = 'Восстановительная полировка';
      }

      const est = {
        isEstimate: true,
        carModel: hasRealCar ? car : null,
        carClass: hasRealCar ? cClass : null,
        serviceCategory: isClean ? 'clean' : (isPPF ? 'ppf' : (isCer ? 'ceramic' : 'polishing')),
        serviceName: sName,
        basePrice: bPrice,
        upsellName: uName,
        upsellPrice: 0,
        totalPrice: bPrice,
        slot: activeOrderState.slot || 'по согласованию',
        upsellExcluded: true
      };
      activeOrderState = Object.assign({}, activeOrderState, est);

      if (!hasRealCar) {
        const sedPrice = isClean ? '15 000 ₽' : (isPPF ? '65 000 ₽' : (isCer ? '25 000 ₽' : '18 000 ₽'));
        const suvPrice = isClean ? '18 000 ₽' : (isPPF ? '75 000 ₽' : (isCer ? '30 000 ₽' : '22 000 ₽'));
        return {
          text: 'Понял, считаем только базовую услугу без дополнительных опций.',
          breakdown: {
            headerLabel: replyServiceWord,
            metaLabel: 'Без допуслуг',
            rows: [
              { label: 'Седан / купе', price: sedPrice },
              { label: 'Кроссовер / внедорожник', price: suvPrice },
              { label: 'Антидождь передней полусферы', price: 'В подарок', isGift: true }
            ],
            footerNote: 'Подскажите модель авто для точной сметы.'
          },
          estimate: hasRealCar ? est : null,
          rawText: hasRealCar ? JSON.stringify(est) : ''
        };
      }

      const timingQ = getFollowUpTimingQuestion(activeOrderState, entities);
      return {
        text: `Принято, для ${car} оставляем только базовый комплекс без допуслуг.`,
        breakdown: {
          headerLabel: 'Смета по запросу',
          metaLabel: `${car} · ${cClass}`,
          rows: [
            { label: sName, price: `${bPrice.toLocaleString('ru-RU')} ₽` },
            { label: 'Антидождь передней полусферы', price: 'В подарок', isGift: true }
          ],
          totalLabel: 'Итого по базе',
          totalPrice: `${bPrice.toLocaleString('ru-RU')} ₽`,
          footerNote: timingQ
        },
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    const parsedTime = parseTimeEntity(text);
    if (parsedTime && !isEstimateRequest(text) && !entities.car.carModel) {
      let dayPrefix = (entities.dateIntent.hasDate && entities.dateIntent.display !== 'это время') ? entities.dateIntent.display : null;
      if (!dayPrefix && activeOrderState.slot) {
        const lowSlot = activeOrderState.slot.toLowerCase();
        if (lowSlot.includes('завтра')) dayPrefix = 'на завтра';
        else if (lowSlot.includes('сегодня')) dayPrefix = 'на сегодня';
        else if (lowSlot.includes('послезавтра')) dayPrefix = 'на послезавтра';
        else if (lowSlot.includes('суббот')) dayPrefix = 'на субботу';
        else if (lowSlot.includes('воскресень')) dayPrefix = 'на воскресенье';
        else if (lowSlot.includes('понедельник')) dayPrefix = 'на понедельник';
        else if (lowSlot.includes('вторник')) dayPrefix = 'на вторник';
        else if (lowSlot.includes('сред')) dayPrefix = 'на среду';
        else if (lowSlot.includes('четверг')) dayPrefix = 'на четверг';
        else if (lowSlot.includes('пятниц')) dayPrefix = 'на пятницу';
        else if (lowSlot.includes('выходн')) dayPrefix = 'на выходных';
      }

      const fullSlot = dayPrefix ? `${dayPrefix} в ${parsedTime.formatted}` : `в ${parsedTime.formatted}`;
      activeOrderState.slot = fullSlot;
      return {
        text: `Зафиксировал удобное время: ${fullSlot}.\nПодскажите ваше имя и телефон (или Telegram), чтобы закрепить слот в расписании.`
      };
    }

    const detectedCar = entities.car;
    const isCarMentioned = !!(detectedCar.carModel || detectedCar.carClass);
    const hasActiveCar = !!(activeOrderState.carModel && activeOrderState.carClass);

    if (detectedCar.rawMention && !detectedCar.carClass && !hasActiveCar) {
      const rawCar = detectedCar.rawMention;
      let sName = 'детейлинг-комплекс';
      if (entities.service.category === 'clean' || norm.includes('химчист')) sName = 'полную химчистку салона';
      else if (entities.service.category === 'ppf' || norm.includes('пленк') || norm.includes('ppf')) sName = 'оклейку зон риска пленкой PPF';
      else if (entities.service.category === 'ceramic' || norm.includes('керамик') || norm.includes('9h')) sName = 'покрытие нанокерамикой 9H';
      else if (entities.service.category === 'polishing' || norm.includes('полиров')) sName = 'восстановительную полировку кузова';

      const datePart = entities.dateIntent.hasDate ? `На ${entities.dateIntent.display} в графике есть свободные окна.` : 'Свободные окна на неделе открыты.';
      return {
        text: `Принято, по ${rawCar} выполним ${sName}. ${datePart}\nУточните класс кузова (седан или кроссовер/внедорожник), чтобы назвать точную смету.`
      };
    }

    const hasServiceInMsg = !!entities.service.category;
    const hasServiceActive = !!activeOrderState.serviceName;
    const isPriceQuery = isEstimateRequest(text);

    if (isCarMentioned || hasActiveCar) {
      if (detectedCar.carModel) {
        activeOrderState.carModel = detectedCar.carModel;
        activeOrderState.carClass = detectedCar.carClass;
        activeOrderState.brand = detectedCar.brand;
      }

      const currentCarModel = activeOrderState.carModel || detectedCar.carModel;
      const currentCarClass = activeOrderState.carClass || detectedCar.carClass || 'Внедорожник';
      const expertNote = getCarExpertDetail(currentCarModel, currentCarClass, activeOrderState.brand || detectedCar.brand);

      if (hasServiceInMsg || hasServiceActive || isPriceQuery) {
        const est = computeEstimateForCar(text, activeOrderState);
        if (est) {
          activeOrderState = Object.assign({}, activeOrderState, est);
          if (entities.dateIntent.hasDate) {
            const dateSlot = entities.dateIntent.display + (entities.dateIntent.time ? (' в ' + entities.dateIntent.time) : ' (время на выбор)');
            est.slot = dateSlot;
            activeOrderState.slot = dateSlot;
          }

          const isClean = est.serviceCategory === 'clean' || (est.serviceName || '').includes('химчист');
          const isPPF = est.serviceCategory === 'ppf' || (est.serviceName || '').includes('PPF') || (est.serviceName || '').includes('пленк');
          const isCeramic = est.serviceCategory === 'ceramic' || (est.serviceName || '').includes('Нанокерамик') || (est.serviceName || '').includes('9H');

          let leadSummary = expertNote
            ? `${est.carModel} (${est.carClass}): ${expertNote}`
            : `Рассчитали стоимость и оптимальный состав работ для ${est.carModel} (${est.carClass}).`;
          if (isPPF) {
            leadSummary = `${leadSummary} В зоны риска входят капот, бампер, крылья, фары, зеркала и стойки (200 мкм Stek/Llumar).`;
          } else if (isCeramic) {
            leadSummary = `${leadSummary} Двухслойная керамика 9H формирует прочный гидрофобный слой до 18 месяцев.`;
          }
          if (entities.dateIntent.hasDate) {
            leadSummary = `На ${entities.dateIntent.display} свободные окна открыты. ${leadSummary}`;
          }

          const rows = [
            {
              label: isPPF ? 'Оклейка зон риска PPF (200 мкм)' : est.serviceName,
              price: `${est.basePrice.toLocaleString('ru-RU')} ₽`
            }
          ];
          if (est.upsellPrice > 0) {
            rows.push({
              label: est.upsellName,
              price: `+${est.upsellPrice.toLocaleString('ru-RU')} ₽`,
              tag: 'Рекомендуем',
              isHighlight: true
            });
          }
          rows.push({
            label: 'Антидождь передней полусферы',
            price: 'В подарок',
            isGift: true
          });

          const timingQ = getFollowUpTimingQuestion(activeOrderState, entities);

          return {
            text: leadSummary,
            breakdown: {
              headerLabel: 'Расчёт сметы',
              metaLabel: `${est.carModel} · ${est.carClass}`,
              rows: rows,
              totalLabel: est.upsellPrice > 0 ? 'Итого за комплекс' : 'Итого',
              totalPrice: `${est.totalPrice.toLocaleString('ru-RU')} ₽`,
              footerNote: timingQ
            },
            estimate: est,
            rawText: JSON.stringify(est)
          };
        }
      }

      if (isCarMentioned) {
        const cModel = currentCarModel || 'ваш автомобиль';
        const cClass = currentCarClass || 'Внедорожник';
        const isSed = (cClass === 'Седан' || cClass === 'Бизнес-седан' || cClass === 'Бизнес-седан / Лифтбек');
        const ppfPrice = isSed ? '65 000 ₽' : (cClass === 'Микроавтобус' ? '85 000 ₽' : '75 000 ₽');
        const cerPrice = isSed ? '25 000 ₽' : (cClass === 'Микроавтобус' ? '35 000 ₽' : '30 000 ₽');
        const polPrice = (cClass === 'Внедорожник') ? '26 000 ₽' : ((cClass === 'Кроссовер') ? '22 000 ₽' : (cClass === 'Микроавтобус' ? '28 000 ₽' : '18 000 ₽'));
        const cleanPrice = isSed ? '15 000 ₽' : (cClass === 'Микроавтобус' ? '22 000 ₽' : '18 000 ₽');
        const dateIntro = entities.dateIntent.hasDate ? `На ${entities.dateIntent.display} боксы свободны. ` : '';

        return {
          text: `${dateIntro}${cModel} (${cClass}). ${expertNote || 'Подготовили актуальный прайс под класс вашего кузова.'}`,
          breakdown: {
            headerLabel: 'Прайс по кузову',
            metaLabel: `${cModel} · ${cClass}`,
            rows: [
              { label: 'Оклейка зон риска PPF (200 мкм)', price: ppfPrice },
              { label: 'Нанокерамика 9H (2 слоя)', price: cerPrice },
              { label: 'Восстановительная полировка', price: polPrice },
              { label: 'Полная химчистка салона', price: cleanPrice },
              { label: 'Антидождь передней полусферы', price: 'В подарок', isGift: true }
            ],
            footerNote: 'Что для вас сейчас актуальнее?'
          }
        };
      }
    }

    const isServiceInquiry = (norm.includes('какие') && (norm.includes('услуг') || norm.includes('работ') || norm.includes('делает') || norm.includes('предлагает'))) ||
      norm.includes('список услуг') || norm.includes('весь прайс') || norm.includes('что вы делаете') || norm.includes('чем занимаетесь');

    if (isServiceInquiry) {
      return {
        text: `Выполняем защитную оклейку, полировку, нанесение керамики и химчистку в стерильных боксах «${STUDIO_CONFIG.company_name}».`,
        breakdown: {
          headerLabel: 'Основные услуги',
          metaLabel: 'Прайс от',
          rows: [
            { label: 'Оклейка зон риска PPF (200 мкм)', price: 'от 65 000 ₽' },
            { label: 'Нанокерамика 9H (2–3 слоя)', price: 'от 25 000 ₽' },
            { label: 'Восстановительная полировка кузова', price: 'от 18 000 ₽' },
            { label: 'Комплексная химчистка салона', price: 'от 15 000 ₽' },
            { label: 'Антидождь на переднюю полусферу', price: 'В подарок', isGift: true }
          ],
          footerNote: 'Напишите модель авто — сразу подготовлю точную смету.'
        }
      };
    }

    if (norm.includes('только эти') || norm.includes('это все') || norm.includes('что еще') || norm.includes('а еще') || norm.includes('другие услуги')) {
      return {
        text: 'Также выполняем шумоизоляцию (Comfort Mat), полировку и бронирование оптики, локальное удаление вмятин без покраски (PDR) и реставрацию кожи.\nКакая модель автомобиля у вас?'
      };
    }

    if (['ак', 'ок', 'хорошо', 'понял', 'ясно', 'ладно', 'договорились', 'угу'].includes(norm)) {
      if (activeOrderState.carModel) {
        return {
          text: `Хорошо, расчёт по ${activeOrderState.carModel} держим. В какой день удобнее заехать в студию?`
        };
      }
      return {
        text: 'Укажите марку и модель автомобиля — подготовлю смету и подскажу ближайшие свободные окна.'
      };
    }

    if (norm.includes('химчист') || norm.includes('химчиск') || norm.includes('салон') || norm.includes('почистит') || norm.includes('сиден')) {
      activeOrderState.serviceCategory = 'clean';
      activeOrderState.serviceName = 'Полная химчистка салона';
      return {
        text: 'Выполняем глубокую деликатную очистку кожи и текстиля, пола, потолка и багажника с антибактериальным озонированием за 1 рабочий день.',
        breakdown: {
          headerLabel: 'Полная химчистка салона',
          metaLabel: 'По классу кузова',
          rows: [
            { label: 'Седан и купе', price: '15 000 ₽' },
            { label: 'Кроссовер и внедорожник', price: '18 000 ₽' },
            { label: 'Минивэн и микроавтобус', price: '22 000 ₽' },
            { label: 'Озонирование и защитная пропитка', price: '+8 000 ₽', tag: 'Рекомендуем', isHighlight: true }
          ],
          footerNote: 'Назовите модель авто для точного расчёта.'
        }
      };
    }

    if (norm.includes('полировк') || norm.includes('палировк') || norm.includes('царапин') || norm.includes('глянец')) {
      activeOrderState.serviceCategory = 'polishing';
      activeOrderState.serviceName = 'Восстановительная полировка кузова';
      return {
        text: 'Убираем до 95% мелкой сетки царапин без истончения лака и возвращаем заводскую глубину глянца за 1 рабочий день.',
        breakdown: {
          headerLabel: 'Восстановительная полировка',
          metaLabel: 'По классу кузова',
          rows: [
            { label: 'Седан и купе', price: '18 000 ₽' },
            { label: 'Кроссовер', price: '22 000 ₽' },
            { label: 'Внедорожник', price: '26 000 ₽' },
            { label: 'Нанокерамика 9H (2 слоя)', price: 'от +25 000 ₽', tag: 'Рекомендуем', isHighlight: true },
            { label: 'Антидождь передней полусферы', price: 'В подарок', isGift: true }
          ],
          footerNote: 'Какая у вас модель автомобиля?'
        }
      };
    }

    if (norm.includes('ppf') || norm.includes('ппф') || norm.includes('пленк') || norm.includes('плёнк') || norm.includes('оклейк') || norm.includes('оклеить') || norm.includes('заклеит') || norm.includes('затянут') || norm.includes('закатат') || norm.includes('брон')) {
      activeOrderState.serviceCategory = 'ppf';
      activeOrderState.serviceName = 'Оклейка зон риска пленкой PPF';
      return {
        text: 'Защищаем капот, бампер, крылья, фары, зеркала и стойки оптическим полиуретаном 200 мкм (Stek / Llumar) с самозатягивающимся слоем.',
        breakdown: {
          headerLabel: 'Оклейка зон риска PPF',
          metaLabel: '200 мкм · Top Coat',
          rows: [
            { label: 'Седан и купе', price: '65 000 ₽' },
            { label: 'Кроссовер и внедорожник', price: '75 000 ₽' },
            { label: 'Минивэн и микроавтобус', price: '85 000 ₽' },
            { label: 'Керамика 9H на остальной кузов', price: 'от +25 000 ₽', tag: 'Рекомендуем', isHighlight: true },
            { label: 'Антидождь передней полусферы', price: 'В подарок', isGift: true }
          ],
          footerNote: 'Назовите модель авто — уточню смету и свободные окна.'
        }
      };
    }

    if (norm.includes('керамик') || norm.includes('9h') || norm.includes('жидкое стекло')) {
      activeOrderState.serviceCategory = 'ceramic';
      activeOrderState.serviceName = 'Нанокерамика 9H (2 слоя)';
      return {
        text: 'Двухслойный состав 9H усиливает глубину цвета, упрощает мойку и защищает лак от реагентов и ультрафиолета до 18 месяцев.',
        breakdown: {
          headerLabel: 'Нанокерамика 9H (2 слоя)',
          metaLabel: 'По классу кузова',
          rows: [
            { label: 'Седан и купе', price: '25 000 ₽' },
            { label: 'Кроссовер и внедорожник', price: '30 000 ₽' },
            { label: 'Минивэн и микроавтобус', price: '35 000 ₽' },
            { label: 'Подготовительная полировка', price: 'от +18 000 ₽', tag: 'Рекомендуем', isHighlight: true },
            { label: 'Замер толщины ЛКП', price: 'В подарок', isGift: true }
          ],
          footerNote: 'Какая у вас модель автомобиля?'
        }
      };
    }

    if ((norm.includes('скольк') && norm.includes('времен')) || norm.includes('по времени') || norm.includes('сколько дней') || norm.includes('сколько часов') || norm.includes('когда готов') || norm.includes('когда забрать') || norm.includes('когда отдадите') || norm.includes('длится')) {
      const car = activeOrderState.carModel || 'автомобиля';
      const isPPF = (activeOrderState.serviceName || '').includes('PPF') || (activeOrderState.serviceName || '').includes('пленк');
      const timing = isPPF
        ? `Оклейка зон риска для ${car} занимает 1–2 рабочих дня с обязательной сушкой в боксе и контролем подворотов.`
        : `Комплексная полировка или химчистка для ${car} занимает 1 рабочий день: утром заезжаете, на следующий день забираете готовый автомобиль.`;
      return { text: `${timing}\nКакой день недели вам удобен для визита?` };
    }

    if (norm.includes('гарант') || norm.includes('сертифик') || norm.includes('надежн')) {
      const car = activeOrderState.carModel || 'автомобиль';
      return {
        text: `На работы по ${car} действует официальная гарантия студии:\n• Полиуретановая плёнка — от 5 до 10 лет от производителя, 1 год на монтаж;\n• Керамика 9H — до 18 месяцев гидрофобного эффекта.\n\nЧерез 14 дней после оклейки приглашаем на бесплатный контрольный осмотр.`
      };
    }

    if (norm.includes('материал') || (norm.includes('пленк') && (norm.includes('как') || norm.includes('бренд') || norm.includes('фирм') || norm.includes('производ'))) || norm.includes('какой состав')) {
      return {
        text: 'Работаем с оптическим полиуретаном 195–215 мкм (Stek, Llumar, SunTek) с верхним самозатягивающимся слоем Top Coat. Дешёвый винил и гибридные плёнки не используем.'
      };
    }

    if ((norm.includes('зон') && norm.includes('риск')) || norm.includes('что входит') || norm.includes('какие детали')) {
      const car = activeOrderState.carModel || 'автомобиля';
      return {
        text: `В комплекс «Зоны риска» для ${car} входят: капот и передний бампер полностью, передние крылья, оптика, корпуса зеркал, стойки лобового, полоса на крышу и зоны под ручками.`
      };
    }

    if (norm.includes('скидк') || norm.includes('подешевл') || norm.includes('дорог') || norm.includes('торг') || norm.includes('уступ')) {
      return {
        text: 'В смету уже заложены фиксированные цены без скрытых наценок, бесплатный замер ЛКП, детейлинг-мойка перед работами и антидождь передней полусферы в подарок.'
      };
    }

    if (norm.includes('оплат') || norm.includes('предоплат') || norm.includes('карт') || norm.includes('наличн') || norm.includes('сбп') || norm.includes('безнал')) {
      return {
        text: 'Предоплата при бронировании не нужна. Оплата по факту выдачи автомобиля после осмотра результата: наличные, карта, СБП или расчётный счёт для юрлиц.'
      };
    }

    if (norm.includes('воскресень') || norm.includes('понедельник') || norm.includes('вторник') || norm.includes('сред') || norm.includes('четверг') || norm.includes('пятниц') || norm.includes('будн') || norm.includes('другой день') || norm.includes('другое время') || norm.includes('утром') || norm.includes('вечером')) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      return {
        text: `Принято, примем вас ${timePref || 'в удобное время'}. Подскажите имя и контакт (телефон или Telegram), чтобы закрепить слот в расписании.`
      };
    }

    if (isBookingRequest(text) || norm.includes('записат') || norm.includes('заехать') || norm.includes('приехать') || norm.includes('окна') || norm.includes('свободно')) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      return {
        text: 'Подскажите, какой у вас автомобиль и какая услуга интересует (полировка, плёнка PPF или химчистка) — проверю расписание и рассчитаю точную стоимость.'
      };
    }

    if (norm.includes('выбор') || norm.includes('помог') || norm.includes('посовету') || norm.includes('подскаж') || norm.includes('что лучше')) {
      if (activeOrderState.carModel) {
        const car = activeOrderState.carModel;
        const expertNote = getCarExpertDetail(car, activeOrderState.carClass, activeOrderState.brand);
        return {
          text: `Подберём оптимальный комплекс для ${car}. ${expertNote}\nКакая задача важнее сейчас: защита кузова от сколов (PPF), глубокий глянец (полировка + керамика) или обновление салона?`
        };
      }
      return {
        text: 'Помогу выбрать подходящий комплекс. Напишите модель автомобиля и главную задачу: защита от сколов по трассе (PPF), восстановление блеска (полировка + керамика) или химчистка салона.'
      };
    }

    if (norm.includes('где') || norm.includes('адрес') || norm.includes('находит') || norm.includes('город') || norm.includes('как доехать')) {
      return {
        text: `Студия находится по адресу: ${STUDIO_CONFIG.city}. Работаем ежедневно 10:00–21:00 по предварительной записи.`
      };
    }

    if (['привет', 'здравствуйте', 'добрый день', 'добрый вечер', 'ку', 'салют'].includes(norm)) {
      if (activeOrderState.carModel) {
        return {
          text: `Здравствуйте. Расчёт для ${activeOrderState.carModel} актуален. В какой день удобнее запланировать визит?`
        };
      }
      return {
        text: 'Здравствуйте. Укажите марку и модель автомобиля — рассчитаю стоимость по прайсу и подберу свободное окно.'
      };
    }

    if (activeOrderState.carModel) {
      return {
        text: `По ${activeOrderState.carModel} (${activeOrderState.carClass || 'Внедорожник'}) смету держим в работе. Подскажите удобный день для визита или уточните детали по материалам.`
      };
    }

    return {
      text: 'Напишите марку и модель автомобиля и какая услуга интересует — рассчитаю смету по кузову и подскажу ближайшие свободные окна.'
    };
  }

  // ─── 11. ПОТОКОВЫЙ ВЫВОД (STREAMING / TYPEWRITER) И СИНХРОНИЗАЦИЯ ─
  let isSending = false;
  let streamRunId = 0;
  let totalCountRaf = null;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cancelActiveAnimations() {
    streamRunId += 1;
    if (totalCountRaf) {
      cancelAnimationFrame(totalCountRaf);
      totalCountRaf = null;
    }
    hideTyping();
  }

  function setControlsState(disabled) {
    [inlineInput, floatingInput].forEach(inp => {
      if (!inp) return;
      if (disabled) inp.setAttribute('disabled', 'true');
      else inp.removeAttribute('disabled');
    });

    [inlineSend, floatingSend].forEach(btn => {
      if (!btn) return;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.4' : '1';
      btn.style.pointerEvents = disabled ? 'none' : 'auto';
    });

    const toggleChips = (root) => {
      if (!root) return;
      root.querySelectorAll('.ecm-chip-btn').forEach(chip => {
        chip.style.pointerEvents = disabled ? 'none' : 'auto';
        chip.style.opacity = disabled ? '0.5' : '1';
      });
    };
    toggleChips(shadow);
    const inlineHost = document.getElementById('ecm-inline-shadow-host');
    if (inlineHost && inlineHost.shadowRoot) toggleChips(inlineHost.shadowRoot);
  }

  function stripCodePieces(text) {
    if (!text) return '';
    let clean = String(text).replace(/```[a-z]*[\s\S]*?```/gi, '').replace(/```[a-z]*/gi, '');
    const jsonStartMatch = clean.match(/\{[\s\r\n]*"(?:isEstimate|carModel|serviceName|basePrice|totalPrice|carClass|slot)"/i);
    if (jsonStartMatch && typeof jsonStartMatch.index === 'number') {
      clean = clean.substring(0, jsonStartMatch.index);
    }
    clean = clean.replace(/\[(?:PENDING_BOOKING|CONFIRM_LEAD|CANCEL_LEAD|RESCHEDULE_LEAD):[^\]]*\]/gi, '');
    return clean.trim();
  }

  function showTyping() {
    hideTyping();
    const html = `
      <div class="ecm-msg bot typing-msg">
        <div class="ecm-typing" aria-label="печатает...">
          <span class="ecm-typing-dots">
            <span class="ecm-typing-dot"></span>
            <span class="ecm-typing-dot"></span>
            <span class="ecm-typing-dot"></span>
          </span>
          <span>печатает</span>
        </div>
      </div>
    `;
    [inlineStream, isFloatingOpen ? floatingStream : null].forEach(stream => {
      if (!stream) return;
      stream.insertAdjacentHTML('beforeend', html);
      requestAnimationFrame(() => {
        stream.scrollTop = stream.scrollHeight;
      });
    });
  }

  function hideTyping() {
    [inlineStream, floatingStream].forEach(stream => {
      if (!stream) return;
      stream.querySelectorAll('.typing-msg').forEach(el => el.remove());
    });
  }

  function scrollStreamSoftly(stream, forceBottom = true) {
    if (!stream || !forceBottom) return;
    stream.scrollTop = stream.scrollHeight;
  }

  function streamTextToTargets(fullText, targets, options = {}) {
    const myRunId = options.runId || streamRunId;
    const autoScroll = options.autoScroll !== false;

    if (prefersReduced || !fullText) {
      targets.forEach(({ container, textEl }) => {
        if (textEl) textEl.textContent = fullText;
        scrollStreamSoftly(container, autoScroll);
      });
      return Promise.resolve(myRunId === streamRunId);
    }

    return new Promise((resolve) => {
      let idx = 0;
      const len = fullText.length;
      const stepChars = len > 300 ? 4 : len > 150 ? 3 : 2;
      const intervalMs = 18;

      const carets = targets.map(({ bubble }) => {
        const c = document.createElement('span');
        c.className = 'ecm-stream-caret';
        if (bubble) bubble.appendChild(c);
        return c;
      });

      function tick() {
        if (myRunId !== streamRunId) {
          carets.forEach(c => c.remove());
          resolve(false);
          return;
        }

        idx = Math.min(len, idx + stepChars);
        const slice = fullText.slice(0, idx);

        targets.forEach(({ container, textEl }) => {
          if (textEl) textEl.textContent = slice;
          if (autoScroll && container) {
            container.scrollTop = container.scrollHeight;
          }
        });

        if (idx < len) {
          setTimeout(tick, intervalMs);
        } else {
          carets.forEach(c => c.remove());
          resolve(true);
        }
      }

      tick();
    });
  }

  function animateTotalCounter(cardEl, fromVal, toVal, durationMs = 460) {
    if (!cardEl || prefersReduced || fromVal === toVal) return;
    const numEl = cardEl.querySelector('.ecm-total-num');
    if (!numEl) return;

    const startTime = performance.now();
    function step(now) {
      const p = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(fromVal + (toVal - fromVal) * eased);
      numEl.textContent = val.toLocaleString('ru-RU');
      if (p < 1) {
        totalCountRaf = requestAnimationFrame(step);
      } else {
        numEl.textContent = toVal.toLocaleString('ru-RU');
        totalCountRaf = null;
      }
    }
    totalCountRaf = requestAnimationFrame(step);
  }

  async function queryAi(promptText, chatHistory, contactInfo) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1400);
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
      } catch (e) {}
    }

    await new Promise(r => setTimeout(r, prefersReduced ? 40 : 420));
    return getSmartFallback(promptText, contactInfo);
  }

  let lastSyncedContactKey = null;
  let lastSyncedTime = 0;

  function syncLeadToExternalServices(leadData) {
    if (!leadData) return;
    const contactKey = `${leadData.phone || leadData.tg_username || leadData.contactDisplay}_${leadData.car}_${leadData.service}`;
    const now = Date.now();
    if (lastSyncedContactKey === contactKey && (now - lastSyncedTime) < 15000) return;
    lastSyncedContactKey = contactKey;
    lastSyncedTime = now;

    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzu8ArfBKXIC3TXHTft_E71DexXH4U_URuptyEqCRTxub9eUejPLaLwiFGAeyIghy3S/exec";
    const TG_BOT_TOKEN = "9042228037:AAEy1Sij6yYSSqdl1OW6S8e253auvBywajg";
    const TG_ADMIN_ID = 5031947136;

    try {
      const sheetPayload = {
        action: "create",
        id: String(Date.now()).slice(-6),
        created_at: new Date().toLocaleString("ru-RU"),
        company: STUDIO_CONFIG.company_name || "Detailing Lab",
        client: leadData.client || "Посетитель сайта",
        service: leadData.service || "Детейлинг-комплекс",
        price: leadData.price || "По прайсу",
        day: leadData.slot || "По согласованию",
        time_slot: leadData.slot || "По согласованию",
        phone: leadData.phone || "",
        tg_username: leadData.tg_username || "",
        status: "Ожидает подтверждения"
      };

      fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(sheetPayload)
      }).catch(err => console.warn("[ECM Widget] Google Sheets sync notice:", err));
    } catch (e) {
      console.warn("[ECM Widget] Google Sheets sync error:", e);
    }

    try {
      const cardText = `🔔 <b>НОВАЯ ЗАЯВКА ИЗ ВЕБ-ВИДЖЕТА (САЙТ)</b>\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🏢 <b>Филиал:</b> ${STUDIO_CONFIG.company_name || "Detailing Lab"}\n` +
        `👤 <b>Клиент:</b> ${leadData.client || "Посетитель сайта"}\n` +
        `🚗 <b>Автомобиль:</b> ${leadData.car || "Уточняется"}\n` +
        `🛠 <b>Услуги:</b> ${leadData.service || "Детейлинг-комплекс"}\n` +
        `💰 <b>Предварительная сумма:</b> ${leadData.price || "По согласованию"}\n` +
        `📅 <b>Время / Запись:</b> <b>${leadData.slot || "По согласованию"}</b>\n` +
        `📞 <b>Контакты клиента:</b> <code>${leadData.phone || leadData.contactDisplay || "Не указан"}</code>\n` +
        `🌐 <b>Источник:</b> Демо-стенд (веб-виджет)\n` +
        `━━━━━━━━━━━━━━━\n` +
        `<i>✅ Заявка сохранена в Google Таблицу и передана вам!</i>`;

      fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_ADMIN_ID,
          text: cardText,
          parse_mode: "HTML"
        })
      }).catch(err => console.warn("[ECM Widget] Telegram notify notice:", err));
    } catch (e) {
      console.warn("[ECM Widget] Telegram notify error:", e);
    }
  }

  function appendStreamBotShell(streamEl) {
    if (!streamEl) return null;
    const msgRow = document.createElement('div');
    msgRow.className = 'ecm-msg bot';
    const bubble = document.createElement('div');
    bubble.className = 'ecm-bot-bubble';
    const textSpan = document.createElement('span');
    bubble.appendChild(textSpan);
    msgRow.appendChild(bubble);
    streamEl.appendChild(msgRow);
    return { container: streamEl, msgRow: msgRow, bubble: bubble, textEl: textSpan };
  }

  async function handleUserSend(text) {
    if (isSending) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Если пользователь пишет во время стартового автовоспроизведения — завершаем автоплей чисто
    if (messages.length < 2) {
      cancelActiveAnimations();
      messages = getInitialMessages();
      renderAllStreams('top');
    } else {
      cancelActiveAnimations();
    }

    const myRunId = ++streamRunId;
    isSending = true;
    setControlsState(true);

    try {
      const count = incrementMessageCount();
      if (count > MAX_DEMO_MESSAGES) {
        const userMsg = { role: 'user', text: trimmed };
        const limitMsg = {
          role: 'bot',
          isEstimate: false,
          text: 'Достигнут лимит демонстрационной сессии. Нажмите кнопку обновления в шапке чата для сброса.'
        };
        messages.push(userMsg, limitMsg);
        renderAllStreams('bottom');
        return;
      }

      const userMsg = { role: 'user', text: trimmed };
      messages.push(userMsg);
      [inlineStream, isFloatingOpen ? floatingStream : null].forEach(s => {
        if (!s) return;
        s.appendChild(createMessageElement(userMsg));
        scrollStreamSoftly(s, true);
      });

      const timePref = extractTimePreference(trimmed);
      if (timePref) {
        if (!timePref.includes('завтра') && !timePref.includes('сегодня') && !timePref.includes('суббот') && !timePref.includes('воскресень') && !timePref.includes('понедельник') && !timePref.includes('вторник') && !timePref.includes('сред') && !timePref.includes('четверг') && !timePref.includes('пятниц') && activeOrderState.slot) {
          const lowSlot = activeOrderState.slot.toLowerCase();
          let dayPrefix = '';
          if (lowSlot.includes('завтра')) dayPrefix = 'на завтра';
          else if (lowSlot.includes('сегодня')) dayPrefix = 'на сегодня';
          else if (lowSlot.includes('послезавтра')) dayPrefix = 'на послезавтра';
          else if (lowSlot.includes('суббот')) dayPrefix = 'на субботу';
          else if (lowSlot.includes('воскресень')) dayPrefix = 'на воскресенье';
          else if (lowSlot.includes('понедельник')) dayPrefix = 'на понедельник';
          else if (lowSlot.includes('вторник')) dayPrefix = 'на вторник';
          else if (lowSlot.includes('сред')) dayPrefix = 'на среду';
          else if (lowSlot.includes('четверг')) dayPrefix = 'на четверг';
          else if (lowSlot.includes('пятниц')) dayPrefix = 'на пятницу';
          else if (lowSlot.includes('выходн')) dayPrefix = 'на выходные';
          activeOrderState.slot = dayPrefix ? `${dayPrefix} ${timePref}` : timePref;
        } else {
          activeOrderState.slot = timePref;
        }
      }

      const contactInfo = extractContactInfo(trimmed);
      const refusalMode = isRefusal(trimmed, '');
      const b2bMode = isLeadershipOrB2bQuery(trimmed);

      showTyping();
      const rawResult = await queryAi(trimmed, messages, contactInfo);
      if (myRunId !== streamRunId) return;
      hideTyping();

      const rawCleanText = stripCodePieces(rawResult.text);
      const isFinalBooking = !!contactInfo && !refusalMode && !b2bMode;

      let finalLeadText = rawCleanText;
      let finalBreakdown = (!isFinalBooking && rawResult.breakdown) ? rawResult.breakdown : null;
      if (!isFinalBooking && !finalBreakdown && rawCleanText) {
        const parsed = extractBreakdownFromText(rawCleanText);
        finalLeadText = parsed.leadText;
        finalBreakdown = parsed.breakdown;
      }

      let estimate = null;
      if (!refusalMode && !b2bMode) {
        estimate = rawResult.estimate || extractEstimate(rawResult.rawText || rawResult.text, trimmed, contactInfo);
      }
      if (contactInfo && !estimate && !refusalMode && !b2bMode && activeOrderState.carModel && activeOrderState.carClass) {
        estimate = Object.assign({}, activeOrderState, {
          isEstimate: true,
          slot: activeOrderState.slot || 'по согласованию'
        });
      }

      if (finalLeadText || finalBreakdown) {
        messages.push({ role: 'bot', isEstimate: false, text: finalLeadText, breakdown: finalBreakdown });
        const targets = [];
        if (finalLeadText) {
          const inlineTarget = appendStreamBotShell(inlineStream);
          if (inlineTarget) targets.push(inlineTarget);
          if (isFloatingOpen && floatingStream) {
            const floatTarget = appendStreamBotShell(floatingStream);
            if (floatTarget) targets.push(floatTarget);
          }
          const ok = await streamTextToTargets(finalLeadText, targets, { runId: myRunId, autoScroll: true });
          if (!ok) return;
        }
        if (finalBreakdown && myRunId === streamRunId) {
          if (targets.length) {
            targets.forEach(t => {
              const temp = document.createElement('div');
              temp.innerHTML = buildBreakdownCardHtml(finalBreakdown, { stagger: !prefersReduced }).trim();
              if (temp.firstElementChild && t.msgRow) {
                t.msgRow.appendChild(temp.firstElementChild);
                scrollStreamSoftly(t.container, true);
              }
            });
          } else {
            [inlineStream, isFloatingOpen ? floatingStream : null].forEach(s => {
              if (!s) return;
              s.appendChild(createMessageElement({ role: 'bot', isEstimate: false, text: '', breakdown: finalBreakdown }, { stagger: !prefersReduced }));
              scrollStreamSoftly(s, true);
            });
          }
        }
      }

      if (isFinalBooking) {
        const estClass = (estimate && estimate.carClass) || activeOrderState.carClass || 'Внедорожник';
        const estModel = (estimate && estimate.carModel) || activeOrderState.carModel || 'Автомобиль клиента';
        const estService = (estimate && estimate.serviceName) || activeOrderState.serviceName || 'Восстановительная полировка кузова';
        const estBasePrice = (estimate && estimate.basePrice !== undefined && estimate.basePrice !== null && !isNaN(estimate.basePrice))
          ? Number(estimate.basePrice) : (activeOrderState.basePrice || 18000);
        const isExcl = (estimate && estimate.upsellExcluded) || !!activeOrderState.upsellExcluded;
        const estUpsellPrice = isExcl ? 0
          : ((estimate && estimate.upsellPrice !== undefined && estimate.upsellPrice !== null && !isNaN(estimate.upsellPrice))
              ? Number(estimate.upsellPrice) : (activeOrderState.upsellPrice !== undefined ? activeOrderState.upsellPrice : 0));
        const estUpsellName = isExcl ? 'Без дополнительных опций'
          : ((estimate && estimate.upsellName) || activeOrderState.upsellName || (estUpsellPrice > 0 ? 'Нанокерамика 9H (2 слоя)' : 'Без дополнительных опций'));
        const estTotalPrice = (estimate && estimate.totalPrice !== undefined && estimate.totalPrice !== null && !isNaN(estimate.totalPrice))
          ? Number(estimate.totalPrice) : (estBasePrice + estUpsellPrice);
        const estSlot = (estimate && estimate.slot) || activeOrderState.slot || 'по согласованию';

        const finalOrderCard = {
          role: 'bot',
          isEstimate: true,
          isFinalConfirmed: true,
          carModel: estModel,
          carClass: estClass,
          serviceName: estService,
          basePrice: estBasePrice,
          upsellName: estUpsellName,
          upsellPrice: estUpsellPrice,
          totalPrice: estTotalPrice,
          slot: estSlot
        };

        const prevConfirmedIdx = messages.findIndex(m => m.isEstimate && !m.isInitialSample);
        if (prevConfirmedIdx !== -1) messages.splice(prevConfirmedIdx, 1);
        messages.push(finalOrderCard);

        [inlineStream, isFloatingOpen ? floatingStream : null].forEach(s => {
          if (!s) return;
          const cardWrap = createMessageElement(finalOrderCard, { stagger: true });
          s.appendChild(cardWrap);
          scrollStreamSoftly(s, true);
        });

        const clientDisplayName = contactInfo.name
          ? `${contactInfo.name} / ${estModel} (${estClass})`
          : `${estModel} (${estClass})`;

        syncLeadToExternalServices({
          client: clientDisplayName,
          car: `${estModel} (${estClass})`,
          service: `${estService}${estUpsellPrice > 0 ? ' + ' + estUpsellName : ''}`,
          price: `${Number(estTotalPrice).toLocaleString('ru-RU')} ₽`,
          slot: estSlot,
          phone: contactInfo.phone || contactInfo.display,
          tg_username: contactInfo.telegram || (contactInfo.type === 'telegram' ? contactInfo.value : ''),
          contactDisplay: contactInfo.display
        });

        try {
          window.dispatchEvent(new CustomEvent('ecm-lead-created', {
            detail: {
              client: contactInfo.name || 'Посетитель сайта',
              contact: contactInfo.display,
              car: `${estModel} (${estClass})`,
              service: `${estService}${estUpsellPrice > 0 ? ' + ' + estUpsellName : ''}`,
              cost: `${Number(estTotalPrice).toLocaleString('ru-RU')} ₽`,
              source: 'Виджет на сайте',
              status: 'Бронь подтверждена'
            }
          }));
        } catch (e) {}
      } else if (activeOrderState.carModel || (estimate && estimate.carModel)) {
        try {
          const curCar = (estimate && estimate.carModel) || activeOrderState.carModel;
          const curClass = (estimate && estimate.carClass) || activeOrderState.carClass || '';
          const curService = (estimate && estimate.serviceName) || activeOrderState.serviceName || 'Детейлинг-комплекс';
          const curBase = (estimate && estimate.basePrice) || activeOrderState.basePrice || 18000;
          const curUpsell = activeOrderState.upsellExcluded ? 0 : ((estimate && estimate.upsellPrice) || activeOrderState.upsellPrice || 0);
          const curCost = curBase + curUpsell;

          window.dispatchEvent(new CustomEvent('ecm-lead-created', {
            detail: {
              client: 'Онлайн-посетитель',
              contact: 'Расчёт сметы в диалоге',
              car: `${curCar} (${curClass})`.trim(),
              service: curService + (curUpsell > 0 ? ` + ${activeOrderState.upsellName || 'керамика 9H'}` : ''),
              cost: `${Number(curCost).toLocaleString('ru-RU')} ₽`,
              source: 'Виджет на сайте',
              status: 'Расчёт сметы'
            }
          }));
        } catch (e) {}
      }
    } finally {
      if (myRunId === streamRunId) {
        isSending = false;
        setControlsState(false);
      }
    }
  }

  // ─── 12. ПЕРВИЧНОЕ ЖИВОЕ АВТОПРОИГРЫВАНИЕ НА ПЕРВОМ ЭКРАНЕ ────────
  async function runAutoplay() {
    cancelActiveAnimations();
    const myRunId = ++streamRunId;
    resetActiveOrderState();

    const initialList = getInitialMessages();
    const greetingMsg = initialList[0];
    const sampleEstimate = initialList[1];

    if (prefersReduced || !inlineStream) {
      messages = initialList;
      renderAllStreams('top');
      return;
    }

    const activeStreams = [inlineStream, isFloatingOpen ? floatingStream : null].filter(Boolean);
    messages = [greetingMsg, sampleEstimate];
    activeStreams.forEach(s => {
      s.innerHTML = '';
      s.scrollTop = 0;
    });

    await new Promise(r => setTimeout(r, 240));
    if (myRunId !== streamRunId) return;

    showTyping();
    await new Promise(r => setTimeout(r, 420));
    if (myRunId !== streamRunId) return;
    hideTyping();

    const greetingTargets = activeStreams.map(s => appendStreamBotShell(s)).filter(Boolean);
    if (!greetingTargets.length) return;

    const ok = await streamTextToTargets(greetingMsg.text, greetingTargets, { runId: myRunId, autoScroll: false });
    if (!ok || myRunId !== streamRunId) return;

    await new Promise(r => setTimeout(r, 160));
    if (myRunId !== streamRunId) return;

    const spawnedCards = [];
    activeStreams.forEach(s => {
      const cardNode = createMessageElement(sampleEstimate, {
        stagger: true,
        initialTotalStart: sampleEstimate.basePrice
      });
      s.appendChild(cardNode);
      s.scrollTop = 0;
      spawnedCards.push(cardNode);
    });

    // Плавно обновляем «Итого» при появлении второй позиции
    setTimeout(() => {
      if (myRunId !== streamRunId) return;
      spawnedCards.forEach(cardNode => {
        animateTotalCounter(cardNode, sampleEstimate.basePrice, sampleEstimate.totalPrice, 460);
      });
    }, 220);
  }

  function resetConversation() {
    try {
      localStorage.removeItem(USAGE_KEY);
      localStorage.removeItem(MSGS_KEY);
    } catch (e) {}
    isSending = false;
    setControlsState(false);
    runAutoplay();
  }

  // ─── 13. ПУБЛИЧНЫЙ API WINDOW.ECMWIDGET ────────────────────────────
  window.EcmWidget = {
    detectCar: detectCar,
    detectCarDetails: detectCar,
    parseMessageEntities: parseMessageEntities,
    parseTimeEntity: parseTimeEntity,
    extractTimePreference: extractTimePreference,
    getSmartFallback: getSmartFallback,
    isEstimateRequest: isEstimateRequest,
    computeEstimateForCar: computeEstimateForCar,
    getActiveOrderState: function () { return activeOrderState; },
    setActiveOrderState: function (s) { activeOrderState = Object.assign({}, activeOrderState, s); },
    resetActiveOrderState: resetActiveOrderState,
    getMessages: function () { return messages; },

    setTheme: function (themeNameOrTokens) {
      if (typeof themeNameOrTokens === 'string') {
        const key = themeNameOrTokens === 'light' ? 'epoxy' : themeNameOrTokens;
        if (THEMES[key]) activeTheme = THEMES[key];
      } else if (typeof themeNameOrTokens === 'object' && themeNameOrTokens !== null) {
        activeTheme = Object.assign({}, activeTheme, themeNameOrTokens);
      }

      const varsCss = generateThemeVarsCss(activeTheme);
      floatingVarsStyleEl.textContent = varsCss;
      if (inlineVarsStyleEl) {
        inlineVarsStyleEl.textContent = varsCss;
      }

      host.setAttribute('data-theme', activeTheme.name || 'custom');
    },

    sendMessage: function (text) {
      return handleUserSend(text);
    },

    focus: function () {
      if (isFloatingOpen && floatingInput) {
        floatingInput.focus();
      } else if (inlineInput) {
        inlineInput.focus();
      }
    },

    open: function () {
      toggleFloating(true);
    },

    close: function () {
      toggleFloating(false);
    }
  };

  window.ECMWidget = window.EcmWidget;
  window.openEcmWidget = function () { window.EcmWidget.open(); };
  window.closeEcmWidget = function () { window.EcmWidget.close(); };

  // ─── 14. ТАЙМЕР ОКНА БРОНИ (15:00) ────────────────────────────────
  let holdCountdownSec = 15 * 60;
  let holdTimerInterval = null;

  function initHoldTimer() {
    if (holdTimerInterval) clearInterval(holdTimerInterval);
    holdTimerInterval = setInterval(() => {
      if (holdCountdownSec > 0) holdCountdownSec -= 1;
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
      if (inlineHost && inlineHost.shadowRoot) updateElements(inlineHost.shadowRoot);

      if (holdCountdownSec <= 0 && holdTimerInterval) {
        clearInterval(holdTimerInterval);
      }
    }, 1000);
  }

  async function loadStudioPersonalization() {
    if (!STUDIO_CONFIG.studio_id || STUDIO_CONFIG.studio_id === 'default') return;
    try {
      const resp = await fetch(`/api/config/${STUDIO_CONFIG.studio_id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.company_name) {
          STUDIO_CONFIG.company_name = data.company_name;
          shadow.querySelectorAll('.ecm-title').forEach(el => { el.textContent = data.company_name; });
          const inlineHost = document.getElementById('ecm-inline-shadow-host');
          if (inlineHost && inlineHost.shadowRoot) {
            inlineHost.shadowRoot.querySelectorAll('.ecm-title').forEach(el => { el.textContent = data.company_name; });
          }
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

  loadStudioPersonalization();
  initHoldTimer();
  runAutoplay();
})();
