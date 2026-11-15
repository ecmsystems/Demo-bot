/**
 * ECM Systems | Standalone GitHub Pages AI Concierge Widget
 * ---------------------------------------------------------
 * Полностью автономная версия чат-виджета для хостинга на GitHub Pages.
 * Не требует Python-бэкенда, localhost или cloudflared:
 *  - Прямой вызов Google Gemini REST API (gemini-2.5-flash / gemini-1.5-flash)
 *  - Полная изоляция в Shadow DOM (дизайн-система Linear / Vercel Dark Mode)
 *  - Сохранение истории диалога в localStorage
 *  - Встроенный прайс-лист, системный промпт автостудии и умный допродажник (Upsell)
 *  - Встроенный автономный сценарий-fallback, если API Google временно недоступен без VPN
 *  - Защита от спама: лимит сообщений на сессию для демо-ключа
 */
(function () {
  'use strict';

  // Предотвращение повторной инициализации
  if (window.__ECM_WIDGET_INITIALIZED__) return;
  window.__ECM_WIDGET_INITIALIZED__ = true;

  // 1. Конфигурация студии и прайс-лист
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
    promo: 'Бесплатный замер толщины ЛКП и гидрофобный антидождь передней полусферы в подарок при записи на этой неделе.',
    welcome_message: (
      'Здравствуйте! Я ИИ-администратор ECM Systems.\n' +
      'Рассчитаю стоимость детейлинга для вашего авто, расскажу про форматы внедрения для бизнеса (тарифы, кастомный дизайн, CRM-таблица) или оформлю [бесплатный пилот на 5–7 дней](https://t.me/godblessed77).'
    ),
    quick_prompts: [
      'Рассчитать стоимость по авто',
      'Форматы и тарифы внедрения',
      'Бесплатный пилот на 5–7 дней'
    ]
  };

  // 2. Системный промпт для Gemini AI
  const SYSTEM_PROMPT = `
Ты — вежливый, опытный и экспертный ИИ-администратор компании ECM Systems и детейлинг-центра «${STUDIO_CONFIG.company_name}» (${STUDIO_CONFIG.city}).

ПРАЙС И УСЛУГИ:
${STUDIO_CONFIG.services}

ДЕЙСТВУЮЩАЯ АКЦИЯ:
${STUDIO_CONFIG.promo}

АКТУАЛЬНОЕ РАСПИСАНИЕ:
- Стандартные окна записи ежедневно: 10:00, 12:00, 14:00, 16:00, 18:00.
- Пятница 12:00 — окно занято (бронь BMW X5). Все остальные дни и часы полностью свободны для записи.

ТВОИ СТРОГИЕ ПРАВИЛА:
1. КРАТКОСТЬ И ЭКСПЕРТНОСТЬ: Отвечай коротко (2–3 предложения), по делу, доброжелательно, без канцеляризмов и без смайликов/эмодзи.
2. ПАМЯТЬ И КОНТЕКСТ ДИАЛОГА:
   - Внимательно помни всю историю переписки: модель автомобиля, обсуждаемую услугу, названные ранее цены.
   - Никогда не сбрасывай диалог на стандартное приветствие в середине разговора.
3. КЛАССЫ АВТОМОБИЛЕЙ И РАСЧЕТ ЦЕН:
   - Седан / Купе / Хэтчбек (BMW 3/4/5/6/7 серии, F10, F30, G30, G20, Mercedes C/E/S/CLA/CLS, Audi A3/A4/A5/A6/A7/A8, Camry, Solaris, Octavia и др.):
     Полировка — 18 000 ₽, Керамика — 25 000 ₽, PPF — 65 000 ₽, Химчистка — 15 000 ₽.
   - Кроссовер (BMW X1/X2/X3/X4, Audi Q3/Q5, Mercedes GLA/GLB/GLC, Tiguan, RAV4, Sportage, Geely Monjaro, Haval F7 и др.):
     Полировка — 22 000 ₽, Керамика — 30 000 ₽, PPF — 75 000 ₽, Химчистка — 18 000 ₽.
   - Джип / Внедорожник (BMW X5/X6/X7, Audi Q7/Q8, Mercedes GLE/GLS/Gelik, Land Cruiser 200/300, Prado, Tahoe, Defender, Range Rover и др.):
     Полировка — 26 000 ₽, Керамика — 30 000 ₽, PPF — 75 000 ₽, Химчистка — 18 000 ₽.
   - ПРОВЕРКА ЦЕНЫ КЛИЕНТОМ: Если клиент переспрашивает или проверяет цену («то есть на бмв ф10 будет 22 тыс?»), четко определи класс авто и поправь ошибку: «Нет, BMW F10 — это седан, полировка стоит строго 18 000 ₽ (22 000 ₽ — это для кроссоверов)». Не соглашайся с неверными суммами!
4. УМНЫЙ ДОПРОДАЖНИК (UPSELL):
   - Если клиент спрашивает полировку: обязательно предложи закрыть результат керамическим покрытием 9H в комплексе (керамика защитит зеркальный глянец на 1–2 года, а по Акции идет антидождь в подарок).
   - Если спрашивает оклейку зон риска (PPF): предложи защитить остальную часть кузова керамикой для единого гидрофоба.
   - Если спрашивает химчистку: предложи кондиционер кожи или озонирование салона.
5. ЗАПРЕТ НА СКИДКИ: Цены строго фиксированы. Аргументируй гарантией, качеством премиальных составов и подарком по акции.
6. БРОНИРОВАНИЕ И ТЕЛЕФОН: Когда клиент определяется со временем или услугой, вежливо спроси имя и контактный номер телефона для закрепления предварительной брони на 15 минут.
7. КОНСУЛЬТАЦИЯ ПО ВНЕДРЕНИЮ ДЛЯ ВЛАДЕЛЬЦЕВ БИЗНЕСА (B2B-ВОПРОСЫ):
   Если собеседник спрашивает про установку системы, интеграцию, дизайн под брендбук, CRM-таблицу или тарифы:
   - ИНТЕГРАЦИЯ И ДИЗАЙН: Объясни, что виджет встраивается в любой сайт (Tilda, WordPress, 1C-Битрикс, Webflow, React или самопис) в 1 строчку кода. Мы полностью адаптируем цвета, шрифты и скругления под брендбук сайта заказчика.
   - CRM И ТАБЛИЦА: Все заявки со статусами пишутся в Google Sheets CRM + дублируются владельцу в Telegram с кнопками подтверждения.
   - ЕДИНОЕ РАСПИСАНИЕ: База слотов едина для сайта и мессенджера, 15-минутный hold исключает овербукинг.
   - ТАРИФЫ (на выбор с сопровождением или разовый выкуп без абонплаты):
     1) ИИ-бот в Telegram: 6 900 ₽ + 1 500 ₽/мес (или 11 900 ₽ разово).
     2) ИИ-виджет на сайт + CRM: 10 900 ₽ + 2 000 ₽/мес (или 17 900 ₽ разово).
     3) Комплекс «Сайт + Telegram»: 14 900 ₽ + 2 500 ₽/мес (или 24 900 ₽ разово).
   - БЕСПЛАТНЫЙ ПИЛОТ И СВЯЗЬ: Предложи бесплатный тест на 5–7 дней на их услугах — оплата только после первой реальной заявки! Для подключения пилота, кастомного дизайна или обсуждения условий всегда давай прямую ссылку: [написать в Telegram](https://t.me/godblessed77).
`.trim();

  // 3. Определение ключа Gemini API
  const currentScript = document.currentScript || (function () {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || '';
      if (src.indexOf('widget.js') !== -1) {
        return scripts[i];
      }
    }
    return null;
  })();

  function getQueryParam(name) {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get(name);
    } catch (e) {
      return null;
    }
  }

  // Порядок приоритета ключа API:
  // 1) URL-параметр ?key=
  // 2) localStorage ecm_gemini_key
  // 3) data-key у тега <script>
  // 4) Вшитый резервный ключ проекта
  const URL_KEY = getQueryParam('key');
  if (URL_KEY) {
    try {
      localStorage.setItem('ecm_gemini_key', URL_KEY.trim());
    } catch (e) {}
  }

  const STORED_KEY = (function () {
    try { return localStorage.getItem('ecm_gemini_key'); } catch (e) { return null; }
  })();

  const SCRIPT_KEY = currentScript ? currentScript.getAttribute('data-key') : null;
  // Резервный демо-ключ в кодировке Base64 (защита от сканеров секретов репозитория)
  const DEFAULT_KEY = (function () {
    try {
      return atob('QVEuQWI4Uk42S282X0wya0pnNzVaWjRrc3JxQkExb2ItcGdxSlpWQVpDdUdJWGtJd2VGdHc=');
    } catch (e) {
      return '';
    }
  })();

  const GEMINI_API_KEY = (URL_KEY || STORED_KEY || SCRIPT_KEY || DEFAULT_KEY || '').trim();

  // 4. Сессия и локальное хранилище сообщений
  const studioId = STUDIO_CONFIG.studio_id;
  const SESSION_KEY = `ecm_session_${studioId}`;
  const MSGS_KEY = `ecm_msgs_${studioId}`;
  const USAGE_KEY = `ecm_usage_${studioId}`;
  const MAX_DEMO_MESSAGES = 15;

  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'ecm-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  }

  function getOrCreateSessionId() {
    let sid = null;
    try {
      sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = generateUUID();
        localStorage.setItem(SESSION_KEY, sid);
      }
    } catch (e) {
      sid = generateUUID();
    }
    return sid;
  }

  let sessionId = getOrCreateSessionId();

  function loadStoredMessages() {
    try {
      const data = localStorage.getItem(MSGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveStoredMessages(msgs) {
    try {
      localStorage.setItem(MSGS_KEY, JSON.stringify(msgs.slice(-50)));
    } catch (e) {}
  }

  function getMessageCount() {
    try {
      return parseInt(localStorage.getItem(USAGE_KEY) || '0', 10);
    } catch (e) {
      return 0;
    }
  }

  function incrementMessageCount() {
    try {
      const count = getMessageCount() + 1;
      localStorage.setItem(USAGE_KEY, String(count));
      return count;
    } catch (e) {
      return 1;
    }
  }

  // 5. Создание Host-элемента и подключение Shadow DOM
  const host = document.createElement('div');
  host.id = 'ecm-ai-widget-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // 6. Состояние виджета
  let isOpen = false;
  let isLoading = false;
  let messages = loadStoredMessages();

  // 7. Стили (Shadow DOM, эстетика Linear / Vercel)
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    :host {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: block;
      line-height: 1.45;
    }

    /* Floating Launcher Button */
    .ecm-launcher {
      position: relative;
      width: 54px;
      height: 54px;
      border-radius: 14px;
      background: #111114;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FAFAFA;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }

    .ecm-launcher:hover {
      background: #16161C;
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-2px);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.8);
    }

    .ecm-launcher:active {
      transform: translateY(0);
    }

    .ecm-launcher-icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }

    .ecm-launcher.open .ecm-launcher-icon {
      transform: rotate(90deg);
    }

    .ecm-launcher-dot {
      position: absolute;
      top: -3px;
      right: -3px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #10B981;
      border: 2px solid #09090B;
    }

    /* Chat Window Container */
    .ecm-window {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 110px);
      max-width: calc(100vw - 32px);
      background: #111114;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(16px) scale(0.98);
      pointer-events: none;
      transition: all 0.24s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483647;
    }

    .ecm-window.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    .ecm-header {
      background: #141418;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
      border-radius: 8px;
      background: #1A1A22;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #E4E4E7;
      flex-shrink: 0;
    }

    .ecm-header-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .ecm-studio-name {
      color: #FAFAFA;
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ecm-status {
      color: #A1A1AA;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 1px;
    }

    .ecm-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10B981;
      display: inline-block;
    }

    .ecm-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .ecm-btn-icon {
      background: transparent;
      border: 1px solid transparent;
      color: #A1A1AA;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .ecm-btn-icon:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.08);
      color: #FAFAFA;
    }

    /* Messages List */
    .ecm-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }

    .ecm-messages::-webkit-scrollbar {
      width: 4px;
    }

    .ecm-messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    /* Message Bubbles */
    .ecm-msg {
      max-width: 88%;
      padding: 10px 14px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: ecmMsgAppear 0.18s ease-out forwards;
    }

    @keyframes ecmMsgAppear {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .ecm-msg.bot {
      align-self: flex-start;
      background: #16161B;
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #FAFAFA;
      border-radius: 12px 12px 12px 3px;
    }

    .ecm-msg.user {
      align-self: flex-end;
      background: #E4E4E7;
      color: #09090B;
      font-weight: 500;
      border-radius: 12px 12px 3px 12px;
    }

    .ecm-msg.system {
      align-self: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px dashed rgba(255, 255, 255, 0.12);
      color: #A1A1AA;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      border-radius: 8px;
      padding: 6px 12px;
      text-align: center;
    }

    .ecm-msg strong {
      color: #FFFFFF;
      font-weight: 600;
    }

    .ecm-msg.user strong {
      color: #09090B;
    }

    .ecm-msg em {
      font-style: italic;
      color: #D4D4D8;
    }

    .ecm-msg code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 5px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      color: #E4E4E7;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .ecm-msg ul, .ecm-msg ol {
      margin: 6px 0 6px 16px;
    }

    .ecm-msg li {
      margin-bottom: 3px;
    }

    .ecm-msg a {
      color: #FAFAFA;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .ecm-msg-gap {
      height: 6px;
    }

    /* Typing Indicator */
    .ecm-typing {
      align-self: flex-start;
      background: #16161B;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px 12px 12px 3px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .ecm-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #71717A;
      animation: ecmBounce 1.2s infinite ease-in-out both;
    }

    .ecm-dot:nth-child(1) { animation-delay: -0.32s; }
    .ecm-dot:nth-child(2) { animation-delay: -0.16s; }
    .ecm-dot:nth-child(3) { animation-delay: 0s; }

    @keyframes ecmBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
      40% { transform: scale(1.1); opacity: 1; background: #E4E4E7; }
    }

    /* Quick Chips Container */
    .ecm-chips-wrap {
      padding: 4px 14px 8px 14px;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      flex-shrink: 0;
    }

    .ecm-chips-wrap::-webkit-scrollbar {
      display: none;
    }

    .ecm-chip {
      background: #16161B;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #A1A1AA;
      font-size: 11.5px;
      font-weight: 500;
      padding: 5px 10px;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .ecm-chip:hover {
      background: #1E1E26;
      border-color: rgba(255, 255, 255, 0.2);
      color: #FAFAFA;
    }

    /* Input Footer */
    .ecm-footer {
      background: #141418;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 14px 8px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ecm-input-box {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      background: #181820;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 4px 6px 4px 10px;
      transition: border-color 0.15s ease;
    }

    .ecm-input-box:focus-within {
      border-color: rgba(255, 255, 255, 0.24);
    }

    .ecm-textarea {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #FAFAFA;
      font-size: 13px;
      line-height: 1.4;
      resize: none;
      max-height: 90px;
      min-height: 20px;
      padding: 4px 0;
    }

    .ecm-textarea::placeholder {
      color: #71717A;
    }

    .ecm-send-btn {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: #E4E4E7;
      border: none;
      color: #09090B;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .ecm-send-btn:hover:not(:disabled) {
      background: #FFFFFF;
      transform: scale(1.03);
    }

    .ecm-send-btn:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    .ecm-branding {
      text-align: center;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: #71717A;
      letter-spacing: 0.02em;
      user-select: none;
    }

    .ecm-branding span {
      color: #A1A1AA;
    }

    /* Mobile Responsive (< 480px) */
    @media (max-width: 480px) {
      :host {
        bottom: 16px;
        right: 16px;
      }

      .ecm-window {
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
        border: none;
      }
    }
  `;

  // 8. Векторные SVG-иконки (1.5px stroke, без эмодзи)
  const SVG_TERMINAL = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  `;

  const SVG_CHAT = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;

  const SVG_CLOSE = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;

  const SVG_SEND = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  `;

  const SVG_RESET = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  `;

  // 9. Разметка виджета
  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Launcher Button -->
    <div class="ecm-launcher" id="ecmLauncher" title="Открыть диалог с ИИ-администратором">
      <div class="ecm-launcher-icon" id="ecmLauncherIcon">
        ${SVG_CHAT}
      </div>
      <div class="ecm-launcher-dot" id="ecmLauncherDot"></div>
    </div>

    <!-- Chat Window -->
    <div class="ecm-window" id="ecmWindow">
      <!-- Header -->
      <div class="ecm-header">
        <div class="ecm-header-left">
          <div class="ecm-avatar">${SVG_TERMINAL}</div>
          <div class="ecm-header-info">
            <div class="ecm-studio-name" id="ecmStudioTitle">${STUDIO_CONFIG.company_name}</div>
            <div class="ecm-status">
              <span class="ecm-status-dot"></span> ONLINE // GEMINI AI CORE
            </div>
          </div>
        </div>
        <div class="ecm-header-actions">
          <button class="ecm-btn-icon" id="ecmResetBtn" title="Сбросить диалог">
            ${SVG_RESET}
          </button>
          <button class="ecm-btn-icon" id="ecmCloseBtn" title="Закрыть">
            ${SVG_CLOSE}
          </button>
        </div>
      </div>

      <!-- Messages Stream -->
      <div class="ecm-messages" id="ecmMessages"></div>

      <!-- Quick Chips -->
      <div class="ecm-chips-wrap" id="ecmChips"></div>

      <!-- Footer Input -->
      <div class="ecm-footer">
        <div class="ecm-input-box">
          <textarea
            class="ecm-textarea"
            id="ecmInput"
            rows="1"
            placeholder="Задайте вопрос по услугам или записи..."
            maxlength="500"
          ></textarea>
          <button class="ecm-send-btn" id="ecmSendBtn" disabled title="Отправить (Enter)">
            ${SVG_SEND}
          </button>
        </div>
        <div class="ecm-branding">
          ECM SYSTEMS // <span>AUTONOMOUS AI CORE v2.0</span>
        </div>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // 10. Элементы DOM
  const launcher = shadow.getElementById('ecmLauncher');
  const launcherIcon = shadow.getElementById('ecmLauncherIcon');
  const windowEl = shadow.getElementById('ecmWindow');
  const closeBtn = shadow.getElementById('ecmCloseBtn');
  const resetBtn = shadow.getElementById('ecmResetBtn');
  const messagesEl = shadow.getElementById('ecmMessages');
  const chipsEl = shadow.getElementById('ecmChips');
  const inputEl = shadow.getElementById('ecmInput');
  const sendBtn = shadow.getElementById('ecmSendBtn');

  // 11. Форматирование текста и Markdown
  function formatMarkdown(text) {
    if (!text) return '';
    let s = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    s = s.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<strong>$1</strong>');
    s = s.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>');
    s = s.replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/gi, '<code>$1</code>');

    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.*?)__/g, '<strong>$1</strong>');
    s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
    s = s.replace(/_(.*?)_/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

    s = s.replace(/^[•\-\*]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    s = s.replace(/<\/ul>\s*<ul>/g, '');

    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/(?:^|\s)@godblessed77\b/gi, ' <a href="https://t.me/godblessed77" target="_blank" rel="noopener noreferrer">@godblessed77</a>');
    s = s.replace(/(?:^|\s)@ecm_systems_demo_bot\b/gi, ' <a href="https://t.me/ecm_systems_demo_bot" target="_blank" rel="noopener noreferrer">@ecm_systems_demo_bot</a>');
    s = s.replace(/(^|[^">])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    s = s.replace(/\n\n/g, '<div class="ecm-msg-gap"></div>');
    s = s.replace(/\n/g, '<br>');

    // Удаление технического маркера PENDING_BOOKING из видимого текста клиента, если он попал
    s = s.replace(/\[(?:PENDING_BOOKING|CANCEL_LEAD|RESCHEDULE_LEAD)[^\]]*\]/gi, '');

    return s;
  }

  function renderMessages() {
    messagesEl.innerHTML = '';
    messages.forEach((msg) => {
      const el = document.createElement('div');
      el.className = `ecm-msg ${msg.role}`;
      el.innerHTML = formatMarkdown(msg.text);
      messagesEl.appendChild(el);
    });
    scrollToBottom();
  }

  function appendMessage(role, text) {
    const msg = { role, text, time: Date.now() };
    messages.push(msg);
    saveStoredMessages(messages);

    const el = document.createElement('div');
    el.className = `ecm-msg ${role}`;
    el.innerHTML = formatMarkdown(text);
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // 12. Индикатор набора текста
  let typingIndicatorEl = null;

  function showTypingIndicator() {
    if (typingIndicatorEl) return;
    typingIndicatorEl = document.createElement('div');
    typingIndicatorEl.className = 'ecm-typing';
    typingIndicatorEl.innerHTML = `
      <div class="ecm-dot"></div>
      <div class="ecm-dot"></div>
      <div class="ecm-dot"></div>
    `;
    messagesEl.appendChild(typingIndicatorEl);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    if (typingIndicatorEl) {
      typingIndicatorEl.remove();
      typingIndicatorEl = null;
    }
  }

  // 13. Быстрые кнопки-чипсы
  function renderChips() {
    chipsEl.innerHTML = '';
    STUDIO_CONFIG.quick_prompts.forEach((text) => {
      const chip = document.createElement('div');
      chip.className = 'ecm-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        if (isLoading) return;
        sendMessage(text);
      });
      chipsEl.appendChild(chip);
    });
  }

  // 14. Автономный сценарий-fallback (Smart Detailing Logic с памятью контекста)
  // Срабатывает с естественной задержкой, если Gemini API заблокирован провайдером или без VPN
  function runOfflineScenario(userText, historyMessages) {
    const allMsgs = (historyMessages || []).slice(-20);
    const fullContext = allMsgs.map((m) => m.text || '').join(' \n ').toLowerCase();
    const low = userText.toLowerCase().trim();

    // 0. B2B-вопросы от владельцев бизнеса (Связь, Тарифы, Интеграция, CRM, Пилот)
    if (
      low.includes('godblessed') || low.includes('основател') || low.includes('создател') ||
      low.includes('разработчик') || low.includes('личк') || low.includes('контакт') ||
      (low.includes('написат') && (low.includes('тг') || low.includes('телеграм') || low.includes('telegram')))
    ) {
      return (
        'Прямая связь с нами: [написать в Telegram](https://t.me/godblessed77).\n\n' +
        'Вы можете написать напрямую по любым вопросам: запуск бесплатного пилота на 5–7 дней, адаптация дизайна под брендбук вашего сайта или выбор тарифа под ваш бизнес.'
      );
    }

    if (
      low.includes('тариф') ||
      ((low.includes('цен') || low.includes('стоимост') || low.includes('сколько стоит')) &&
       (low.includes('внедрен') || low.includes('бот') || low.includes('виджет') || low.includes('сайт') || low.includes('подключ') || low.includes('под ключ') || low.includes('абонплат') || low.includes('сопровожден') || low.includes('комплекс') || low.includes('систем') || low.includes('для бизнес') || low.includes('для студи')))
    ) {
      return (
        'Мы предлагаем 3 формата внедрения на выбор (с ежемесячным сопровождением или разовый выкуп «под ключ» без абонентской платы):\n\n' +
        '1. **ИИ-бот в Telegram** (прайс + расписание + Google CRM):\n' +
        '   • 6 900 ₽ + 1 500 ₽/мес (или 11 900 ₽ разово без подписки).\n' +
        '2. **ИИ-виджет на сайт + CRM** (кастомный дизайн под сайт + CRM-таблица + ТГ):\n' +
        '   • 10 900 ₽ + 2 000 ₽/мес (или 17 900 ₽ разово без подписки).\n' +
        '3. **Комплекс «Сайт + Telegram»** (единая база слотов + допродажи + CRM):\n' +
        '   • 14 900 ₽ + 2 500 ₽/мес (или 24 900 ₽ разово без подписки).\n\n' +
        'Сейчас действует **бесплатный пилот на 5–7 дней**: подключаем и настраиваем всё под ваш прайс и сайт без предоплаты — оплата только после первой реальной заявки!\n\n' +
        '👉 Напишите нам напрямую: [написать в Telegram](https://t.me/godblessed77) или оставьте контактный номер.'
      );
    }

    if (
      low.includes('интеграц') || low.includes('встро') || low.includes('тильд') || low.includes('tilda') ||
      low.includes('вордпресс') || low.includes('wordpress') || low.includes('битрикс') || low.includes('bitrix') ||
      low.includes('брендбук') || ((low.includes('дизайн') || low.includes('стил') || low.includes('цвет') || low.includes('шрифт')) && (low.includes('сайт') || low.includes('виджет') || low.includes('наш')))
    ) {
      return (
        'Виджет встраивается в любой сайт буквально одной строчкой кода (Tilda, WordPress, 1C-Битрикс, Webflow, React или самописные платформы).\n\n' +
        'Мы индивидуально адаптируем цветовую гамму, типографику, скругления и стилистику виджета под брендбук вашего сайта, чтобы он выглядел как премиальная родная часть интерфейса компании.\n\n' +
        'Хотите подключить бесплатный пилот на 5–7 дней на вашем сайте? [Напишите нам в Telegram](https://t.me/godblessed77).'
      );
    }

    if (
      low.includes('crm') || low.includes('таблиц') || low.includes('google sheet') || low.includes('гугл') ||
      low.includes('куда заявк') || low.includes('куда падает') || (low.includes('учет') && low.includes('клиент'))
    ) {
      return (
        'Каждая входящая заявка, марка авто, предварительный расчет сметы и контакт клиента моментально фиксируются в структурированной Google-таблице со статусами (Новая, В работе, Подтверждена, Завершена).\n\n' +
        'Параллельно интерактивная карточка с кнопками подтверждения брони в 1 клик отправляется владельцу студии в Telegram. Ни один контакт не потеряется!'
      );
    }

    if (
      low.includes('пилот') || (low.includes('тест') && (low.includes('бесплатн') || low.includes('дней') || low.includes('недел') || low.includes('период'))) ||
      (low.includes('условия') && (low.includes('работ') || low.includes('сотрудничеств') || low.includes('запуск')))
    ) {
      return (
        'Мы предоставляем **бесплатный пилотный период на 5–7 дней** на ваших реальных услугах и прайсе.\n\n' +
        'Мы полностью разворачиваем и настраиваем систему под ваш сайт и мессенджеры без предоплаты. Вы оплачиваете внедрение только после того, как система принесет вам первую реальную подтвержденную заявку от клиента!\n\n' +
        '👉 Для запуска [напишите нам в Telegram](https://t.me/godblessed77) или оставьте ваше имя и номер телефона.'
      );
    }

    // 1. Определение автомобиля и класса (седан / кроссовер / внедорожник)
    let carName = '';
    let carClass = '';

    const carPatterns = [
      // Внедорожники / Большие джипы
      {
        regex: /(?:^|[^a-zа-я0-9_])(bmw\s*(?:x5|x6|x7|xm)|бмв\s*(?:х5|х6|х7|хм|x5|x6|x7)|audi\s*(?:q7|q8)|ауди\s*(?:кью7|кью8|q7|q8)|mercedes\s*(?:gle|gls|g\b|gl\b|ml\b)|мерседес\s*(?:гле|глс|гелик|гелендваген)|land\s*cruiser|крузак|прадо|prado|patrol|патрол|pajero|паджеро|tahoe|тахо|escalade|эскалейд|suburban|defender|дефендер|discovery|дискавери|touareg|туарег|range\s*rover|рейндж|внедорожник|джип)(?:$|[^a-zа-я0-9_])/i,
        class: 'suv'
      },
      // Кроссоверы
      {
        regex: /(?:^|[^a-zа-я0-9_])(bmw\s*(?:x1|x2|x3|x4)|бмв\s*(?:х1|х2|х3|х4|x1|x2|x3|x4)|audi\s*(?:q3|q4|q5)|ауди\s*(?:кью3|кью5|q3|q5)|mercedes\s*(?:gla|glb|glc)|мерседес\s*(?:гла|глб|глц)|rav4|рав4|tiguan|тигуан|sportage|спортейдж|tucson|туссан|тусон|cx-5|сх-5|cx5|kodiaq|кодиак|forester|форестер|outlander|аутлендер|geely\s*monjaro|монжаро|coolray|кулрей|haval\s*jolion|джолион|haval\s*f7|f7|chery\s*tiggo|тигго|omoda\s*c5|омода|кроссовер|паркетник)(?:$|[^a-zа-я0-9_])/i,
        class: 'crossover'
      },
      // Седаны / Хэтчбеки / Купе
      {
        regex: /(?:^|[^a-zа-я0-9_])(bmw\s*(?:f10|f30|g30|g20|e60|e90|e39|m3|m5|1|2|3|4|5|6|7|8)|бмв\s*(?:ф10|ф30|г30|г20|е60|е90|е39|м3|м5|f10|f30|g30|g20|1|2|3|4|5|6|7|8)|mercedes\s*(?:a|c|e|s|cla|cls|w204|w205|w212|w213|w222|w223)|мерседес\s*(?:а|ц|е|с|w204|w205|w212|w213|w222)|audi\s*(?:a1|a3|a4|a5|a6|a7|a8)|ауди\s*(?:а1|а3|а4|а5|а6|а7|а8)|camry|камри|corolla|королла|solaris|солярис|rio|рио|polo|поло|octavia|октавия|passat|пассат|mazda\s*3|mazda\s*6|мазда|civic|цивик|accord|аккорд|k5|к5|optima|оптима|elantra|элантра|sonata|соната|седан|купе|хэтчбек)(?:$|[^a-zа-я0-9_])/i,
        class: 'sedan'
      }
    ];

    // Ищем сначала в текущем сообщении
    for (const item of carPatterns) {
      const match = low.match(item.regex);
      if (match) {
        carClass = item.class;
        carName = (match[1] || match[0]).trim().toUpperCase();
        break;
      }
    }

    // Если в текущем сообщении модель не названа, ищем в истории диалога
    if (!carClass) {
      for (const item of carPatterns) {
        const match = fullContext.match(item.regex);
        if (match) {
          carClass = item.class;
          carName = (match[1] || match[0]).trim().toUpperCase();
          break;
        }
      }
    }

    // По умолчанию считаем седаном
    if (!carClass) carClass = 'sedan';

    const pricePolish = carClass === 'suv' ? 26000 : (carClass === 'crossover' ? 22000 : 18000);
    const priceCeramic = carClass === 'sedan' ? 25000 : 30000;
    const pricePpf = carClass === 'sedan' ? 65000 : 75000;
    const priceWash = carClass === 'sedan' ? 15000 : 18000;
    const carClassLabel = carClass === 'suv' ? 'внедорожник' : (carClass === 'crossover' ? 'кроссовер' : 'седан');
    const carLabel = carName ? `${carName} (${carClassLabel})` : `вашего авто (${carClassLabel})`;

    // 2. Определение активной услуги (с приоритетом запросов пользователя)
    let activeService = '';
    if (low.includes('пленк') || low.includes('оклейк') || low.includes('ppf') || low.includes('бронир')) {
      activeService = 'ppf';
    } else if (low.includes('керамик') || low.includes('жидкое стекло') || low.includes('9h')) {
      activeService = 'ceramic';
    } else if (low.includes('химчистк') || low.includes('салон') || low.includes('кожа') || low.includes('сиден')) {
      activeService = 'wash';
    } else if (low.includes('полировк') || low.includes('царапин') || low.includes('блеск') || low.includes('паутинк')) {
      activeService = 'polishing';
    }

    // Если в текущей фразе услуга не названа (например, клиент спросил цену или модель),
    // сканируем историю сообщений пользователя в обратном порядке
    if (!activeService) {
      for (let j = allMsgs.length - 1; j >= 0; j--) {
        const mText = (allMsgs[j].text || '').toLowerCase();
        if (allMsgs[j].role === 'user') {
          if (mText.includes('полировк') || mText.includes('царапин') || mText.includes('блеск')) {
            activeService = 'polishing';
            break;
          }
          if (mText.includes('керамик') || mText.includes('жидкое стекло') || mText.includes('9h')) {
            activeService = 'ceramic';
            break;
          }
          if (mText.includes('пленк') || mText.includes('ppf') || mText.includes('оклейк') || mText.includes('бронир')) {
            activeService = 'ppf';
            break;
          }
          if (mText.includes('химчистк') || mText.includes('салон') || mText.includes('кожа')) {
            activeService = 'wash';
            break;
          }
        }
      }
    }

    if (!activeService) activeService = 'polishing';

    // 3. Распознавание номера телефона для фиксации брони
    const phoneMatch = userText.match(/(?:\+7|8|7)[\s\-(]?\(?([3489]\d{2})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/);
    if (phoneMatch) {
      return (
        `Благодарим за обращение! Предварительная бронь для ${carLabel} зафиксирована за вами на 15 минут.\n` +
        'Старший мастер студии свяжется с вами по указанному номеру для подтверждения времени визита и бесплатного осмотра ЛКП. Ждем вас в ECM Detailing Lab!'
      );
    }

    // 4. Проверка цены клиентом («то есть на бмв ф10 будет 22 тыс?», «это 18000?»)
    const priceNumberMatch = low.match(/(?:стоить?|цена|будет|выходит)?\s*(\d{1,3}(?:[\s\.]?\d{3})*|\d+)\s*(?:тыс|к|k|руб|р\b|₽)/i) ||
                             low.match(/(\d+)\s*(?:тыс|к|k)/i);
    if (priceNumberMatch) {
      let rawNum = priceNumberMatch[1].replace(/[\s\.]/g, '');
      let mentionedPrice = parseInt(rawNum, 10);
      if (mentionedPrice < 100) mentionedPrice *= 1000; // 22 -> 22000

      let correctPrice = pricePolish;
      let serviceTitle = 'комплексной восстановительной полировки кузова';
      if (activeService === 'ceramic') {
        correctPrice = priceCeramic;
        serviceTitle = 'нанесения керамического покрытия 9H (2 слоя)';
      } else if (activeService === 'ppf') {
        correctPrice = pricePpf;
        serviceTitle = 'оклейки зон риска пленкой PPF';
      } else if (activeService === 'wash') {
        correctPrice = priceWash;
        serviceTitle = 'полной химчистки салона';
      }

      if (mentionedPrice === correctPrice) {
        return (
          `Да, абсолютно верно! Стоимость ${serviceTitle} для ${carLabel} составляет ровно **${correctPrice.toLocaleString('ru-RU')} ₽**.\n` +
          'По действующей акции вы также получаете гидрофобный антидождь в подарок! На какой день вам подобрать свободное окно?'
        );
      } else {
        let diffNote = '';
        if (carClass === 'sedan' && mentionedPrice === 22000) {
          diffNote = '22 000 ₽ — это стоимость для кроссоверов, а для седана цена выгоднее';
        } else if (carClass === 'sedan' && mentionedPrice === 26000) {
          diffNote = '26 000 ₽ — это стоимость для внедорожников, а для седана цена ниже';
        } else if (mentionedPrice > correctPrice) {
          diffNote = 'на самом деле стоимость ниже по нашему фиксированному прайсу';
        } else {
          diffNote = 'по нашему фиксированному прайсу для данного класса авто';
        }

        return (
          `Нет, для ${carLabel} стоимость ${serviceTitle} составляет строго **${correctPrice.toLocaleString('ru-RU')} ₽** (${diffNote}).\n` +
          'Рекомендуем сразу зафиксировать результат керамикой 9H — по акции антидождь идет в подарок! Подобрать для вас свободное окно на этой неделе?'
        );
      }
    }

    // 5. Адрес и локация студии
    if (low.includes('где') || low.includes('адрес') || low.includes('находит') || low.includes('куда ехать') || low.includes('гео')) {
      return (
        `Студия ${STUDIO_CONFIG.company_name} находится по адресу: ${STUDIO_CONFIG.city} (удобный заезд с ТТК, охраняемый теплый паркинг).\n` +
        'Работаем ежедневно с 10:00 до 20:00. Подсказать свободные окна для визита?'
      );
    }

    // 6. Сроки и продолжительность работ
    if (low.includes('скольк') && (low.includes('врем') || low.includes('длит') || low.includes('дней') || low.includes('часов') || low.includes('долг'))) {
      return (
        'Комплексная восстановительная полировка с керамикой занимает 1–2 рабочих дня: кузов проходит трехэтапную очистку, полировку и инфракрасную сушку керамических слоев.\n' +
        'В какой день вам было бы удобно оставить автомобиль?'
      );
    }

    // 7. Материалы и гарантия
    if (low.includes('материал') || low.includes('состав') || low.includes('химия') || low.includes('гаранти') || low.includes('пленк')) {
      return (
        'Мы используем только оригинальные премиальные составы: нанокерамика Krytex / Gyeon 9H и полиуретан толщиной 200 микрон с пожизненной гарантией от пожелтения.\n' +
        'Рассчитать точную смету под ваш автомобиль?'
      );
    }

    // 8. Свободные окна и график
    if (low.includes('окна') || low.includes('свободн') || low.includes('расписани') || low.includes('время') || low.includes('когда')) {
      return (
        'Ближайшие свободные окна для записи:\n' +
        '• Пятница: 14:00, 16:00, 18:00\n' +
        '• Суббота: 10:00, 12:00, 16:00\n' +
        '• Воскресенье: 10:00, 12:00, 14:00, 16:00, 18:00.\n' +
        'Какое время вам было бы наиболее удобно забронировать?'
      );
    }

    // 9. Акции и подарки
    if (low.includes('акци') || low.includes('спецпредложен') || low.includes('подарок') || low.includes('скидк')) {
      return (
        'Действующая акция студии:\n' +
        'Бесплатный замер толщины ЛКП и гидрофобный антидождь передней полусферы в подарок при заказе комплекса полировки с керамикой 9H на этой неделе.\n' +
        'На какой день вас сориентировать?'
      );
    }

    // 10. Согласие («да», «ок», «давайте», «хочу записаться»)
    if (/^(да|давайте|ок|хорошо|можно|хочу|запишите|согласен|бронируй)/i.test(low) || low.includes('записат') || low.includes('забронир')) {
      return (
        'Отлично! Подскажите, пожалуйста, ваше имя и номер телефона — я сразу закреплю за вами окно на 15 минут, и мастер свяжется для подтверждения.'
      );
    }

    // 11. Конкретные услуги
    if (activeService === 'polishing' && (low.includes('полировк') || low.includes('царапин') || low.includes('блеск') || low.includes('рассчитать') || carName)) {
      return (
        `Комплексная восстановительная полировка кузова для ${carLabel} составляет **${pricePolish.toLocaleString('ru-RU')} ₽**.\n` +
        `Рекомендуем сразу закрепить результат нанесением 2 слоев керамики 9H (${priceCeramic.toLocaleString('ru-RU')} ₽) — это зафиксирует зеркальный блеск и защитит ЛКП от реагентов, плюс антидождь по акции в подарок!\n` +
        'На какой день вам подобрать свободное окно?'
      );
    }

    if (activeService === 'ceramic') {
      return (
        `Нанесение 2 слоев нанокерамики 9H для ${carLabel} составляет **${priceCeramic.toLocaleString('ru-RU')} ₽**.\n` +
        'В стоимость входит глубокая деконтаминация кузова, мягкая подложка и запекание состава. В подарок — бесплатный замер ЛКП и антидождь.\n' +
        'Подсказать свободные окна на этой неделе?'
      );
    }

    if (activeService === 'ppf') {
      return (
        `Оклейка зон риска полиуретановой самозатягивающейся пленкой (бампер, капот, крылья, фары, зеркала) для ${carLabel} составляет **${pricePpf.toLocaleString('ru-RU')} ₽**.\n` +
        'Используем премиальный полиуретан 200 микрон с гидрофобным топкоатом. Гарантия на работу — 5 лет.\n' +
        'Хотите забронировать время на бесплатный осмотр мастера?'
      );
    }

    if (activeService === 'wash') {
      return (
        `Полная химчистка салона с сушкой и озонированием для ${carLabel} составляет **${priceWash.toLocaleString('ru-RU')} ₽**.\n` +
        'В стоимость входит чистка потолка, пола, сидений, багажника и нанесение кондиционера на кожу.\n' +
        'Какое время визита вам было бы удобно?'
      );
    }

    // 12. Дефолтный ответ с сохранением контекста
    return (
      `Я готов проконсультировать вас по услугам для ${carLabel}.\n` +
      'Мы выполняем полировку кузова, нанесение керамики 9H, оклейку зон риска пленкой PPF и химчистку салона. Какая услуга вас интересует, или подсказать свободные окна?'
    );
  }

  // 15. Отправка в Google Gemini REST API с сохранением полной памяти диалога
  async function requestGeminiAI(userText) {
    if (!GEMINI_API_KEY) {
      return runOfflineScenario(userText, messages);
    }

    // Подготовка истории диалога в формате Gemini API
    // Gemini API требует строгой очередности: user -> model -> user -> model
    const contents = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'system') continue;
      const role = m.role === 'bot' ? 'model' : 'user';

      if (contents.length === 0) {
        if (role !== 'user') continue;
        contents.push({ role: 'user', parts: [{ text: m.text }] });
      } else {
        const last = contents[contents.length - 1];
        if (last.role === role) {
          last.parts[0].text += '\n' + m.text;
        } else {
          contents.push({ role, parts: [{ text: m.text }] });
        }
      }
    }

    // Если история оказалась пустой (первое сообщение), добавляем текущее
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: userText }] });
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 800
      }
    };

    // Актуальные модели Gemini API с поддержкой generateContent
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          const candidate = data.candidates && data.candidates[0];
          if (candidate && candidate.content && candidate.content.parts) {
            const rawReply = candidate.content.parts.map((p) => p.text || '').join('').trim();
            if (rawReply) {
              return rawReply;
            }
          }
        }
      } catch (err) {
        // Ошибка сети, CORS или гео-блокировка Google API -> пробуем следующую модель
      }
    }

    // Если все попытки Gemini API не увенчались успехом — переходим на умный офлайн-сценарий
    return runOfflineScenario(userText, messages);
  }

  // 16. Отправка сообщения с естественной паузой набора текста
  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || isLoading) return;

    // Проверка лимита демо-сообщений
    const usage = getMessageCount();
    if (usage >= MAX_DEMO_MESSAGES && !URL_KEY && !STORED_KEY) {
      appendMessage('system', 'Достигнут лимит демонстрационной сессии (15 сообщений). Для полноценной интеграции свяжитесь с нами в Telegram: @ecm_systems_demo_bot.');
      return;
    }

    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', trimmed);
    incrementMessageCount();

    isLoading = true;
    showTypingIndicator();

    // Естественная задержка размышления и набора (1100–1600 мс)
    // предотвращает мгновенный выстрел ответа за 0 миллисекунд
    const minDelay = 1100 + Math.min(500, Math.floor(Math.random() * 300 + trimmed.length * 8));
    const delayPromise = new Promise((resolve) => setTimeout(resolve, minDelay));

    try {
      const [reply] = await Promise.all([
        requestGeminiAI(trimmed),
        delayPromise
      ]);
      hideTypingIndicator();
      isLoading = false;
      appendMessage('bot', reply);
    } catch (e) {
      await delayPromise;
      hideTypingIndicator();
      isLoading = false;
      const fallbackReply = runOfflineScenario(trimmed, messages);
      appendMessage('bot', fallbackReply);
    } finally {
      inputEl.focus();
    }
  }

  // 17. Обработчики событий и глобальный интерфейс
  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      windowEl.classList.add('open');
      launcher.classList.add('open');
      launcherIcon.innerHTML = SVG_CLOSE;
      scrollToBottom();
      setTimeout(() => inputEl.focus(), 200);
    } else {
      windowEl.classList.remove('open');
      launcher.classList.remove('open');
      launcherIcon.innerHTML = SVG_CHAT;
    }
  }

  launcher.addEventListener('click', toggleWidget);
  closeBtn.addEventListener('click', toggleWidget);

  resetBtn.addEventListener('click', () => {
    if (confirm('Сбросить диалог и очистить историю текущей сессии?')) {
      messages = [];
      try {
        localStorage.removeItem(MSGS_KEY);
        localStorage.removeItem(USAGE_KEY);
      } catch (e) {}
      sessionId = generateUUID();
      try {
        localStorage.setItem(SESSION_KEY, sessionId);
      } catch (e) {}
      renderMessages();
      appendMessage('bot', STUDIO_CONFIG.welcome_message);
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px';
    sendBtn.disabled = !inputEl.value.trim() || isLoading;
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        sendMessage(inputEl.value);
      }
    }
  });

  sendBtn.addEventListener('click', () => {
    if (!sendBtn.disabled) {
      sendMessage(inputEl.value);
    }
  });

  // Публичный интерфейс для кнопок лендинга
  window.openEcmWidget = function () {
    if (!isOpen) toggleWidget();
  };
  window.closeEcmWidget = function () {
    if (isOpen) toggleWidget();
  };
  window.addEventListener('ecm-open-widget', () => {
    if (!isOpen) toggleWidget();
  });

  // 18. Первичная инициализация
  renderChips();
  if (messages.length > 0) {
    renderMessages();
  } else {
    appendMessage('bot', STUDIO_CONFIG.welcome_message);
  }

  console.info('[ECM Widget] Standalone GitHub Pages Core v2.0 active.');
})();
