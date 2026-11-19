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
      'Записаться на удобное время'
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
- Кроссовер (BMW X3/X4, Audi Q3/Q5, Mercedes GLC, Tiguan, RAV4, Monjaro): Полировка 22 000 ₽, Керамика 9H 30 000 ₽, PPF 75 000 ₽, Химчистка 18 000 ₽.
- Джип / Внедорожник (Audi Q7/Q8, BMW X5/X6/X7, Mercedes GLE/GLS/Гелик, Land Cruiser 200/300, Prado, Porsche Cayenne, Tank 500/300): Полировка 26 000 ₽, Керамика 9H 30 000 ₽, PPF 75 000 ₽, Химчистка 18 000 ₽.

ПРАВИЛО ДОПРОДАЖИ:
К полировке предлагай закрепить результат 2 слоями керамики 9H (+25 000 ₽ для седана, +30 000 ₽ для кроссоверов и внедорожников), а антидождь по акции идёт в подарок (0 ₽). Смету считай честно сложением.
К оклейке PPF предлагай керамику на оставшуюся часть кузова.
К химчистке предлагай защитную пропитку и озонирование (+8 000 ₽).
Если клиент просит только одну базовую услугу или просит без допов — соглашайся и считай только базовую цену с показом сметы.

БРОНИРОВАНИЕ:
Не назначай время сам. Всегда спрашивай у клиента: «На какой день и время вам удобно приехать?». Уточняй имя и номер телефона (или Telegram @никнейм) для закрепления брони.
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
  const ECM_LOGO_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAfCAYAAABXscv8AAAKXUlEQVR42qVZa4xdVRVea+9zzr13rq2l5dFSQVEp0PgqRn8gRjAaQmJEkgaMASE+IAHUEGOMxl8a/OPjhzHRhARL0BARlUcsqGmQIIiPYquhCg0ZHBgItKWdmc7cs9djL39078mZw7l3BtjJzsy9d++193p/a22ACcPM0My8mTl4A+O10DCzYo3rcLXfzMytRq+YQMQhYgQATZ83A8A2Vd0CAJWqTqIbvfcIAOtF5E+IeCDROEtVPxBjPBcRNwGAA4AFRHw2xvhEWZZ7EVHm5uY2DYfDTwFAVNXgvXeqCt57894jM/8PER8xM0REax+OiGZmGxDxGADELJSutWM1lv8XkStE5EFmnrPXOJj52zMzMwNmvlREHmDm0aT1IvJPEbl+dnZ2ipl3ikgYtzaE8IX2XZPF9ojoF6p6RFX3iMhVTaWumfnjx4+/T0QeyQeqqoUQNIQgIQTumBJCIBEhETlGRB8GAGDmOxoCsQn7Y0MQjy8tLZ0xPz9/ioj8R1U1nBgSQghmFolo2syqxDTeddddHgAghLDDzCzGZXKmqnvM7C1dQsA284iodV1fXpblHc65IRFJWucQcZLfmXMuOucshPDRwWCwT1Uf995vJ6LsL6vRiAAQq6oqVHUxhHCRmc32er1/I+JGVTVEdGamVVX5EMLl/X7/nuTn+YwhMz9eluV2IhIzw16vV4jIM0T0kampqRdOeAlGSD64gvnRaHRJWZZ3m9kwhKCIWCCizxdPQo3NmfxMi6LwqvrlqampR0TkL4l5Tvt9k/m011q+6xCxICLx3g97vd6e4XAoqnq1977tw4aIN+SYk35ziHgcEb+mqgYA3jlXEBEXRfGOoih+mXjGFUE0RUs0s63MfERELIQgRGR5JvPXpmnlkb8LITwGAFDX9a70mZo0Eh0hoqYvx/ZZaR2n33cDABDRgfRZ05rIzFLX9fYGD5mPtzJznfiIiR6ZmRHRjQAADz30UNHMAoiIkYi+X5blRiISRCya2qqqyiWffsXMlnK0bUR9BwA3EdH7y7K8hpkFEcu2iVdV5VUVmHkWAHxVVZsBwBNRRMR2kDIAeFfa+xIAnJe+AzPTsiyLGOMXAeDmbM2IKCGEz1VV1Wvx4WOMBgDfMLNdALBkZrgc9EII7xYRJSJtaz4Fpr1mdun8/PzJZjYws76Z9aenp/vp/0Gi86CZxbqu21qVpIE7zWyHmQ3NbD0RXSAiDybtctZ+tqq6rnea2TpmnheR2NBoVFUjopfN7M05GJrZgIhmYoxNa1m2vnTOFcuYIwMFZv5h8xJEZHVda4zRmHnfoUOH1q2WQeq63sYnRuw6mJl/MG4vEd2bTTwJ/Hlmviil4t3ptxVCres6C/W6TCeEcGXX2oZbxRDC3csZL6O9EMJTLR8zItIk5QvSuikzKztmz8ywruub20JMDEUi2p+Cj08za6xIf08SkUdF5LiI3Le4uLh1fn7+ZGZ+ouNey4KNMRoR7cvpLYTwcGLyVQIgIk20XpydnZ1qa06ZuctcHlgr5G1oUTroXDUO6jagK+Z8nTR/ZXID6mBmhYsS0QdHo9HbRSQSURy3noiiqpqZvXc5CHrvtxdF4YhIETEjK1RVQMTTQgg/xRP4MrawgxZFUYjIY71e7/YcsPIaM7OiKDwzz1VVtTvvGQNdc5p7PgkpisgopbhJCC7f6fNFUcx571FVVwTxFYtjjGVZelXdBgD7i4zRG1F3OSfHGKEsyx0AsGM19zeznxPR5pTas5Cic86LyAFEfGUSHs9CSHsNESMzY4ruYwsPRCxEBMzssyl2wDjmm5lLRM5ctgAzO2WCWWeg0zWkqqoCEZ8GgHXOualWkWTp0OcyElyFGUuG4wEAVBWLohiLPBvgDJxzfUSEGGPnmo6zNjVxQH/CpVwTMbYukWkwAPS895A0gC2zG3VB7zcyvPfYZDbl+BVnt9e0Rn8ZCjvn6kn43MykawJAngUABBExRIQMcfNdnHPr2i72OvsKlixiNsa4vyxLS3EJMI1857IsLcb4JADMFEUBbdgNAGFZAGZ2eNyhVVW5qqqKMbMPAIWZnQsA82a26L2HdvlpZmc2AtYkBnMDw02wSDCzEQDcOsGiLP22K8Y43+UFiHhk2QVijNNtEzWz6L13RPQ3APhzulSbgQyR9yJiDCHMIuI5jQtgjBEQ8TwzOw0AXm40Wl6VCtP3uYHhQwiYYkZbe+uZ+V4z+2ZZlqczczMeLGceVf21c+6mLgk5555rxoAnRSQ653zDUsx7D6o61+v1vroWE0XE/QCwLTHhEBFFRKqqGhLRJ3u93q0pwMWu7tNoNDqr3+9/KITwV0Q8WNe1AoAHgNi0YETsDYfD50MIv0LEryQhZV7UOedV9f7BYDAdQhi0w4eZgaoeXNH3CyH8twsJJgh7cVo7Dgn2zQyJ6LouJKiqkZmfTg0M10B/aGZlov02Zj6UUtmx3PEhoq+LiDKzZtATQjhqZmUI4T0d9UuG3ReZmUu1Qq46Y6oRXjKz4YomJDN/b9zlReTA3NzcptUsYGlp6QxmXmoWLU00SES3jfH9KWZ+NJ1fi0juIN2WEWGCvJnO4WPHjm1MKHZv3pe7RSGE6SToLUS0lLpZsVEL/KZZC+RAdR4zS5JmbENNZj7AzDvNbKuZnWRmG5ozC6iu6zvbgmxqRkQeMLOLFxYWTjWzLcx8WQPvS670KDUNiGh3wviPpv0WQjhsZpuScD7d7k8Q0Y1mhsz8saZVZ0XUdb0zKx+b3SAi+llZlteGEMQ5N64fsAgAdQMHACKq976IMX5GRA5WVfWMngDcrt0FynSIaA4RXVmW6zLgakLeFMxURLCqqj4R/biqqutFBGKMR6qqemfq+sLS0tKFVVWd472Huq6fHQwGe5LQflRV1ZdSW88VRYGq+mxZlttzGmymH7ewsHAqEb2Y/KSrIySpkGh3c7Pkn0oH35I+h64KLneWGo3WrkqPkrZ2JQE92dhz+OjRoxsmdXqTO84xc0zmT8karml3k1fkbCK6UETqJATuuFgcM3ML65ZE54+5LdaMB206Yyo8Sm43bWa+GVyTYA+Z2frW402RAnKRWvEPJwFqXdcr3OlVzLdb4qPR6OOqeiT7ZZqTSszst7n0vTL55x8aEZgn0ci9weynIjJjZqen9nxIWYDMTInoX7n/1wGkyhDCfenckIXGzPvNbGPXvk4h1HV9dm5V5cZno4E59l2AmYOIUG47MfN3RIQbNLRrb3ajxPxvp6en+3VdnyMiL4gIJ9q5kXptx6OIS+8Zmztc9HdmdvJrfhxJDHxCRO5h5sOv42XoJ2b2phDC+cx8+yQaKX3+npkvM7NCRG5or1HVxbquvzWOkazdEMJ3zeyIqj4WQrh60svQpEcKl+ry3IXdyMxnI+IWRByoKo6p0iC/4wHAhhjj36uq+keisQkAzlfV7WZ2WozRee8PmdnBoij2IeIMAMDi4uLWXq93CQCMVFW89857PxqNRvumpqZm1vLO13gbXO44rfltsONl17/BKs6thcZa1q2VTiNATnwd/j/RziS9ZD6BzAAAAABJRU5ErkJggg==';

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

      .ecm-chip-btn, .ecm-send, .ecm-icon-btn, .ecm-floating-launcher {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .ecm-chip-btn:active, .ecm-send:active {
        transform: scale(0.96);
        transition: transform 0.08s ease;
      }
      .ecm-chat-window, .ecm-stream, .ecm-msg, .ecm-order-card {
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
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
          width: 100dvw;
          height: 100vh;
          height: 100dvh;
          max-width: none;
          max-height: none;
          border-radius: 0;
          z-index: 2147483647;
          background: var(--w-panel);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .ecm-chat-window {
          border-radius: 0;
          border: none;
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          background: var(--w-panel);
        }
        .ecm-header {
          padding-top: max(16px, env(safe-area-inset-top, 16px));
          padding-left: max(16px, env(safe-area-inset-left, 16px));
          padding-right: max(16px, env(safe-area-inset-right, 16px));
          padding-bottom: 12px;
          min-height: calc(54px + env(safe-area-inset-top, 0px));
          flex-shrink: 0;
          background: var(--w-card);
          border-bottom: 1px solid var(--w-rule);
        }
        .ecm-stream {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          padding: 14px 14px 10px 14px;
          gap: 10px;
        }
        .ecm-chips-strip {
          flex-shrink: 0;
          padding: 4px max(14px, env(safe-area-inset-left, 14px)) 8px max(14px, env(safe-area-inset-right, 14px));
          gap: 6px;
        }
        .ecm-footer {
          flex-shrink: 0;
          padding-top: 8px;
          padding-left: max(12px, env(safe-area-inset-left, 12px));
          padding-right: max(12px, env(safe-area-inset-right, 12px));
          padding-bottom: max(14px, env(safe-area-inset-bottom, 14px));
          background: var(--w-card);
          border-top: 1px solid var(--w-rule);
        }
        .ecm-floating-launcher {
          bottom: max(16px, env(safe-area-inset-bottom, 16px));
          right: 16px;
          width: 50px;
          height: 50px;
        }
        .ecm-order-card {
          margin-top: 2px;
        }
        .ecm-order-table td {
          padding: 7px 10px;
          font-size: 13px;
        }
        .ecm-order-table td.col-price {
          font-size: 15px;
        }
        .ecm-row-total .col-price {
          font-size: 17px;
        }
      }
    `;
  }

  // ─── 7. ГЕНЕРАЦИЯ HTML ДИАЛОГА ────────────────────────────────────
  function buildOrderCardHtml(carModel, carClass, basePrice, upsellPrice, totalPrice, slot, serviceName, upsellName) {
    const sName = serviceName || 'Восстановительная полировка кузова';
    const bPrice = (basePrice !== undefined && basePrice !== null) ? Number(basePrice) : 18000;
    const uPrice = (upsellPrice !== undefined && upsellPrice !== null && !isNaN(upsellPrice)) ? Number(upsellPrice) : 25000;
    const hasUpsell = uPrice > 0;
    const uName = upsellName || (hasUpsell ? 'Нанокерамика 9H (2 слоя)' : 'Без дополнительных опций');
    const tPrice = (totalPrice !== undefined && totalPrice !== null) ? Number(totalPrice) : (bPrice + uPrice);
    const totalLabel = hasUpsell ? 'Итого с допродажей:' : 'Итого к оплате:';
    const displaySlot = (slot && slot !== 'суббота 14:00' && !slot.includes('суббота 14:00')) ? slot : 'на ваш выбор (по согласованию)';

    const upsellRowHtml = hasUpsell ? `
      <tr class="ecm-row-upsell">
        <td>
          ${uName}
          <span class="ecm-upsell-tag">+${uPrice.toLocaleString('ru-RU')}&nbsp;₽ к заказу</span>
        </td>
        <td class="col-price">+${uPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
      </tr>
    ` : `
      <tr style="opacity: 0.65; font-size: 12.5px;">
        <td>${uName}</td>
        <td class="col-price" style="font-size: 13px; color: var(--w-muted);">0&nbsp;₽</td>
      </tr>
    `;

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
            ${upsellRowHtml}
            <tr>
              <td>Гидрофобный антидождь передней полусферы</td>
              <td class="col-price" style="color: var(--w-ok); font-size: 13px;">0&nbsp;₽ (в подарок)</td>
            </tr>
            <tr class="ecm-row-total">
              <td>${totalLabel}</td>
              <td class="col-price">${tPrice.toLocaleString('ru-RU')}&nbsp;₽</td>
            </tr>
          </tbody>
        </table>
        <div class="ecm-hold-banner">
          <span>Время визита: ${displaySlot}</span>
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
        isInitialSample: true,
        text: `Здравствуйте! Я ИИ-администратор детейлинг-центра «${STUDIO_CONFIG.company_name}».\n\nНиже — образец готового заказ-наряда со сметой и бронью слота. Назовите вашу модель авто или выберите вопрос ниже — сделаю точный расчет под ваш автомобиль и запишу вас на удобное время!`
      },
      {
        role: 'bot',
        isEstimate: true,
        isInitialSample: true,
        carModel: 'BMW 5 / Седан',
        carClass: 'Образец сметы',
        serviceName: 'Комплексная восстановительная полировка кузова',
        basePrice: 18000,
        upsellName: 'Нанокерамика 9H (2 слоя)',
        upsellPrice: 25000,
        totalPrice: 43000,
        slot: 'на ваш выбор (по согласованию)'
      }
    ];
  }

  let messages = getInitialMessages();

  function createMessageElement(m) {
    const msgRow = document.createElement('div');
    msgRow.className = `ecm-msg ${m.role}`;

    if (m.role === 'user') {
      msgRow.innerHTML = `<div class="ecm-user-text">${m.text}</div>`;
    } else if (m.isEstimate) {
      msgRow.innerHTML = buildOrderCardHtml(
        m.carModel,
        m.carClass,
        m.basePrice,
        m.upsellPrice,
        m.totalPrice,
        m.slot,
        m.serviceName,
        m.upsellName
      );
    } else {
      msgRow.innerHTML = `<div class="ecm-user-text" style="background:var(--w-card); white-space:pre-wrap; line-height:1.45;">${m.text}</div>`;
    }
    return msgRow;
  }

  function renderMessagesInto(containerEl) {
    if (!containerEl) return;
    const existing = containerEl.querySelectorAll('.ecm-msg:not(.typing-msg)');
    const currentCount = existing.length;

    // Полный рендер только если контейнер пуст или при сбросе диалога
    if (currentCount === 0 || messages.length < currentCount) {
      containerEl.innerHTML = '';
      const fragment = document.createDocumentFragment();
      messages.forEach(m => fragment.appendChild(createMessageElement(m)));
      containerEl.appendChild(fragment);
    } else if (messages.length > currentCount) {
      // Инкрементальное добавление только новых сообщений (0 мс задержки на мобильных!)
      const fragment = document.createDocumentFragment();
      for (let i = currentCount; i < messages.length; i++) {
        fragment.appendChild(createMessageElement(messages[i]));
      }
      containerEl.appendChild(fragment);
    }

    requestAnimationFrame(() => {
      containerEl.scrollTop = containerEl.scrollHeight;
    });
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
      if (window.innerWidth > 640) {
        setTimeout(() => floatingInput && floatingInput.focus(), 150);
      }
    } else {
      modalOverlay.classList.remove('open');
      floatingLauncher.classList.remove('is-open');
      floatingLauncher.setAttribute('aria-expanded', 'false');
      if (icon) icon.innerHTML = `<img src="${ECM_LOGO_DATA_URI}" alt="ECM" class="ecm-launcher-logo">`;
      floatingLauncher.focus();
    }
  }

  floatingLauncher.addEventListener('click', () => toggleFloating());

  // Скрываем плавающую кнопку, если на экране уже виден инлайн-виджет (устраняет захламление на мобильных)
  if (inlineContainer && window.IntersectionObserver) {
    try {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            floatingLauncher.style.transform = 'scale(0)';
            floatingLauncher.style.opacity = '0';
            floatingLauncher.style.pointerEvents = 'none';
          } else {
            floatingLauncher.style.transform = 'scale(1)';
            floatingLauncher.style.opacity = '1';
            floatingLauncher.style.pointerEvents = 'auto';
          }
        });
      }, { threshold: 0.15 });
      heroObserver.observe(inlineContainer);
    } catch(e) {}
  }

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
    resetActiveOrderState();
    messages = getInitialMessages();
    renderAllStreams();
  }

  // ─── 11. ИНТЕЛЛЕКТУАЛЬНЫЙ AI-ОТВЕТЧИК ДЛЯ ЧАТА ─────────────────────

  let activeOrderState = {
    carModel: null,
    carClass: 'Седан',
    serviceName: 'Комплексная восстановительная полировка кузова',
    basePrice: 18000,
    upsellName: 'Нанокерамика 9H (2 слоя)',
    upsellPrice: 25000,
    totalPrice: 43000,
    slot: 'на ваш выбор (по согласованию)',
    upsellExcluded: false
  };

  function resetActiveOrderState() {
    activeOrderState = {
      carModel: null,
      carClass: 'Седан',
      serviceName: 'Комплексная восстановительная полировка кузова',
      basePrice: 18000,
      upsellName: 'Нанокерамика 9H (2 слоя)',
      upsellPrice: 25000,
      totalPrice: 43000,
      slot: 'на ваш выбор (по согласованию)',
      upsellExcluded: false
    };
  }

  function extractContactInfo(text) {
    if (!text) return null;
    const trimmed = text.trim();

    // 1. Телефон: +7 / 8 с цифрами или 10-11 цифр подряд
    const phoneMatch = trimmed.match(/(?:\+?7|8)[\s\-\(]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/) || trimmed.match(/\b\d{10,11}\b/);
    if (phoneMatch) {
      return {
        type: 'phone',
        value: phoneMatch[0],
        display: `тел. ${phoneMatch[0]}`
      };
    }

    // 2. Telegram: t.me/link, @handle или "тг: handle"
    const tgUrl = trimmed.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{3,32})/i);
    if (tgUrl) {
      return {
        type: 'telegram',
        value: '@' + tgUrl[1],
        display: `Telegram @${tgUrl[1]}`
      };
    }
    const tgHandle = trimmed.match(/@([a-zA-Z0-9_]{3,32})/);
    if (tgHandle) {
      return {
        type: 'telegram',
        value: '@' + tgHandle[1],
        display: `Telegram @${tgHandle[1]}`
      };
    }
    const tgWord = trimmed.match(/(?:тг|телеграм|телега|tg)\s*[:\-—]?\s*@?([a-zA-Z0-9_]{3,32})/i);
    if (tgWord) {
      return {
        type: 'telegram',
        value: '@' + tgWord[1],
        display: `Telegram @${tgWord[1]}`
      };
    }

    // 3. ВКонтакте: ссылка vk.com/handle или "вк: handle"
    const vkUrl = trimmed.match(/(?:https?:\/\/)?(?:www\.)?vk\.(?:com|ru)\/([a-zA-Z0-9_\.]{2,50})/i);
    if (vkUrl) {
      return {
        type: 'vk',
        value: 'vk.com/' + vkUrl[1],
        display: `ВКонтакте vk.com/${vkUrl[1]}`
      };
    }
    const vkWord = trimmed.match(/(?:вк|vk)\s*[:\-—]?\s*@?([a-zA-Z0-9_\.]{2,50})/i);
    if (vkWord && !['да', 'нет', 'ок', 'добрый', 'привет'].includes(vkWord[1].toLowerCase())) {
      return {
        type: 'vk',
        value: 'vk.com/' + vkWord[1],
        display: `ВКонтакте vk.com/${vkWord[1]}`
      };
    }

    return null;
  }

  function extractTimePreference(text) {
    if (!text) return null;
    const low = text.toLowerCase();
    
    // Поиск времени или дня
    const timeMatch = text.match(/\b(?:в\s+)?(?:[01]?\d|2[0-3])[:.][0-5]\d\b/i);
    const dayMatch = text.match(/(?:в\s+)?(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|завтра|сегодня|выходные|будни)(?:\s+(?:утром|вечером|днем|в\s+\d{1,2}(?:[:.]\d{2})?|\d{1,2}(?:[:.]\d{2})?))?/i);
    
    if (dayMatch && timeMatch) {
      return `${dayMatch[0].trim()} (${timeMatch[0].trim()})`;
    }
    if (dayMatch) {
      return dayMatch[0].trim();
    }
    if (timeMatch) {
      return timeMatch[0].trim();
    }
    return null;
  }

  function isUpsellExclusionQuery(low) {
    if (!low) return false;
    return (
      low.includes('без пропитк') || low.includes('без защитн') || low.includes('без озонирован') ||
      low.includes('без нано') || low.includes('без керамик') || low.includes('без доп') ||
      low.includes('без покрытия') || low.includes('без второго') || low.includes('без допродаж') ||
      low.includes('только пленк') || low.includes('только оклейк') || low.includes('только полировк') ||
      low.includes('только химчистк') || low.includes('только салон') || low.includes('только баз') ||
      low.includes('одну услуг') || low.includes('одну полировк') || low.includes('одну химчистк') ||
      low.includes('уберите') || low.includes('не надо') ||
      (low.includes('без ') && (low.includes('пропит') || low.includes('керамик') || low.includes('доп') || low.includes('слоя') || low.includes('услуг') || low.includes('опци')))
    );
  }

  function isBookingRequest(text) {
    if (!text) return false;
    const low = text.toLowerCase();
    // Если клиент просит убрать доп или только одну услугу — это НЕ запрос на запись!
    if (isUpsellExclusionQuery(low)) {
      return false;
    }
    return low.includes('запис') || low.includes('забронир') || low.includes('брон') ||
           low.includes('подходит') || low.includes('согласен') || (low.startsWith('давайте') && !low.includes('без')) ||
           low.includes('зафиксир') || low.includes('слот');
  }

  function isRefusal(userText, botText) {
    const lowU = (userText || '').toLowerCase().replace(/ё/g, 'е').trim();
    const lowB = (botText || '').toLowerCase().replace(/ё/g, 'е').trim();

    // Непрофильные отечественные авто или работы
    const refusalWords = [
      'лада', 'lada', 'ваз', 'vaz', 'газ', 'уаз', 'москвич', 'приора', 'гранта', 'веста', 'калина', 'нива',
      'жигули', 'жигуль', 'шестерка', 'семерка', 'девятка', 'четырка', 'буханка', 'патриот',
      'шиномонтаж', 'ремонт двигателя', 'ремонт мотора', 'сход-развал', 'покраска кузова', 'сварка'
    ];
    for (const kw of refusalWords) {
      const rx = new RegExp('(^|[^a-zа-я0-9_])' + kw + '([^a-zа-я0-9_]|$)', 'i');
      if (rx.test(lowU)) return true;
    }

    // Фразы отказа в ответе бота
    const botRefusalPhrases = [
      'не входят в список', 'не сможем предложить', 'к сожалению, не сможем',
      'не принимаем', 'не занимаемся', 'не обслуживаем', 'отечественного производства'
    ];
    for (const phrase of botRefusalPhrases) {
      if (lowB.includes(phrase)) return true;
    }

    return false;
  }

  function isLeadershipOrB2bQuery(text) {
    if (!text) return false;
    const low = text.toLowerCase();
    if (/руковод[а-я]*|директор[а-я]*|владел[а-я]*|собственник[а-я]*|начальни[а-я]*/i.test(low)) {
      return true;
    }
    const b2bKeywords = [
      'купить бота', 'купить виджет', 'купить систему', 'приобрести', 'заказать бота', 'заказать виджет',
      'установк', 'под ключ', 'разработчик', 'создател', 'внедрен', 'интеграц',
      'партнер', 'сотрудничеств', 'франшиз', 'кто делал', 'кто создал',
      'для своего бизнеса', 'для своего сервиса', 'для своей студии',
      'автор проекта', 'основател', 'связаться с автором', 'связь с автором',
      'сколько стоит бот', 'сколько стоит виджет', 'демо верси', 'демо-верси'
    ];
    return b2bKeywords.some(k => low.includes(k));
  }

  // ─── КАТАЛОГ И ИНТЕЛЛЕКТУАЛЬНОЕ РАСПОЗНАВАНИЕ АВТОМОБИЛЕЙ ───────────
  function detectCarDetails(text) {
    if (!text) return { carModel: null, carClass: null };
    const low = text.toLowerCase().replace(/ё/g, 'е').trim();

    // 1. ВНЕДОРОЖНИКИ (Полноразмерные SUV, Джипы, Premium Внедорожники)
    // Audi Q8 / Q7 / e-tron
    if (/\b(?:audi|ауди)?\s*(?:sq\s*8|rs\s*q\s*8|rsq\s*8|q\s*8|ку\s*8|кю\s*8)\b/i.test(low)) {
      return { carModel: 'Audi Q8', carClass: 'Внедорожник' };
    }
    if (/\b(?:audi|ауди)?\s*(?:sq\s*7|rs\s*q\s*7|rsq\s*7|q\s*7|ку\s*7|кю\s*7)\b/i.test(low)) {
      return { carModel: 'Audi Q7', carClass: 'Внедорожник' };
    }
    if (/\b(?:audi|ауди)?\s*(?:e-tron|етрон|е-трон)\b/i.test(low)) {
      return { carModel: 'Audi e-tron', carClass: 'Внедорожник' };
    }

    // BMW X7 / X6 / X5 / XM
    if (/\b(?:bmw|бмв)?\s*(?:x\s*7|х\s*7)\b/i.test(low)) {
      return { carModel: 'BMW X7', carClass: 'Внедорожник' };
    }
    if (/\b(?:bmw|бмв)?\s*(?:x\s*6|х\s*6)(?:\s*m|м)?\b/i.test(low)) {
      return { carModel: 'BMW X6', carClass: 'Внедорожник' };
    }
    if (/\b(?:bmw|бмв)?\s*(?:x\s*5|х\s*5)(?:\s*m|м)?\b/i.test(low)) {
      return { carModel: 'BMW X5', carClass: 'Внедорожник' };
    }
    if (/\b(?:bmw|бмв)?\s*(?:xm|хм)\b/i.test(low)) {
      return { carModel: 'BMW XM', carClass: 'Внедорожник' };
    }

    // Mercedes GLS / GLE / G-Class (Гелик)
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:gls|глс|gl|гл)\b/i.test(low)) {
      return { carModel: 'Mercedes GLS', carClass: 'Внедорожник' };
    }
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:gle|гле)(?:\s*купе|\s*coupe)?\b/i.test(low)) {
      return { carModel: 'Mercedes GLE', carClass: 'Внедорожник' };
    }
    if (/\b(?:гелик|гелендваген|gelandewagen|g-class|g\s*класс|г-класс|г\s*класс|g\s*63|г\s*63|g\s*500|г\s*500)\b/i.test(low)) {
      return { carModel: 'Mercedes G-Class (Гелендваген)', carClass: 'Внедорожник' };
    }

    // Porsche Cayenne
    if (/\b(?:porsche|порше)?\s*(?:cayenne|кайен|каен)(?:\s*купе|\s*coupe)?\b/i.test(low)) {
      return { carModel: 'Porsche Cayenne', carClass: 'Внедорожник' };
    }

    // Tank (300 / 500 / 700)
    if (/\b(?:tank|танк)(?:\s*(?:700|500|300))?\b/i.test(low)) {
      if (low.includes('500')) return { carModel: 'Tank 500', carClass: 'Внедорожник' };
      if (low.includes('300')) return { carModel: 'Tank 300', carClass: 'Внедорожник' };
      if (low.includes('700')) return { carModel: 'Tank 700', carClass: 'Внедорожник' };
      return { carModel: 'Tank (Внедорожник)', carClass: 'Внедорожник' };
    }

    // Toyota Land Cruiser / Prado / Highlander
    if (/\b(?:toyota|тойота)?\s*(?:land\s*cruiser|ленд\s*крузер|ленд\s*круизер|крузак|крузер|lc\s*200|lc\s*300|крузак\s*300|крузак\s*200|двухсотк|трехсотк)\b/i.test(low)) {
      return { carModel: 'Toyota Land Cruiser', carClass: 'Внедорожник' };
    }
    if (/\b(?:toyota|тойота)?\s*(?:prado|прадо|150|250)\b/i.test(low)) {
      return { carModel: 'Toyota Prado', carClass: 'Внедорожник' };
    }
    if (/\b(?:toyota|тойота)?\s*(?:highlander|хайлендер|sequoia|секвойя)\b/i.test(low)) {
      return { carModel: 'Toyota Highlander', carClass: 'Внедорожник' };
    }
    if (/\b(?:lexus|лексус)?\s*(?:lx|лх|lx\s*570|lx\s*600|gx|гх|gx\s*460|gx\s*550)\b/i.test(low)) {
      return { carModel: 'Lexus LX / GX', carClass: 'Внедорожник' };
    }

    // Range Rover / Defender / Discovery
    if (/\b(?:range\s*rover|рейндж\s*ровер|рэндж\s*ровер|vogue|вог)(?:\s*sport|\s*спорт)?\b/i.test(low)) {
      return { carModel: 'Range Rover', carClass: 'Внедорожник' };
    }
    if (/\b(?:land\s*rover|ленд\s*ровер)?\s*(?:defender|дефендер)\b/i.test(low)) {
      return { carModel: 'Land Rover Defender', carClass: 'Внедорожник' };
    }
    if (/\b(?:discovery|дискавери)\b/i.test(low)) {
      return { carModel: 'Land Rover Discovery', carClass: 'Внедорожник' };
    }

    // Cadillac / Chevrolet / VW / Li Auto / Volvo / Hyundai / Infiniti
    if (/\b(?:cadillac|кадиллак)?\s*(?:escalade|эскалейд|эскалэйд)\b/i.test(low)) {
      return { carModel: 'Cadillac Escalade', carClass: 'Внедорожник' };
    }
    if (/\b(?:chevrolet|шевроле)?\s*(?:tahoe|тахо|suburban|субурбан)\b/i.test(low)) {
      return { carModel: 'Chevrolet Tahoe', carClass: 'Внедорожник' };
    }
    if (/\b(?:volkswagen|vw|фольксваген)?\s*(?:touareg|туарег|таурег)\b/i.test(low)) {
      return { carModel: 'VW Touareg', carClass: 'Внедорожник' };
    }
    if (/\b(?:li|lixiang|ли|лисиан)?\s*(?:l\s*9|л\s*9|ли\s*9|l\s*8|л\s*8|ли\s*8|l\s*7|л\s*7|ли\s*7)\b|\b(?:lixiang|лисиан|ли авто)\b/i.test(low)) {
      return { carModel: 'Li Auto (Lixiang)', carClass: 'Внедорожник' };
    }
    if (/\b(?:volvo|вольво)?\s*(?:xc\s*90|хс\s*90)\b/i.test(low)) {
      return { carModel: 'Volvo XC90', carClass: 'Внедорожник' };
    }
    if (/\b(?:palisade|палисад|mohave|мохав)\b/i.test(low)) {
      return { carModel: 'Hyundai Palisade / Mohave', carClass: 'Внедорожник' };
    }
    if (/\b(?:infiniti|инфинити)?\s*(?:qx\s*80|qx\s*56)\b/i.test(low)) {
      return { carModel: 'Infiniti QX80', carClass: 'Внедорожник' };
    }
    if (/\b(?:внедорожник|джип|suv)\b/i.test(low)) {
      return { carModel: 'Внедорожник', carClass: 'Внедорожник' };
    }

    // 2. КРОССОВЕРЫ (Компактные и среднеразмерные кроссоверы / паркетники)
    // Audi Q5 / Q3
    if (/\b(?:audi|ауди)?\s*(?:sq\s*5|q\s*5|ку\s*5|кю\s*5)\b/i.test(low)) {
      return { carModel: 'Audi Q5', carClass: 'Кроссовер' };
    }
    if (/\b(?:audi|ауди)?\s*(?:sq\s*3|q\s*3|ку\s*3|кю\s*3)\b/i.test(low)) {
      return { carModel: 'Audi Q3', carClass: 'Кроссовер' };
    }

    // BMW X4 / X3 / X1 / X2
    if (/\b(?:bmw|бмв)?\s*(?:x\s*4|х\s*4)\b/i.test(low)) {
      return { carModel: 'BMW X4', carClass: 'Кроссовер' };
    }
    if (/\b(?:bmw|бмв)?\s*(?:x\s*3|х\s*3)\b/i.test(low)) {
      return { carModel: 'BMW X3', carClass: 'Кроссовер' };
    }
    if (/\b(?:bmw|бмв)?\s*(?:x\s*1|х\s*1|x\s*2|х\s*2)\b/i.test(low)) {
      return { carModel: 'BMW X1 / X2', carClass: 'Кроссовер' };
    }

    // Mercedes GLC / GLA / GLB
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:glc|глц)(?:\s*купе|\s*coupe)?\b/i.test(low)) {
      return { carModel: 'Mercedes GLC', carClass: 'Кроссовер' };
    }
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:gla|гла|glb|глб)\b/i.test(low)) {
      return { carModel: 'Mercedes GLA / GLB', carClass: 'Кроссовер' };
    }

    // Porsche Macan / Range Rover Velar / Evoque
    if (/\b(?:porsche|порше)?\s*(?:macan|макан)\b/i.test(low)) {
      return { carModel: 'Porsche Macan', carClass: 'Кроссовер' };
    }
    if (/\b(?:range\s*rover|рейндж\s*ровер)?\s*(?:velar|велар|evoque|эвок)\b/i.test(low)) {
      return { carModel: 'Range Rover Velar', carClass: 'Кроссовер' };
    }

    // Toyota RAV4 / Lexus RX / NX
    if (/\b(?:toyota|тойота)?\s*(?:rav\s*4|рав\s*4|рав4|rav4)\b/i.test(low)) {
      return { carModel: 'Toyota RAV4', carClass: 'Кроссовер' };
    }
    if (/\b(?:lexus|лексус)?\s*(?:rx|рх|rx\s*350|rx\s*300|nx|нх|nx\s*200|nx\s*300)\b/i.test(low)) {
      return { carModel: 'Lexus RX / NX', carClass: 'Кроссовер' };
    }

    // VW Tiguan / Skoda Kodiaq / Karoq
    if (/\b(?:volkswagen|vw|фольксваген)?\s*(?:tiguan|тигуан|taos|таос)\b/i.test(low)) {
      return { carModel: 'VW Tiguan', carClass: 'Кроссовер' };
    }
    if (/\b(?:skoda|шкода)?\s*(?:kodiaq|кодиак|karoq|карок)\b/i.test(low)) {
      return { carModel: 'Skoda Kodiaq', carClass: 'Кроссовер' };
    }

    // Geely / Haval / Changan / Chery / Exeed / Omoda / Zeekr
    if (/\b(?:monjaro|монжаро|манжаро)\b/i.test(low)) return { carModel: 'Geely Monjaro', carClass: 'Кроссовер' };
    if (/\b(?:tugella|тугелла|тугела)\b/i.test(low)) return { carModel: 'Geely Tugella', carClass: 'Кроссовер' };
    if (/\b(?:coolray|кулрей|кулрэй)\b/i.test(low)) return { carModel: 'Geely Coolray', carClass: 'Кроссовер' };
    if (/\b(?:atlas|атлас)\b/i.test(low)) return { carModel: 'Geely Atlas', carClass: 'Кроссовер' };
    if (/\b(?:geely|джили)\b/i.test(low)) return { carModel: 'Geely (Кроссовер)', carClass: 'Кроссовер' };

    if (/\b(?:dargo|дарго)\b/i.test(low)) return { carModel: 'Haval Dargo', carClass: 'Кроссовер' };
    if (/\b(?:jolion|джолион|джолиан)\b/i.test(low)) return { carModel: 'Haval Jolion', carClass: 'Кроссовер' };
    if (/\b(?:f7|ф7|f7x|ф7х)\b/i.test(low)) return { carModel: 'Haval F7', carClass: 'Кроссовер' };
    if (/\b(?:haval|хавал|хавейл)\b/i.test(low)) return { carModel: 'Haval (Кроссовер)', carClass: 'Кроссовер' };

    if (/\b(?:exeed|эксид|txl|vx)\b/i.test(low)) return { carModel: 'Exeed (Кроссовер)', carClass: 'Кроссовер' };
    if (/\b(?:changan|чанган|uni-k|юни\s*к|cs75|cs55)\b/i.test(low)) return { carModel: 'Changan (Кроссовер)', carClass: 'Кроссовер' };
    if (/\b(?:chery|чери|tiggo|тигго|тиго)\b/i.test(low)) return { carModel: 'Chery Tiggo', carClass: 'Кроссовер' };
    if (/\b(?:omoda|омода|jaecoo|джейку)\b/i.test(low)) return { carModel: 'Omoda / Jaecoo', carClass: 'Кроссовер' };

    if (/\b(?:zeekr\s*x|зикр\s*х|зикр\s*x)\b/i.test(low)) return { carModel: 'Zeekr X', carClass: 'Кроссовер' };
    if (/\b(?:sportage|спортейдж|спортаж|tucson|туссан|тусон|creta|крета|seltos|селтос|sorento|соренто|santa\s*fe|санта\s*фе)\b/i.test(low)) {
      return { carModel: 'Кроссовер', carClass: 'Кроссовер' };
    }
    if (/\b(?:cx-5|cx5|сх5|сх-5|cx-9|cx9|сх9)\b/i.test(low)) return { carModel: 'Mazda CX-5', carClass: 'Кроссовер' };
    if (/\b(?:volvo|вольво)?\s*(?:xc\s*60|хс\s*60|xc\s*40|хс\s*40)\b/i.test(low)) return { carModel: 'Volvo XC60', carClass: 'Кроссовер' };
    if (/\b(?:qashqai|кашкай|x-trail|икстрейл|х-трейл|murano|мурано)\b/i.test(low)) return { carModel: 'Nissan (Кроссовер)', carClass: 'Кроссовер' };

    if (/\b(?:кроссовер|паркетник)\b/i.test(low)) {
      return { carModel: 'Кроссовер', carClass: 'Кроссовер' };
    }

    // ─── 3. СЕДАНЫ / КУПЕ / ЛИФТБЕКИ ─────────────────────────────────
    // Audi A-Series
    if (/\b(?:audi|ауди)?\s*(?:a\s*3|а\s*3|s\s*3|rs\s*3)\b/i.test(low)) return { carModel: 'Audi A3', carClass: 'Седан' };
    if (/\b(?:audi|ауди)?\s*(?:a\s*4|а\s*4|s\s*4|rs\s*4)\b/i.test(low)) return { carModel: 'Audi A4', carClass: 'Седан' };
    if (/\b(?:audi|ауди)?\s*(?:a\s*5|а\s*5|s\s*5|rs\s*5)\b/i.test(low)) return { carModel: 'Audi A5', carClass: 'Седан' };
    if (/\b(?:audi|ауди)?\s*(?:a\s*6|а\s*6|s\s*6|rs\s*6|аллроуд|allroad)\b/i.test(low)) return { carModel: 'Audi A6', carClass: 'Седан' };
    if (/\b(?:audi|ауди)?\s*(?:a\s*7|а\s*7|s\s*7|rs\s*7)\b/i.test(low)) return { carModel: 'Audi A7', carClass: 'Седан' };
    if (/\b(?:audi|ауди)?\s*(?:a\s*8|а\s*8|s\s*8)\b/i.test(low)) return { carModel: 'Audi A8', carClass: 'Седан' };
    if (/\b(?:audi|ауди)\b/i.test(low)) return { carModel: 'Audi (Седан / Бизнес)', carClass: 'Седан' };

    // BMW Sedans
    if (/\b(?:f10|ф10)\b/i.test(low)) return { carModel: 'BMW F10', carClass: 'Седан' };
    if (/\b(?:g30|г30)\b/i.test(low)) return { carModel: 'BMW 5 (G30)', carClass: 'Седан' };
    if (/\b(?:g20|г20|f30|ф30|e90|е90)\b/i.test(low)) return { carModel: 'BMW 3', carClass: 'Седан' };
    if (/\b(?:e60|е60)\b/i.test(low)) return { carModel: 'BMW 5 (E60)', carClass: 'Седан' };
    if (/\b(?:bmw|бмв)\s*3\b/i.test(low)) return { carModel: 'BMW 3 (Седан)', carClass: 'Седан' };
    if (/\b(?:bmw|бмв)\s*5\b/i.test(low)) return { carModel: 'BMW 5 (Седан)', carClass: 'Седан' };
    if (/\b(?:bmw|бмв)\s*7\b/i.test(low)) return { carModel: 'BMW 7 (Седан)', carClass: 'Седан' };
    if (/\b(?:m3|м3|m5|м5|m4|м4|m8|м8)\b/i.test(low)) return { carModel: 'BMW M (Седан)', carClass: 'Седан' };
    if (/\b(?:bmw|бмв)\b/i.test(low)) return { carModel: 'BMW (Седан)', carClass: 'Седан' };

    // Mercedes Sedans
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:e-class|е-класс|е\s*класс|ешка|е-шка|w213|w214|w212|e200|e300)\b/i.test(low)) {
      return { carModel: 'Mercedes E-Class', carClass: 'Седан' };
    }
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:c-class|с-класс|ц-класс|ц\s*класс|цешка|ц-шка|w205|w206|c180|c200)\b/i.test(low)) {
      return { carModel: 'Mercedes C-Class', carClass: 'Седан' };
    }
    if (/\b(?:mercedes|мерседес|mb|мб)?\s*(?:s-class|s-класс|с-класс|эска|w222|w223|s500|s600|майбах|maybach)\b/i.test(low)) {
      return { carModel: 'Mercedes S-Class', carClass: 'Седан' };
    }
    if (/\b(?:cla|кла|cls|цлс)\b/i.test(low)) return { carModel: 'Mercedes CLA / CLS', carClass: 'Седан' };
    if (/\b(?:mercedes|мерседес|мерс)\b/i.test(low)) return { carModel: 'Mercedes-Benz (Седан)', carClass: 'Седан' };

    // Porsche / Toyota / Lexus / VW / Skoda / Kia / Hyundai
    if (/\b(?:panamera|панамера)\b/i.test(low)) return { carModel: 'Porsche Panamera', carClass: 'Седан' };
    if (/\b(?:taycan|тайкан)\b/i.test(low)) return { carModel: 'Porsche Taycan', carClass: 'Седан' };
    if (/\b(?:911|boxster|боксер|cayman|кайман)\b/i.test(low)) return { carModel: 'Porsche 911 / Cayman', carClass: 'Седан' };

    if (/\b(?:camry|камри)\b/i.test(low)) return { carModel: 'Toyota Camry', carClass: 'Седан' };
    if (/\b(?:corolla|королла)\b/i.test(low)) return { carModel: 'Toyota Corolla', carClass: 'Седан' };
    if (/\b(?:lexus|лексус)?\s*(?:es|ес|es250|es350|is|ис|ls|лс)\b/i.test(low)) return { carModel: 'Lexus ES / IS', carClass: 'Седан' };

    if (/\b(?:passat|пассат|cc|сс|arteon|артеон)\b/i.test(low)) return { carModel: 'VW Passat', carClass: 'Седан' };
    if (/\b(?:polo|поло|jetta|джетта)\b/i.test(low)) return { carModel: 'VW Polo / Jetta', carClass: 'Седан' };

    if (/\b(?:octavia|октавия)\b/i.test(low)) return { carModel: 'Skoda Octavia', carClass: 'Седан' };
    if (/\b(?:superb|суперб)\b/i.test(low)) return { carModel: 'Skoda Superb', carClass: 'Седан' };
    if (/\b(?:rapid|рапид)\b/i.test(low)) return { carModel: 'Skoda Rapid', carClass: 'Седан' };

    if (/\b(?:k5|к5|optima|оптима)\b/i.test(low)) return { carModel: 'Kia K5', carClass: 'Седан' };
    if (/\b(?:sonata|соната)\b/i.test(low)) return { carModel: 'Hyundai Sonata', carClass: 'Седан' };
    if (/\b(?:solaris|солярис|rio|рио|elantra|элантра)\b/i.test(low)) return { carModel: 'Hyundai Solaris', carClass: 'Седан' };

    if (/\b(?:zeekr\s*001|зикр\s*001|001)\b/i.test(low)) return { carModel: 'Zeekr 001', carClass: 'Седан' };
    if (/\b(?:genesis|генезис)?\s*(?:g70|г70|g80|г80|g90|г90)\b/i.test(low)) return { carModel: 'Genesis G80', carClass: 'Седан' };

    if (/\b(?:седан|купе|хэтчбек|лифтбек)\b/i.test(low)) {
      return { carModel: 'Седан / Купе', carClass: 'Седан' };
    }

    return { carModel: null, carClass: null };
  }

  function isEstimateRequest(userText) {
    if (!userText) return false;
    if (isLeadershipOrB2bQuery(userText)) return false;
    const low = userText.toLowerCase().replace(/ё/g, 'е').trim();

    // Прямой вопрос о стоимости/расчете
    const priceKws = ['скольк', 'цен', 'стоимост', 'прайс', 'рассчит', 'посчит', 'почем', 'тариф', 'смет'];
    if (priceKws.some(k => low.includes(k))) return true;

    // Исключение допов / пересчет / запрос одной услуги
    if (isUpsellExclusionQuery(low)) return true;

    // Услуга + автомобиль или намерение ("Хочу PPF на Mercedes GLE", "можно сделать химчистку на ауди ку8")
    const services = ['ppf', 'пленк', 'оклейк', 'полировк', 'керамик', 'химчист', 'почистить'];
    const hasService = services.some(s => low.includes(s));
    const detectedCar = detectCarDetails(userText);
    const hasCar = !!(detectedCar.carClass || detectedCar.carModel);

    if (hasService && hasCar) return true;
    if (low.startsWith('хочу') && (hasService || hasCar)) return true;

    return false;
  }

  function computeEstimateForCar(userText, baseState) {
    const low = (userText || '').toLowerCase().replace(/ё/g, 'е');
    const detected = detectCarDetails(userText);

    let carClass = detected.carClass || (baseState && baseState.carClass) || 'Седан';
    let carModel = detected.carModel || (baseState && baseState.carModel) || 'Автомобиль клиента';

    const isExcl = isUpsellExclusionQuery(low) || !!(baseState && baseState.upsellExcluded);

    const isPPF = low.includes('ppf') || low.includes('пленк') || low.includes('оклейк') || low.includes('брон') || ((baseState && baseState.serviceName && baseState.serviceName.includes('PPF')));
    const isClean = low.includes('химчист') || low.includes('салон') || low.includes('почистить') || low.includes('пропитк') || ((baseState && baseState.serviceName && baseState.serviceName.includes('химчист')));
    const curSlot = (baseState && baseState.slot && baseState.slot !== 'суббота 14:00') ? baseState.slot : 'на ваш выбор (по согласованию)';

    if (isPPF) {
      const bp = (carClass === 'Седан') ? 65000 : 75000;
      const up = isExcl ? 0 : ((carClass === 'Седан') ? 25000 : 30000);
      const uName = isExcl ? 'Без нанокерамики (только базовый комплекс PPF)' : 'Нанокерамика 9H на остальной кузов';
      return {
        isEstimate: true,
        carModel: carModel,
        carClass: carClass,
        serviceName: 'Оклейка зон риска пленкой PPF',
        basePrice: bp,
        upsellName: uName,
        upsellPrice: up,
        totalPrice: bp + up,
        slot: curSlot,
        upsellExcluded: isExcl
      };
    } else if (isClean) {
      const bp = (carClass === 'Седан') ? 15000 : 18000;
      const up = isExcl ? 0 : 8000;
      const uName = isExcl ? 'Без защитной пропитки (только базовая химчистка)' : 'Озонирование + защитная пропитка';
      return {
        isEstimate: true,
        carModel: carModel,
        carClass: carClass,
        serviceName: 'Полная химчистка салона',
        basePrice: bp,
        upsellName: uName,
        upsellPrice: up,
        totalPrice: bp + up,
        slot: curSlot,
        upsellExcluded: isExcl
      };
    } else {
      const bp = (carClass === 'Внедорожник') ? 26000 : ((carClass === 'Кроссовер') ? 22000 : 18000);
      const up = isExcl ? 0 : ((carClass === 'Седан') ? 25000 : 30000);
      const uName = isExcl ? 'Без керамического покрытия (только восстановительная полировка)' : 'Нанокерамика 9H (2 слоя)';
      return {
        isEstimate: true,
        carModel: carModel,
        carClass: carClass,
        serviceName: 'Комплексная восстановительная полировка кузова',
        basePrice: bp,
        upsellName: uName,
        upsellPrice: up,
        totalPrice: bp + up,
        slot: curSlot,
        upsellExcluded: isExcl
      };
    }
  }

  function stripCodePieces(text) {
    if (!text) return '';
    let clean = text.replace(/```[a-z]*[\s\S]*?```/gi, '');
    clean = clean.replace(/```[a-z]*/gi, '');

    // Удаляем любые остатки JSON со сметой из видимого сообщения (включая многострочные)
    const jsonStartMatch = clean.match(/\{[\s\r\n]*"(?:isEstimate|carModel|serviceName|basePrice|totalPrice|carClass|slot)"/i);
    if (jsonStartMatch && typeof jsonStartMatch.index === 'number') {
      clean = clean.substring(0, jsonStartMatch.index);
    }

    // Если в конце строки осталась открывающая фигурная скобка или неполный JSON
    clean = clean.replace(/\{[\s\S]*$/g, '');

    // Убираем любые незакрытые markdown бэктики
    clean = clean.replace(/`+/g, '');

    return clean.trim();
  }

  function extractEstimate(rawText, userText, contactInfo) {
    // Если отказ, непрофильный запрос или вопрос по покупке/руководству — КАТЕГОРИЧЕСКИ смету не создаем!
    if (isRefusal(userText, rawText) || isLeadershipOrB2bQuery(userText)) return null;

    const isEstReq = isEstimateRequest(userText);
    const hasContact = !isLeadershipOrB2bQuery(userText) && !!contactInfo;

    // Смета формируется ТОЛЬКО по прямому вопросу о цене/расчете ИЛИ при подтверждении контакта
    if (!isEstReq && !hasContact) {
      return null;
    }

    // 1. Полноценный JSON из ответа ИИ
    if (rawText) {
      const jsonMatch = rawText.match(/\{[\s\S]*"(?:isEstimate|carModel)"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.isEstimate || parsed.carModel)) {
            const autoCalc = computeEstimateForCar(userText, activeOrderState);
            const detectedInUser = detectCarDetails(userText);
            const userNamedCar = !!(detectedInUser.carModel || detectedInUser.carClass);

            const chosenModel = userNamedCar ? autoCalc.carModel : (parsed.carModel || autoCalc.carModel || activeOrderState.carModel);
            const chosenClass = userNamedCar ? autoCalc.carClass : (parsed.carClass || autoCalc.carClass || activeOrderState.carClass);
            const bp = (parsed.basePrice !== undefined && parsed.basePrice !== null) ? Number(parsed.basePrice) : autoCalc.basePrice;
            const up = (parsed.upsellPrice !== undefined && parsed.upsellPrice !== null) ? Number(parsed.upsellPrice) : autoCalc.upsellPrice;

            const res = {
              isEstimate: true,
              carModel: chosenModel,
              carClass: chosenClass,
              serviceName: parsed.serviceName || autoCalc.serviceName,
              basePrice: bp,
              upsellName: parsed.upsellName || autoCalc.upsellName,
              upsellPrice: up,
              totalPrice: (parsed.totalPrice !== undefined && parsed.totalPrice !== null) ? Number(parsed.totalPrice) : (bp + up),
              slot: parsed.slot || activeOrderState.slot || 'по согласованию (на ваш выбор)'
            };
            activeOrderState = Object.assign({}, activeOrderState, res);
            return res;
          }
        } catch (e) {}
      }

      // 2. Если JSON был обрезан нейросетью
      const cutMatch = rawText.match(/\{[\s\S]*"(?:isEstimate|carModel)"[\s\S]*/);
      if (cutMatch) {
        const autoCalc = computeEstimateForCar(userText, activeOrderState);
        activeOrderState = Object.assign({}, activeOrderState, autoCalc);
        return autoCalc;
      }
    }

    // 3. Автоматический интеллектуальный расчет сметы по авто клиента
    const autoEst = computeEstimateForCar(userText, activeOrderState);
    activeOrderState = Object.assign({}, activeOrderState, autoEst);
    return autoEst;
  }

  function getSmartFallback(text, contactInfo) {
    const low = (text || '').toLowerCase().trim();

    // 0. Вопросы о руководителе, директоре, приобретении бота под ключ или партнерстве (B2B)
    if (isLeadershipOrB2bQuery(text)) {
      return {
        text: 'Здравствуйте! Данный чат — это интерактивная демонстрационная версия системы «ECM Systems» для детейлинг-центров и автобизнеса.\n\nПриобрести такого умного ИИ-бота и виджет расчета сметы с установкой под ключ можно напрямую у нашего основателя и разработчика:\nTelegram: @godblessed77 (https://t.me/godblessed77).\n\nМы настраиваем систему под ваш прайс за 1 день и предоставляем бесплатный тест-драйв на 24 часа без предоплаты!'
      };
    }

    // 1. Клиент предоставил контакт для бронирования
    if (contactInfo) {
      const timePref = extractTimePreference(text);
      if (timePref) {
        activeOrderState.slot = timePref;
      }
      const car = activeOrderState.carModel || 'BMW F10';
      const cClass = activeOrderState.carClass || 'Седан';
      const sName = activeOrderState.serviceName || 'Комплексная восстановительная полировка кузова';
      const bPrice = (activeOrderState.basePrice !== undefined && activeOrderState.basePrice !== null) ? Number(activeOrderState.basePrice) : 18000;
      const uPrice = (activeOrderState.upsellPrice !== undefined && activeOrderState.upsellPrice !== null && !isNaN(activeOrderState.upsellPrice)) ? Number(activeOrderState.upsellPrice) : (activeOrderState.upsellExcluded ? 0 : 25000);
      const uName = activeOrderState.upsellName || (uPrice > 0 ? 'Нанокерамика 9H (2 слоя)' : 'Без дополнительных опций');
      const tPrice = (activeOrderState.totalPrice !== undefined && activeOrderState.totalPrice !== null) ? Number(activeOrderState.totalPrice) : (bPrice + uPrice);
      const slot = activeOrderState.slot || 'по согласованию (на ваш выбор)';

      const finalEst = {
        isEstimate: true,
        carModel: car,
        carClass: cClass,
        serviceName: sName,
        basePrice: bPrice,
        upsellName: uName,
        upsellPrice: uPrice,
        totalPrice: tPrice,
        slot: slot,
        upsellExcluded: activeOrderState.upsellExcluded || (uPrice === 0)
      };
      activeOrderState = Object.assign({}, activeOrderState, finalEst);

      return {
        text: `Спасибо! Контакт зафиксирован (${contactInfo.display}). Время визита: ${slot}. Мастер свяжется с вами в течение 10–15 минут для подтверждения записи и уточнения всех деталей. Ниже сформирован ваш итоговый заказ-наряд:`,
        estimate: finalEst,
        rawText: JSON.stringify(finalEst)
      };
    }

    // 2. Непрофильное авто / отказ (Лада, ВАЗ и т.д.)
    if (isRefusal(text, '')) {
      return {
        text: 'Здравствуйте! Наш детейлинг-центр специализируется на обслуживании и комплексной защите иномарок премиум и бизнес-класса (BMW, Mercedes-Benz, Audi, Porsche и аналогичных). К сожалению, автомобили отечественного производства мы в работу не принимаем. Благодарим за обращение!'
      };
    }

    // 3. ОТКАЗ ОТ ДОПРОДАЖИ / ОДНА УСЛУГА («А можно без нанокерамики?», «давайте без защитной пропитки», «только химчистка», «только полировка», «уберите допы»)
    const isUpsellExclusion = isUpsellExclusionQuery(low);
    if (isUpsellExclusion) {
      let sName = activeOrderState.serviceName;
      let cClass = activeOrderState.carClass || 'Седан';
      let car = activeOrderState.carModel || 'Автомобиль клиента';
      
      const isClean = low.includes('химчист') || low.includes('салон') || low.includes('пропитк') || (sName && (sName.includes('химчист') || sName.includes('салон')));
      const isPPF = low.includes('ppf') || low.includes('пленк') || low.includes('оклейк') || (sName && (sName.includes('PPF') || sName.includes('пленк')));
      
      let bPrice = 18000;
      let uName = 'Без дополнительных опций';
      let replyServiceWord = 'услугу';

      if (isClean) {
        sName = 'Полная химчистка салона';
        bPrice = (cClass === 'Седан') ? 15000 : 18000;
        uName = 'Без защитной пропитки (только базовая химчистка)';
        replyServiceWord = 'полную химчистку салона';
      } else if (isPPF) {
        sName = 'Оклейка зон риска пленкой PPF';
        bPrice = (cClass === 'Седан') ? 65000 : 75000;
        uName = 'Без нанокерамики (только базовый комплекс PPF)';
        replyServiceWord = 'оклейку зон риска пленкой PPF';
      } else {
        sName = 'Комплексная восстановительная полировка кузова';
        bPrice = (cClass === 'Внедорожник') ? 26000 : ((cClass === 'Кроссовер') ? 22000 : 18000);
        uName = 'Без нанокерамики (только восстановительная полировка)';
        replyServiceWord = 'восстановительную полировку кузова';
      }

      if (activeOrderState.basePrice && activeOrderState.serviceName === sName) {
        bPrice = activeOrderState.basePrice;
      }

      const est = {
        isEstimate: true,
        carModel: car,
        carClass: cClass,
        serviceName: sName,
        basePrice: bPrice,
        upsellName: uName,
        upsellPrice: 0,
        totalPrice: bPrice,
        slot: activeOrderState.slot || 'по согласованию (на ваш выбор)',
        upsellExcluded: true
      };
      activeOrderState = Object.assign({}, activeOrderState, est);

      return {
        text: `Да, конечно! Мы с радостью выполним только ${replyServiceWord} для вашего ${car} без дополнительных опций.\n\nВ этом случае итоговая стоимость составит ровно ${bPrice.toLocaleString('ru-RU')} ₽. При этом специальная акция сохраняется: нанесение гидрофобного антидождя на переднюю полусферу мы сделаем в подарок (0 ₽)!\n\nПодскажите, на какой день и время вам удобно приехать к нам в студию?`,
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    // 4. ВОЗВРАТ ДОПРОДАЖИ: «А давайте с керамикой», «верните керамику», «сколько с керамикой»
    if (low.includes('с керамик') || low.includes('с нанокерамик') || low.includes('верните керамик') || low.includes('добавьте керамик')) {
      const car = activeOrderState.carModel || 'Mercedes GLE';
      const cClass = activeOrderState.carClass || 'Внедорожник';
      const sName = activeOrderState.serviceName || 'Оклейка зон риска пленкой PPF';
      const bPrice = activeOrderState.basePrice || (cClass === 'Седан' ? 65000 : 75000);
      const uPrice = (cClass === 'Седан') ? 25000 : 30000;
      const tPrice = bPrice + uPrice;

      const est = {
        isEstimate: true,
        carModel: car,
        carClass: cClass,
        serviceName: sName,
        basePrice: bPrice,
        upsellName: 'Нанокерамика 9H на остальной кузов',
        upsellPrice: uPrice,
        totalPrice: tPrice,
        slot: activeOrderState.slot || 'по согласованию (на ваш выбор)',
        upsellExcluded: false
      };
      activeOrderState = Object.assign({}, activeOrderState, est);

      return {
        text: `Отличное решение! С нанокерамикой 9H кузов вашего ${car} получит максимальную защиту, глубокий зеркальный глянец и мощный гидрофобный эффект на 18 месяцев.\n\nИтоговая смета комплекса: ${tPrice.toLocaleString('ru-RU')} ₽ (включая антидождь в подарок 0 ₽).\n\nПодскажите, на какой день и время вам удобно приехать к нам в студию?`,
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    // 5. ПОЛНЫЙ КАТАЛОГ УСЛУГ («какие у вас есть услуги», «что делаете», «прайс», «весь спектр»)
    const isServiceInquiry = (
      low.includes('услуг') || low.includes('что вы делаете') || low.includes('что делаете') ||
      low.includes('какие работы') || low.includes('что можете') || low.includes('что умеете') ||
      low.includes('прайс') || low.includes('список') || low.includes('чем занимаетесь')
    );
    if (isServiceInquiry) {
      return {
        text: 'В нашем детейлинг-центре доступны все ключевые направления премиальной защиты и ухода за автомобилем:\n\n1. 🛡 Оклейка антигравийной полиуретановой пленкой PPF (зоны риска или весь кузов целиком) — надежная защита от гравия, сколов и царапин со свойством самозатягивания Top Coat.\n2. ✨ Восстановительная полировка кузова — бережное удаление до 95% мелких царапин, паутинки и возврат глубокого заводского глянца.\n3. 💎 Нанесение нанокерамики 9H (в 2–3 слоя) — стойкий гидрофобный щит, зеркальный блеск и защита от дорожных реагентов на 18 месяцев.\n4. 🧼 Детейлинг-химчистка салона — глубокая очистка кожи, алькантары и текстиля с озонированием и защитной консервацией.\n5. 🌧 Антидождь передней полусферы (в подарок по акции!), полировка оптики, бронирование лобового стекла.\n\nПодскажите, пожалуйста, какая у вас марка и модель автомобиля? Я сразу сделаю точный расчет под ваш кузов и подскажу свободное время для записи!'
      };
    }

    // 6. ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ («только эти?», «а еще что-то есть?», «тонировка», «шумоизоляция», «вмятины», «лобовое»)
    const isExtraServices = (
      low.includes('только эт') || low.includes('еще что') || low.includes('что еще') ||
      low.includes('другие услуг') || low.includes('тонировк') || low.includes('шумоизоляц') ||
      low.includes('шумк') || low.includes('вмятин') || low.includes('pdr') ||
      low.includes('лобовое') || low.includes('стекл') || low.includes('кожа') || low.includes('перешив') ||
      low.includes('дополнительн') || low.includes('кроме эт')
    );
    if (isExtraServices) {
      return {
        text: 'Конечно, спектр наших услуг намного шире! Помимо основных комплексов мы также профессионально выполняем:\n• Тонирование стекол по ГОСТу американскими премиум-пленками (Llumar, SunTek);\n• Бронирование лобовых стекол защитными пленками повышенной прочности от сколов и трещин;\n• Беспокрасочное удаление вмятин (технология PDR) с полным сохранением заводского ЛКП;\n• Премиальную шумоизоляцию салона, дверей и арок;\n• Реставрацию, покраску и защитную консервацию кожи салона.\n\nПодскажите, какой у вас автомобиль и какую именно задачу хотелось бы решить? Я предложу оптимальный комплекс и рассчитаю точную цену.'
      };
    }

    // 7. КОРОТКИЕ РЕПЛИКИ / МЕЖДОМЕТИЯ («ак», «ок», «ау», «ты тут», «ну», «и?», «что дальше», «ясно», «привет»)
    const isShortInterjection = (
      low === 'ак' || low === 'ок' || low === 'ау' || low === 'ты тут' || low === 'ну' ||
      low === 'и?' || low === 'что дальше' || low === 'ясно' || low === 'понятно' ||
      low === 'привет' || low === 'здравствуйте' || low === 'добрый день' || low === 'добрый вечер' || low === 'ку'
    );
    if (isShortInterjection) {
      if (activeOrderState.carModel) {
        return {
          text: `Я на связи! По вашему автомобилю ${activeOrderState.carModel} предварительный заказ-наряд зафиксирован.\n\nПодскажите, на какой день и время вам удобно запланировать визит? (для подтверждения потребуется номер телефона или Telegram @никнейм).`
        };
      }
      return {
        text: `Я на связи и готов подробно проконсультировать! Напишите марку и модель вашего автомобиля или нажмите одну из кнопок внизу — и я мгновенно рассчитаю точную стоимость комплекса с подарком по акции.`
      };
    }

    // 8. ХИМЧИСТКА САЛОНА
    if (low.includes('химчист') || low.includes('салон') || low.includes('почистить')) {
      const detected = detectCarDetails(text);
      const car = detected.carModel || activeOrderState.carModel;

      if (!car) {
        return {
          text: 'Стоимость комплексной детейлинг-химчистки салона с глубокой чисткой кожи/текстиля и озонированием:\n• Седаны и купе (BMW 3/5, Audi A4/A6, Camry) — 15 000 ₽\n• Кроссоверы и внедорожники (Audi Q7/Q8, BMW X5/X7, Mercedes GLE) — 18 000 ₽\nПо действующей акции нанесение антидождя на переднюю полусферу — в подарок (0 ₽)!\n\nПодскажите, какая у вас марка и модель автомобиля? Я сразу сделаю точный расчет под ваш кузов!'
        };
      }

      const est = computeEstimateForCar(text, activeOrderState);
      activeOrderState = Object.assign({}, activeOrderState, est);
      const hasUpsell = est.upsellPrice > 0;
      const upsellText = hasUpsell
        ? `Рекомендуем дополнить защитной гидрофобной пропиткой кожи и текстиля (+${est.upsellPrice.toLocaleString('ru-RU')} ₽). `
        : `Выбрана только базовая комплексная химчистка (${est.basePrice.toLocaleString('ru-RU')} ₽). `;

      return {
        text: `Для ${est.carModel} (${est.carClass}) стоимость комплексной детейлинг-химчистки салона составляет ${est.basePrice.toLocaleString('ru-RU')} ₽. В комплекс входит глубокая чистка всех элементов интерьера, потолка, пола, багажника и озонирование салона.\n\n${upsellText}Антидождь передней полусферы — 0 ₽ в подарок по акции!\n\nПодскажите, на какой день и время вам удобно приехать к нам в студию?`,
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    // 9. ВОПРОС О СРОКАХ И ВРЕМЕНИ ВЫПОЛНЕНИЯ
    if ((low.includes('скольк') && low.includes('времен')) || low.includes('по времени') || low.includes('сколько дней') || low.includes('сколько часов') || low.includes('когда готов') || low.includes('когда забрать') || low.includes('когда отдадите') || low.includes('длится')) {
      const car = activeOrderState.carModel || 'автомобиля';
      const isPPF = (activeOrderState.serviceName || '').includes('PPF') || (activeOrderState.serviceName || '').includes('пленк');
      const timing = isPPF
        ? `Оклейка зон риска для ${car} занимает от 1 до 2 рабочих дней. Пленке требуется технологическая просушка в теплом боксе и фиксация всех подворотов.`
        : `Комплексная полировка и защита для ${car} занимает 1 рабочий день (утром привозите, на следующий день забираете в идеальном состоянии).`;

      return {
        text: `${timing}\n\nПодскажите, на какой день и время вам удобно приехать к нам в студию? Забронирую бокс под ваш график!`
      };
    }

    // 10. ВОПРОС О ГАРАНТИИ
    if (low.includes('гарант') || low.includes('сертифик') || low.includes('надежн')) {
      const car = activeOrderState.carModel || 'автомобиль';
      return {
        text: `На все работы по ${car} предоставляется официальная гарантия:\n• На полиуретановую пленку — гарантия от производителя от 5 до 10 лет (не желтеет, не мутнеет, не трескается от мороза).\n• На монтаж и прилегание краев — гарантия студии 1 год.\n• На керамику 9H — гарантия гидрофобного эффекта до 18 месяцев.\n\nЧерез 10–14 дней после оклейки мы приглашаем вас на бесплатный контрольный осмотр мастера.`
      };
    }

    // 11. ВОПРОС О МАТЕРИАЛАХ И БРЕНДАХ ПЛЕНОК
    if (low.includes('материал') || (low.includes('пленк') && (low.includes('как') || low.includes('бренд') || low.includes('фирм') || low.includes('производ'))) || low.includes('какой состав')) {
      return {
        text: `Мы работаем исключительно со 100% оптическим полиуретаном премиум-класса толщиной 195–215 микрон (бренды Stek, Llumar, SunTek).\n\nПленка имеет прочный верхний лаковый слой Top Coat — царапины от веток и песка самозатягиваются от тепла на солнце или горячей воды. Никакого дешевого винила или гибрида.`
      };
    }

    // 12. ВОПРОС О ЗОНАХ РИСКА (ЧТО ВХОДИТ)
    if ((low.includes('зон') && low.includes('риск')) || low.includes('что входит') || low.includes('какие детали')) {
      const car = activeOrderState.carModel || 'автомобиля';
      return {
        text: `В комплекс «Зоны риска» для ${car} входит оклейка самых уязвимых от гравия и сколов элементов:\n• Капот полностью;\n• Передний бампер целиком со всеми вставками;\n• Передние крылья полностью;\n• Корпуса боковых зеркал;\n• Оптика (фары и ПТФ);\n• Зоны под ручками дверей (от ногтей);\n• Полоса на крышу над лобовым стеклом;\n• Стойки лобового стекла.`
      };
    }

    // 13. ВОПРОС О СКИДКАХ И ЦЕНЕ
    if (low.includes('скидк') || low.includes('подешевл') || low.includes('дорог') || low.includes('торг') || low.includes('уступ')) {
      const car = activeOrderState.carModel || 'автомобиля';
      return {
        text: `В расчет для вашего ${car} уже включены максимальные бонусы по нашей акции:\n1. Антидождь передней полусферы в подарок — 0 ₽ (экономия 4 000 ₽);\n2. Бесплатный замер толщины ЛКП всего кузова высокоточным толщиномером;\n3. Детейлинг-мойка кузова перед оклейкой.\n\nМы держим фиксированные честные цены с гарантией качества без скрытых доплат.`
      };
    }

    // 14. ВОПРОС ОБ ОПЛАТЕ И ПРЕДОПЛАТЕ
    if (low.includes('оплат') || low.includes('предоплат') || low.includes('карт') || low.includes('наличн') || low.includes('сбп') || low.includes('безнал')) {
      return {
        text: `Предоплата для бронирования не требуется! Оплата производится строго по факту завершения работ после вашего личного осмотра автомобиля.\n\nПринимаем любые удобные способы: наличные, банковская карта, СБП, а также безналичный расчет для юридических лиц.`
      };
    }

    // 15. ПЕРЕНОС ДНЯ / ВРЕМЕНИ
    if (low.includes('воскресень') || low.includes('понедельник') || low.includes('вторник') || low.includes('сред') || low.includes('четверг') || low.includes('пятниц') || low.includes('будн') || low.includes('другой день') || low.includes('другое время') || low.includes('утром') || low.includes('вечером')) {
      const timePref = extractTimePreference(text);
      if (timePref) {
        activeOrderState.slot = timePref;
      }
      return {
        text: `Да, конечно! Мы с удовольствием примем вас в удобное для вас время${timePref ? ` (${timePref})` : ''}.\n\nПодскажите, пожалуйста, ваше имя и номер телефона (или Telegram @никнейм), и наш администратор закрепит бокс и свяжется для подтверждения деталей.`
      };
    }

    // 16. СОГЛАСИЕ НА ЗАПИСЬ / ПОДТВЕРЖДЕНИЕ
    if (low === 'да' || low === 'давайте' || low === 'хорошо' || low === 'согласен' || low === 'подходит' || low === 'бронируйте' || low === 'ок' || low === 'запишите' || low.startsWith('да,') || low.startsWith('давайте,')) {
      const timePref = extractTimePreference(text);
      if (timePref) {
        activeOrderState.slot = timePref;
      }
      const car = activeOrderState.carModel || 'автомобиль';
      return {
        text: `Отлично! С удовольствием забронируем удобное для вас время для вашего ${car}.\n\nПодскажите, пожалуйста:\n1. На какой день и время вам удобнее всего приехать?\n2. Ваше имя и контакт для связи (номер телефона или Telegram @никнейм), чтобы мастер закрепил за вами окно.`
      };
    }

    // 17. Запрос записи БЕЗ контакта
    if (isBookingRequest(text)) {
      const timePref = extractTimePreference(text);
      if (timePref) {
        activeOrderState.slot = timePref;
      }
      return {
        text: 'С удовольствием запишем вас в наш детейлинг-центр!\n\nПодскажите, пожалуйста, на какой день и время вам удобно приехать, а также ваше имя и номер телефона (или Telegram @никнейм), чтобы мастер закрепил бронь и связался с вами.'
      };
    }

    // 18. Консультация и помощь с выбором (БЕЗ сметы)
    if (low.includes('выбор') || low.includes('помог') || low.includes('посовету') || low.includes('подскаж') || low.includes('что лучше')) {
      return {
        text: 'С удовольствием помогу подобрать оптимальный комплекс услуг!\n\nПодскажите, пожалуйста:\n1. Марку и модель вашего автомобиля?\n2. Автомобиль новый из салона или с пробегом?\n3. Какую задачу в первую очередь хотите решить: защитить кузов от сколов (пленка PPF), вернуть зеркальный глянец (полировка + керамика) или обновить салон (химчистка)?'
      };
    }

    // 19. Адрес и локация
    if (low.includes('где') || low.includes('адрес') || low.includes('находит') || low.includes('город') || low.includes('как доехать')) {
      return {
        text: `Наш детейлинг-центр находится по адресу: ${STUDIO_CONFIG.city}. Работаем ежедневно по предварительной записи. Подсказать стоимость услуг или подобрать удобное время?`
      };
    }

    // 20. ПРЯМОЙ РАСЧЕТ СМЕТЫ / ВЫБОР УСЛУГИ ДЛЯ НАЗВАННОГО АВТОМОБИЛЯ
    const detectedCar = detectCarDetails(text);
    const isCarMentioned = !!(detectedCar.carModel || detectedCar.carClass);
    const isServiceMentioned = low.includes('полировк') || low.includes('ppf') || low.includes('пленк') || low.includes('керамик') || low.includes('оклейк') || low.includes('химчист') || low.includes('салон') || low.includes('почистить');
    const isPriceOrServiceAsk = isEstimateRequest(text) || isServiceMentioned || low.includes('хочу');

    if (isCarMentioned && !isPriceOrServiceAsk && !activeOrderState.carModel) {
      // Пользователь назвал только автомобиль, но услугу еще не выбрал
      const cModel = detectedCar.carModel || 'ваш автомобиль';
      const cClass = detectedCar.carClass || 'Внедорожник';
      activeOrderState.carModel = cModel;
      activeOrderState.carClass = cClass;

      const ppfPrice = (cClass === 'Седан') ? '65 000 ₽' : '75 000 ₽';
      const polPrice = (cClass === 'Внедорожник') ? '26 000 ₽' : ((cClass === 'Кроссовер') ? '22 000 ₽' : '18 000 ₽');
      const cleanPrice = (cClass === 'Седан') ? '15 000 ₽' : '18 000 ₽';

      return {
        text: `Отличный выбор — ${cModel} (${cClass})! Зафиксировал ваш автомобиль.\n\nКакая услуга вас интересует в первую очередь:\n1. 🛡 Оклейка зон риска полиуретановой пленкой PPF — ${ppfPrice}\n2. ✨ Восстановительная полировка кузова — ${polPrice} (акция: антидождь в подарок!)\n3. 🧼 Комплексная детейлинг-химчистка салона — ${cleanPrice}\n\nНапишите интересующую услугу, и я сразу сформирую точную смету с подарком по акции!`
      };
    }

    if (isCarMentioned || (isPriceOrServiceAsk && activeOrderState.carModel)) {
      const est = computeEstimateForCar(text, activeOrderState);
      activeOrderState = Object.assign({}, activeOrderState, est);

      const isPPF = (est.serviceName || '').includes('PPF') || (est.serviceName || '').includes('пленк');
      const serviceDesc = isPPF
        ? `стоимость оклейки зон риска полиуретановой пленкой (PPF) — ${est.basePrice.toLocaleString('ru-RU')} ₽`
        : `стоимость комплексной восстановительной полировки кузова — ${est.basePrice.toLocaleString('ru-RU')} ₽`;

      const upsellDesc = est.upsellPrice > 0
        ? `В качестве максимальной защиты рекомендуем нанести ${est.upsellName.toLowerCase()} (+${est.upsellPrice.toLocaleString('ru-RU')} ₽).`
        : `Выбран базовый комплекс без дополнительных опций.`;

      return {
        text: `Для ${est.carModel} (${est.carClass}) ${serviceDesc}. ${upsellDesc} Нанесение гидрофобного антидождя на переднюю полусферу — 0 ₽ в подарок по действующей акции!\n\nПодскажите, на какой день и время вам удобно приехать в студию? Я сразу зафиксирую предварительную бронь!`,
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    // 21. ФОЛЛБЭК: Если автомобиль уже обсуждается в диалоге (activeOrderState.carModel)
    if (activeOrderState.carModel) {
      const car = activeOrderState.carModel;
      const cClass = activeOrderState.carClass;
      return {
        text: `По вашему автомобилю ${car} (${cClass}) предварительный заказ-наряд зафиксирован.\n\nПодскажите, на какой день и время вам удобно приехать к нам, или хотите уточнить какие-либо детали по комплексу, материалам или срокам?`
      };
    }

    // 22. ФОЛЛБЭК: Если диалог уже идет (пользователь уже задавал вопросы, но авто еще не назвал)
    // КАТЕГОРИЧЕСКИ НЕ ПОВТОРЯЕМ ПРИВЕТСТВИЕ!
    return {
      text: 'С удовольствием подробно проконсультирую по технологиям и помогу подобрать лучший комплекс!\n\nПодскажите, пожалуйста, какая у вас марка и модель автомобиля? Я сразу сделаю точный расчет стоимости и сориентирую по свободным окнам.'
    };
  }

  let isSending = false;
  let isGeminiReachable = true;

  function setControlsState(disabled) {
    const inputs = [inlineInput, floatingInput];
    const sends = [inlineSend, floatingSend];

    inputs.forEach(inp => {
      if (inp) {
        if (disabled) inp.setAttribute('disabled', 'true');
        else inp.removeAttribute('disabled');
      }
    });

    sends.forEach(btn => {
      if (btn) {
        btn.disabled = disabled;
        btn.style.opacity = disabled ? '0.4' : '1';
        btn.style.pointerEvents = disabled ? 'none' : 'auto';
      }
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
    if (inlineHost && inlineHost.shadowRoot) {
      toggleChips(inlineHost.shadowRoot);
    }
  }

  async function queryAi(promptText, chatHistory, contactInfo) {
    // 1. Попытка запроса через бэкенд FastAPI (/api/chat), если запущен локально
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1200);
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

    // 2. Интеллектуальный моментальный отклик (320 мс живого набора)
    await new Promise(r => setTimeout(r, 320));
    return getSmartFallback(promptText, contactInfo);
  }

  async function handleUserSend(text) {
    if (isSending) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    isSending = true;
    setControlsState(true);

    try {
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

      // Сохраняем пожелание по времени, если пользователь его указал
      const timePref = extractTimePreference(trimmed);
      if (timePref) {
        activeOrderState.slot = timePref;
      }

      // Анализ контакта и намерения
      const contactInfo = extractContactInfo(trimmed);
      const refusalMode = isRefusal(trimmed, '');
      const b2bMode = isLeadershipOrB2bQuery(trimmed);
      const bookingMode = (isBookingRequest(trimmed) || !!contactInfo) && !b2bMode;

      // Показываем индикатор набора
      showTyping();

      // Запрос к AI (быстрый ответ)
      const rawResult = await queryAi(trimmed, messages, contactInfo);
      hideTyping();

      const cleanText = stripCodePieces(rawResult.text);

      // Извлекаем смету: ТОЛЬКО при запросе цены или при подтверждении брони с контактом
      let estimate = null;
      if (!refusalMode && !b2bMode) {
        estimate = rawResult.estimate || extractEstimate(rawResult.rawText || rawResult.text, trimmed, contactInfo);
      }

      // Если клиент предоставил контакт (финальное подтверждение записи), гарантируем наличие сметы
      if (contactInfo && !estimate && !refusalMode && !b2bMode) {
        estimate = Object.assign({}, activeOrderState, {
          isEstimate: true,
          slot: activeOrderState.slot || 'по согласованию (на ваш выбор)'
        });
      }

      if (cleanText) {
        messages.push({
          role: 'bot',
          isEstimate: false,
          text: cleanText
        });
      }

      if (estimate) {
        const estBasePrice = (estimate.basePrice !== undefined && estimate.basePrice !== null && !isNaN(estimate.basePrice))
          ? Number(estimate.basePrice) : 18000;
        const estUpsellPrice = (estimate.upsellPrice !== undefined && estimate.upsellPrice !== null && !isNaN(estimate.upsellPrice))
          ? Number(estimate.upsellPrice) : (estimate.upsellExcluded ? 0 : 25000);
        const estTotalPrice = (estimate.totalPrice !== undefined && estimate.totalPrice !== null && !isNaN(estimate.totalPrice))
          ? Number(estimate.totalPrice) : (estBasePrice + estUpsellPrice);
        const estSlot = estimate.slot || activeOrderState.slot || 'по согласованию (на ваш выбор)';

        messages.push({
          role: 'bot',
          isEstimate: true,
          carModel: estimate.carModel || 'Автомобиль',
          carClass: estimate.carClass || 'Расчёт по прайсу',
          serviceName: estimate.serviceName || 'Комплексная восстановительная полировка кузова',
          basePrice: estBasePrice,
          upsellName: estimate.upsellName || (estUpsellPrice > 0 ? 'Нанокерамика 9H (2 слоя)' : 'Без дополнительных опций'),
          upsellPrice: estUpsellPrice,
          totalPrice: estTotalPrice,
          slot: estSlot
        });

        try {
          const contactStr = contactInfo ? contactInfo.display : (bookingMode ? 'Онлайн-бронь слота' : 'Онлайн-диалог');
          window.dispatchEvent(new CustomEvent('ecm-lead-created', {
            detail: {
              client: 'Посетитель сайта',
              contact: contactStr,
              car: `${estimate.carModel} (${estimate.carClass})`,
              service: `${estimate.serviceName || 'Полировка'} + ${estimate.upsellName || 'Керамика'}`,
              cost: `${Number(estimate.totalPrice || 43000).toLocaleString('ru-RU')} ₽`,
              source: 'Виджет на сайте',
              status: contactInfo ? 'Бронь подтверждена' : 'Новая заявка'
            }
          }));
        } catch (e) {}
      }

      renderAllStreams();
    } finally {
      isSending = false;
      setControlsState(false);
    }
  }

  function showTyping() {
    hideTyping();
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
      requestAnimationFrame(() => {
        inlineStream.scrollTop = inlineStream.scrollHeight;
      });
    }
    if (floatingStream) {
      floatingStream.insertAdjacentHTML('beforeend', dotsHtml);
      requestAnimationFrame(() => {
        floatingStream.scrollTop = floatingStream.scrollHeight;
      });
    }
  }

  function hideTyping() {
    if (inlineStream) {
      inlineStream.querySelectorAll('.typing-msg').forEach(el => el.remove());
    }
    if (floatingStream) {
      floatingStream.querySelectorAll('.typing-msg').forEach(el => el.remove());
    }
  }

  // ─── 12. АВТОПЛЕЙ ПРИ СТАРТЕ (C УВАЖЕНИЕМ К REDUCED MOTION) ────────
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function runAutoplay() {
    resetActiveOrderState();
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
