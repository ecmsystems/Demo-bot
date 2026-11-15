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
      'Здравствуйте. Я ИИ-администратор студии ECM Detailing Lab.\n' +
      'Рассчитаю точную стоимость услуг для вашего автомобиля, отвечу на вопросы по материалам и подберу свободное окно для записи.'
    ),
    quick_prompts: [
      'Рассчитать стоимость по авто',
      'Свободные окна на этой неделе',
      'Действующие спецпредложения'
    ]
  };

  // 2. Системный промпт для Gemini AI
  const SYSTEM_PROMPT = `
Ты — вежливый, опытный и экспертный ИИ-администратор детейлинг-центра «${STUDIO_CONFIG.company_name}» (${STUDIO_CONFIG.city}).

ПРАЙС И УСЛУГИ:
${STUDIO_CONFIG.services}

ДЕЙСТВУЮЩАЯ АКЦИЯ:
${STUDIO_CONFIG.promo}

АКТУАЛЬНОЕ РАСПИСАНИЕ:
- Стандартные окна записи ежедневно: 10:00, 12:00, 14:00, 16:00, 18:00.
- Пятница 12:00 — окно занято (бронь BMW X5). Все остальные дни и часы полностью свободны для записи.

ТВОИ СТРОГИЕ ПРАВИЛА:
1. КРАТКОСТЬ И ЭКСПЕРТНОСТЬ: Отвечай коротко (2–3 предложения), по делу, доброжелательно, без канцеляризмов и без смайликов/эмодзи.
2. УМНЫЙ ДОПРОДАЖНИК (UPSELL):
   - Если клиент спрашивает полировку: обязательно предложи закрыть результат керамическим покрытием 9H в комплексе (керамика защитит зеркальный глянец на 1–2 года, а по Акции идет антидождь в подарок).
   - Если спрашивает оклейку зон риска (PPF): предложи защитить остальную часть кузова керамикой для единого гидрофоба.
   - Если спрашивает химчистку: предложи кондиционер кожи или озонирование салона.
3. ТОЧНЫЙ РАСЧЕТ: Учитывай класс автомобиля (Седан, Кроссовер, Джип/Внедорожник) и называй точную стоимость по прайсу.
4. ЗАПРЕТ НА СКИДКИ: Цены фиксированы. Аргументируй гарантией, качеством премиальных составов и подарком по акции.
5. БРОНИРОВАНИЕ И ТЕЛЕФОН: Когда клиент определяется со временем или услугой, вежливо спроси имя и контактный номер телефона для закрепления предварительной брони на 15 минут.
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
  const DEFAULT_KEY = '';

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

    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
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

  // 14. Автономный сценарий-fallback (Smart Detailing Logic)
  // Срабатывает мгновенно, если Gemini API заблокирован провайдером или без VPN
  function runOfflineScenario(userText) {
    const low = userText.toLowerCase().trim();

    // Быстрый чип: Цены / Спецпредложения
    if (low.includes('акци') || low.includes('спецпредложен') || low.includes('подарок')) {
      return (
        'Сейчас у нас действует спецпредложение:\n' +
        'Бесплатный замер толщины ЛКП и гидрофобный антидождь передней полусферы в подарок при заказе комплекса полировки с керамикой 9H на этой неделе.\n' +
        'На какой день и время вас сориентировать?'
      );
    }

    // Быстрый чип: Свободные окна
    if (low.includes('окна') || low.includes('свободн') || low.includes('расписани') || low.includes('время')) {
      return (
        'Ближайшие свободные окна для записи:\n' +
        '• Пятница: 14:00, 16:00, 18:00\n' +
        '• Суббота: 10:00, 12:00, 16:00\n' +
        '• Воскресенье: свободны все окна (10:00 – 18:00).\n' +
        'Какое время вам было бы наиболее удобно забронировать?'
      );
    }

    // Распознавание номера телефона для фиксации брони
    const phoneMatch = userText.match(/(?:\+7|8|7)[\s\-(]?\(?([3489]\d{2})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/);
    if (phoneMatch) {
      return (
        'Благодарим за обращение! Предварительная бронь окна закреплена за вами на 15 минут.\n' +
        'Старший мастер студии свяжется с вами по номеру для подтверждения всех деталей и осмотра авто. Ждем вас!'
      );
    }

    // Распознавание класса авто
    let carType = 'седан';
    let carPricePolishing = '18 000 ₽';
    let carPriceCeramic = '25 000 ₽';
    let carPricePpf = '65 000 ₽';

    if (
      low.includes('джип') || low.includes('внедорожник') || low.includes('x5') || low.includes('x6') ||
      low.includes('x7') || low.includes('q7') || low.includes('q8') || low.includes('gle') ||
      low.includes('gls') || low.includes('cruiser') || low.includes('крузак') || low.includes('prado')
    ) {
      carType = 'внедорожник';
      carPricePolishing = '26 000 ₽';
      carPriceCeramic = '30 000 ₽';
      carPricePpf = '75 000 ₽';
    } else if (
      low.includes('кроссовер') || low.includes('rav4') || low.includes('тигуан') || low.includes('tiguan') ||
      low.includes('sportage') || low.includes('x3') || low.includes('x4') || low.includes('q5') ||
      low.includes('glc') || low.includes('cx-5')
    ) {
      carType = 'кроссовер';
      carPricePolishing = '22 000 ₽';
      carPriceCeramic = '30 000 ₽';
      carPricePpf = '75 000 ₽';
    }

    // Полировка кузова + Upsell керамики
    if (low.includes('полировк') || low.includes('царапин') || low.includes('блеск') || low.includes('рассчитать')) {
      return (
        `Комплексная восстановительная полировка кузова для вашего авто (${carType}) составляет ${carPricePolishing}.\n` +
        `Рекомендуем закрепить результат нанесением 2 слоев керамики 9H (${carPriceCeramic}) — это зафиксирует зеркальный блеск и защитит ЛКП от реагентов, плюс антидождь по акции в подарок!\n` +
        'На какой день вам подобрать свободное окно?'
      );
    }

    // Керамическое покрытие
    if (low.includes('керамик') || low.includes('жидкое стекло')) {
      return (
        `Нанесение 2 слоев нанокерамики 9H составляет ${carPriceCeramic}.\n` +
        'Перед нанесением керамики обязательно выполняется глубокая деконтаминация кузова и мягкая полировка. В подарок — бесплатный замер ЛКП и антидождь.\n' +
        'Подсказать свободные окна на этой неделе?'
      );
    }

    // Оклейка полиуретаном PPF
    if (low.includes('пленк') || low.includes('оклейк') || low.includes('ppf') || low.includes('бронирован')) {
      return (
        `Оклейка зон риска полиуретановой самозатягивающейся пленкой (бампер, капот, крылья, фары, зеркала) составляет ${carPricePpf}.\n` +
        'Используем премиальный полиуретан 200 микрон с гидрофобным топкоатом. Гарантия на работу — 5 лет.\n' +
        'Хотите забронировать время на осмотр мастера?'
      );
    }

    // Химчистка салона
    if (low.includes('химчистк') || low.includes('салон') || low.includes('кожа')) {
      return (
        `Полная химчистка салона с сушкой и озонированием составляет 15 000 – 18 000 ₽ (в зависимости от кузова).\n` +
        'В стоимость входит чистка потолка, пола, сидений, багажника и нанесение кондиционера на кожу.\n' +
        'Какое время визита вам было бы удобно?'
      );
    }

    // Запрос на запись
    if (low.includes('запис') || low.includes('запишите') || low.includes('забронир') || low.includes('пятниц') || low.includes('суббот')) {
      return (
        'Отлично, это время свободно! Подскажите, пожалуйста, ваше имя и номер телефона для закрепления предварительной брони на 15 минут?'
      );
    }

    // Дефолтный ответ
    return (
      'Мы выполняем комплексную полировку кузова, нанесение керамики 9H, бронирование зон риска пленкой PPF и химчистку салона.\n' +
      'Укажите модель вашего автомобиля и интересующую услугу — рассчитаю точную стоимость и расскажу про подарок по акции!'
    );
  }

  // 15. Отправка в Google Gemini REST API с автоматическим Fallback
  async function requestGeminiAI(userText) {
    if (!GEMINI_API_KEY) {
      return runOfflineScenario(userText);
    }

    // Подготовка истории диалога в формате Gemini API
    const contents = [];
    messages.forEach((m) => {
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.text }] });
      } else if (m.role === 'bot') {
        if (contents.length > 0) {
          contents.push({ role: 'model', parts: [{ text: m.text }] });
        }
      }
    });

    contents.push({ role: 'user', parts: [{ text: userText }] });

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800
      }
    };

    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];

    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

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
        // Ошибка сети / CORS / блокировка Google API -> переходим к следующей модели или fallback
      }
    }

    // Если все попытки Gemini API не увенчались успехом (например, блокировка IP без VPN) —
    // возвращаем умный сценарий
    return runOfflineScenario(userText);
  }

  // 16. Отправка сообщения
  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || isLoading) return;

    // Проверка лимита демо-сообщений
    const usage = getMessageCount();
    if (usage >= MAX_DEMO_MESSAGES && !URL_KEY && !STORED_KEY) {
      appendMessage('system', 'Достигнут лимит демонстрационной сессии (15 сообщений). Для полноценной интеграции ИИ свяжитесь с нами в Telegram: @ecm_systems_demo_bot.');
      return;
    }

    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', trimmed);
    incrementMessageCount();

    isLoading = true;
    showTypingIndicator();

    try {
      const reply = await requestGeminiAI(trimmed);
      hideTypingIndicator();
      isLoading = false;
      appendMessage('bot', reply);
    } catch (e) {
      hideTypingIndicator();
      isLoading = false;
      const fallbackReply = runOfflineScenario(trimmed);
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
