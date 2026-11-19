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
Ты — опытный, вовлеченный и экспертный мастер-приемщик премиального детейлинг-центра «${STUDIO_CONFIG.company_name}».
ТВОЙ СТИЛЬ: Живой, естественный диалог профессионала. Без роботизированных анкет («1. Марку? 2. Новый или с пробегом? 3. Какую задачу?»). Задавай максимум 1–2 логичных вопроса за раз, органично подхватывая реплику клиента.

ПРАЙС-ЛИСТ (СТРОГО ФИКСИРОВАННЫЙ):
- Седан / Купе / Хэтчбек / Лифтбек (BMW 3/4/5/6/7, Mercedes C/E/S/CLA/CLS, Audi A3–A8, Zeekr 001/007, Camry, Preface, Emgrand, Arrizo, UNI-V, Omoda S5, Octavia, K5, Solaris): Полировка 18 000 ₽, Керамика 9H 25 000 ₽, PPF 65 000 ₽, Химчистка 15 000 ₽.
- Кроссовер (Geely Monjaro/Tugella/Atlas/Coolray, Haval Jolion/F7/M6, Chery Tiggo, Exeed TXL/RX/LX, Omoda C5, Jaecoo J7, Changan UNI-K/UNI-T/CS55/CS75, Voyah Free, Audi Q3/Q5, BMW X1–X4, Mercedes GLC/GLA/GLB, Tiguan, RAV4, Sportage, Tucson): Полировка 22 000 ₽, Керамика 9H 30 000 ₽, PPF 75 000 ₽, Химчистка 18 000 ₽.
- Джип / Внедорожник / Большой SUV (Tank 300/400/500/700, LiXiang L6/L7/L8/L9, Audi Q7/Q8/e-tron, BMW X5/X6/X7/XM, Mercedes G-Class (Гелик)/GLS/GLE, Land Cruiser 200/300/Prado, Lexus LX/GX, Porsche Cayenne, Haval Dargo/H9, Exeed VX, Jetour T2, GAC GS8, Aito M7/M9, Touareg, Palisade, Sorento): Полировка 26 000 ₽, Керамика 9H 30 000 ₽, PPF 75 000 ₽, Химчистка 18 000 ₽.
- Микроавтобус / Минивэн (Mercedes V-Class/Vito, Zeekr 009, Voyah Dream, GAC M8, Toyota Alphard, VW Multivan, Kia Carnival, Hyundai Staria): Полировка 28 000 ₽, Керамика 9H 35 000 ₽, PPF 85 000 ₽, Химчистка 22 000 ₽.

ПРАВИЛО ПАМЯТИ КОНТЕКСТА:
Если в диалоге уже обсуждалась конкретная услуга (например, химчистка или полировка), а клиент пишет: «ой я приеду на танке 300 сколько будет стоить на нем» — НЕ переспрашивай заново услугу! Сразу пересчитай активную услугу по тарифу Внедорожника (18 000 ₽ для химчистки Tank 300), обнови смету и естественно прокомментируй перерасчет.

ПРАВИЛО КЛАССИФИКАЦИИ (ЗАПРЕТ НА СЕДАН ПО УМОЛЧАНИЮ):
Никогда не подставляй «Седан», если авто не названо или неизвестно. Вежливо уточни модель или тип кузова.
Понимай русский сленг, опечатки и падежи: «на танке 300», «ку8», «лисян», «зикра», «гелик», «крузак», «бэха», «камрюха», «сольк», «скоко», «почем».

ПРОФИЛЬНЫЕ ДЕТАЛИ:
При упоминании авто отмечай его конструктивную особенность:
- Tank 300: массивный рамный кузов, вертикальное лобовое стекло и расширители арок — особый акцент на защиту зон риска от трассового гравия и большой объем салона;
- Audi Q8 / BMW X5: мускулистый рельефный кузов, оптика и глянцевые стойки Shadow Line;
- Китайские авто (LiXiang, Zeekr, Geely, Exeed, Changan): деликатный заводской лак, требующий защиты полиуретаном или керамикой;
- Седаны: акценты на передний бампер, капот, зеркала и глубокий глянец по бортам.

ПРАВИЛО ДОПРОДАЖИ (UPSELL):
К полировке ненавязчиво предлагай 2 слоя керамики 9H (+25 000 ₽ седан / +30 000 ₽ SUV), антидождь передней полусферы идет в подарок (0 ₽) по акции.
К оклейке PPF зон риска предлагай керамику на остальной кузов или бронирование лобового стекла.
К химчистке предлагай защитную гидрофобную пропитку сидений и озонирование (+8 000 ₽).
Если клиент просит только базовую услугу или без допов — соглашайся и считай только базовую цену.

ОТЕЧЕСТВЕННЫЕ АВТО:
Автомобили ВАЗ / Лада / УАЗ / Жигули не входят в профильный сегмент студии. Вежливо объясни, что мы специализируемся на современных иномарках бизнес- и премиум-класса.

БРОНИРОВАНИЕ:
Не назначай время сам. Всегда спрашивай: «На какой день и время вам удобно приехать?». Для закрепления брони уточни имя и номер телефона (или Telegram @никнейм).
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
    carClass: null,
    brand: null,
    serviceName: null,
    serviceCategory: null,
    basePrice: 0,
    upsellName: null,
    upsellPrice: 0,
    totalPrice: 0,
    slot: 'на ваш выбор (по согласованию)',
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
      slot: 'на ваш выбор (по согласованию)',
      upsellExcluded: false,
      carAge: null,
      stage: 'idle'
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
  function normalizeCarText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()?"«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectCar(text) {
    const norm = normalizeCarText(text);
    if (!norm) return { carModel: null, carClass: null, brand: null, isDomestic: false };

    function hasRx(pattern) {
      const rx = new RegExp('(?:^|\\s)(?:' + pattern + ')(?:\\s|$)', 'i');
      return rx.test(norm);
    }

    // 1. Отечественные авто (ВАЗ / Лада / УАЗ / Жигули)
    if (hasRx('жигул[иейяь]?|жигуле|жигуль|ваз|таз|девятк[аеуоы]|четырк[аеуоы]|сем[ее]рк[аеуоы]|сем[ее]рк[аеуоы]\\s*ваз|приор[аеуоы]|priora|грант[аеуоы]|granta|вест[аеуоы]|vesta|лада|lada')) {
      if (hasRx('нив[аеуоы]|niva')) {
        return { carModel: 'Lada Niva', carClass: 'Внедорожник', brand: 'Lada', isDomestic: true };
      }
      return { carModel: 'Lada / Жигули', carClass: 'Седан', brand: 'Lada', isDomestic: true };
    }
    if (hasRx('уаз|патриот[аеуом]?|patriot|хантер[аеуом]?')) {
      return { carModel: 'УАЗ Патриот', carClass: 'Внедорожник', brand: 'UAZ', isDomestic: true };
    }

    // 2. Tank (300, 400, 500, 700)
    if (hasRx('танк[аеуом]?\\s*(?:300|триста)|tank\\s*300')) {
      return { carModel: 'Tank 300', carClass: 'Внедорожник', brand: 'Tank', isDomestic: false };
    }
    if (hasRx('танк[аеуом]?\\s*(?:400|четыреста)|tank\\s*400')) {
      return { carModel: 'Tank 400', carClass: 'Внедорожник', brand: 'Tank', isDomestic: false };
    }
    if (hasRx('танк[аеуом]?\\s*(?:500|пятьсот)|tank\\s*500')) {
      return { carModel: 'Tank 500', carClass: 'Внедорожник', brand: 'Tank', isDomestic: false };
    }
    if (hasRx('танк[аеуом]?\\s*(?:700|семьсот)|tank\\s*700')) {
      return { carModel: 'Tank 700', carClass: 'Внедорожник', brand: 'Tank', isDomestic: false };
    }
    if (hasRx('танк[аеуом]?|tank')) {
      return { carModel: 'Tank', carClass: 'Внедорожник', brand: 'Tank', isDomestic: false };
    }

    // 3. LiXiang / Li Auto (L9, L8, L7, L6)
    if (hasRx('(?:li\\s*auto|lixiang|лисян[аеуом]?|ли\\s*сянг|ли)\\s*(?:l|л)?\\s*9|л\\s*9|l\\s*9')) {
      return { carModel: 'Li Auto L9', carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false };
    }
    if (hasRx('(?:li\\s*auto|lixiang|лисян[аеуом]?|ли\\s*сянг|ли)\\s*(?:l|л)?\\s*8|л\\s*8|l\\s*8')) {
      return { carModel: 'Li Auto L8', carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false };
    }
    if (hasRx('(?:li\\s*auto|lixiang|лисян[аеуом]?|ли\\s*сянг|ли)\\s*(?:l|л)?\\s*7|л\\s*7|l\\s*7')) {
      return { carModel: 'Li Auto L7', carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false };
    }
    if (hasRx('(?:li\\s*auto|lixiang|лисян[аеуом]?|ли\\s*сянг|ли)\\s*(?:l|л)?\\s*6|л\\s*6|l\\s*6')) {
      return { carModel: 'Li Auto L6', carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false };
    }
    if (hasRx('lixiang|лисян[аеуом]?|ли\\s*авто|ли\\s*сянг')) {
      return { carModel: 'Li Auto', carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false };
    }

    // 4. Zeekr (001, 009, 7X, X, 007)
    if (hasRx('(?:zeekr|зикр)[аеуом]?\\s*001')) {
      return { carModel: 'Zeekr 001', carClass: 'Бизнес-седан / Лифтбек', brand: 'Zeekr', isDomestic: false };
    }
    if (hasRx('(?:zeekr|зикр)[аеуом]?\\s*009')) {
      return { carModel: 'Zeekr 009', carClass: 'Микроавтобус', brand: 'Zeekr', isDomestic: false };
    }
    if (hasRx('(?:zeekr|зикр)[аеуом]?\\s*(?:7x|7х)')) {
      return { carModel: 'Zeekr 7X', carClass: 'Кроссовер', brand: 'Zeekr', isDomestic: false };
    }
    if (hasRx('(?:zeekr|зикр)[аеуом]?\\s*(?:x|х)')) {
      return { carModel: 'Zeekr X', carClass: 'Кроссовер', brand: 'Zeekr', isDomestic: false };
    }
    if (hasRx('(?:zeekr|зикр)[аеуом]?\\s*007')) {
      return { carModel: 'Zeekr 007', carClass: 'Седан', brand: 'Zeekr', isDomestic: false };
    }
    if (hasRx('zeekr|зикр[аеуом]?')) {
      return { carModel: 'Zeekr 001', carClass: 'Бизнес-седан / Лифтбек', brand: 'Zeekr', isDomestic: false };
    }

    // 5. Geely
    if (hasRx('монжар[оеауы]?|monjaro')) {
      return { carModel: 'Geely Monjaro', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('тугелл[аеуоы]?|tugella')) {
      return { carModel: 'Geely Tugella', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('атлас[аеуом]?|atlas')) {
      return { carModel: 'Geely Atlas', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('кулре[йияею]|coolray')) {
      return { carModel: 'Geely Coolray', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('окаванг[оеауы]?|okavango')) {
      return { carModel: 'Geely Okavango', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('префейс[аеуом]?|preface')) {
      return { carModel: 'Geely Preface', carClass: 'Седан', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('эмгранд[аеуом]?|emgrand')) {
      return { carModel: 'Geely Emgrand', carClass: 'Седан', brand: 'Geely', isDomestic: false };
    }
    if (hasRx('geely|джили')) {
      return { carModel: 'Geely', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false };
    }

    // 6. Haval
    if (hasRx('дарг[оеауы]?|dargo')) {
      return { carModel: 'Haval Dargo', carClass: 'Внедорожник', brand: 'Haval', isDomestic: false };
    }
    if (hasRx('(?:haval|хавейл|хавал)?\\s*(?:h\\s*9|н\\s*9)')) {
      return { carModel: 'Haval H9', carClass: 'Внедорожник', brand: 'Haval', isDomestic: false };
    }
    if (hasRx('джолион[аеуом]?|джулион[аеуом]?|jolion')) {
      return { carModel: 'Haval Jolion', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false };
    }
    if (hasRx('(?:haval|хавейл|хавал)?\\s*(?:f\\s*7\\s*x?|ф\\s*7\\s*х?)')) {
      return { carModel: 'Haval F7', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false };
    }
    if (hasRx('(?:haval|хавейл|хавал)?\\s*(?:m\\s*6|м\\s*6)')) {
      return { carModel: 'Haval M6', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false };
    }
    if (hasRx('haval|хавал|хавейл')) {
      return { carModel: 'Haval', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false };
    }

    // 7. Другие китайские бренды
    if (hasRx('тигг[оеауы]\\s*(?:4|7|8|9)(?:\\s*(?:про|макс|pro|max))?|tiggo')) {
      return { carModel: 'Chery Tiggo', carClass: 'Кроссовер', brand: 'Chery', isDomestic: false };
    }
    if (hasRx('арриз[оеауы]|arrizo')) {
      return { carModel: 'Chery Arrizo', carClass: 'Седан', brand: 'Chery', isDomestic: false };
    }
    if (hasRx('чери|chery')) {
      return { carModel: 'Chery', carClass: 'Кроссовер', brand: 'Chery', isDomestic: false };
    }

    if (hasRx('тхл|txl')) {
      return { carModel: 'Exeed TXL', carClass: 'Кроссовер', brand: 'Exeed', isDomestic: false };
    }
    if (hasRx('vx|вх')) {
      return { carModel: 'Exeed VX', carClass: 'Внедорожник', brand: 'Exeed', isDomestic: false };
    }
    if (hasRx('rx|рх\\s*эксид')) {
      return { carModel: 'Exeed RX', carClass: 'Кроссовер', brand: 'Exeed', isDomestic: false };
    }
    if (hasRx('эксид[аеуом]?|exeed')) {
      return { carModel: 'Exeed', carClass: 'Кроссовер', brand: 'Exeed', isDomestic: false };
    }

    if (hasRx('т\\s*2|t\\s*2')) {
      return { carModel: 'Jetour T2', carClass: 'Внедорожник', brand: 'Jetour', isDomestic: false };
    }
    if (hasRx('дашинг[аеуом]?|dashing|x\\s*70|х\\s*70|x\\s*90|х\\s*90')) {
      return { carModel: 'Jetour Dashing', carClass: 'Кроссовер', brand: 'Jetour', isDomestic: false };
    }
    if (hasRx('джетур[аеуом]?|jetour')) {
      return { carModel: 'Jetour', carClass: 'Кроссовер', brand: 'Jetour', isDomestic: false };
    }

    if (hasRx('c\\s*5|с\\s*5')) {
      return { carModel: 'Omoda C5', carClass: 'Кроссовер', brand: 'Omoda', isDomestic: false };
    }
    if (hasRx('s\\s*5|с\\s*5\\s*гт')) {
      return { carModel: 'Omoda S5', carClass: 'Седан', brand: 'Omoda', isDomestic: false };
    }
    if (hasRx('омод[аеуоы]?|omoda')) {
      return { carModel: 'Omoda', carClass: 'Кроссовер', brand: 'Omoda', isDomestic: false };
    }

    if (hasRx('j\\s*7|j\\s*8|джейку')) {
      return { carModel: 'Jaecoo J7', carClass: 'Кроссовер', brand: 'Jaecoo', isDomestic: false };
    }

    if (hasRx('uni\\s*k|юни\\s*к')) {
      return { carModel: 'Changan UNI-K', carClass: 'Кроссовер', brand: 'Changan', isDomestic: false };
    }
    if (hasRx('uni\\s*t|юни\\s*т')) {
      return { carModel: 'Changan UNI-T', carClass: 'Кроссовер', brand: 'Changan', isDomestic: false };
    }
    if (hasRx('uni\\s*v|юни\\s*в|lamore|ламор')) {
      return { carModel: 'Changan UNI-V', carClass: 'Седан', brand: 'Changan', isDomestic: false };
    }
    if (hasRx('cs\\s*(?:35|55|75|95)|цс\\s*(?:35|55|75|95)|чанган[аеуом]?|changan')) {
      return { carModel: 'Changan', carClass: 'Кроссовер', brand: 'Changan', isDomestic: false };
    }

    if (hasRx('voyah\\s*free|воя\\s*фри|фри')) {
      return { carModel: 'Voyah Free', carClass: 'Кроссовер', brand: 'Voyah', isDomestic: false };
    }
    if (hasRx('voyah\\s*dream(?:er)?|воя\\s*дрим|дрим')) {
      return { carModel: 'Voyah Dream', carClass: 'Микроавтобус', brand: 'Voyah', isDomestic: false };
    }
    if (hasRx('voyah|воя')) {
      return { carModel: 'Voyah Free', carClass: 'Кроссовер', brand: 'Voyah', isDomestic: false };
    }

    if (hasRx('аито|айто|aito|seres\\s*m[579]')) {
      return { carModel: 'Aito M7', carClass: 'Внедорожник', brand: 'Aito', isDomestic: false };
    }
    if (hasRx('аватр|аватар|avatr')) {
      return { carModel: 'Avatr 11', carClass: 'Кроссовер', brand: 'Avatr', isDomestic: false };
    }

    if (hasRx('gs\\s*8|гс\\s*8')) {
      return { carModel: 'GAC GS8', carClass: 'Внедорожник', brand: 'GAC', isDomestic: false };
    }
    if (hasRx('m\\s*8|м\\s*8')) {
      return { carModel: 'GAC M8', carClass: 'Микроавтобус', brand: 'GAC', isDomestic: false };
    }
    if (hasRx('гак|gac')) {
      return { carModel: 'GAC GS8', carClass: 'Внедорожник', brand: 'GAC', isDomestic: false };
    }

    // 8. Audi
    if (hasRx('(?:audi|ауди)?\\s*(?:sq\\s*8|rs\\s*q\\s*8|rsq\\s*8|q\\s*8|ку\\s*8|кю\\s*8)')) {
      return { carModel: 'Audi Q8', carClass: 'Внедорожник', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:sq\\s*7|q\\s*7|ку\\s*7|кю\\s*7)')) {
      return { carModel: 'Audi Q7', carClass: 'Внедорожник', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:e-tron|етрон|е\\s*трон)')) {
      return { carModel: 'Audi e-tron', carClass: 'Внедорожник', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:sq\\s*5|q\\s*5|ку\\s*5|кю\\s*5)')) {
      return { carModel: 'Audi Q5', carClass: 'Кроссовер', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:q\\s*3|ку\\s*3|кю\\s*3)')) {
      return { carModel: 'Audi Q3', carClass: 'Кроссовер', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:a\\s*8|а\\s*8|s\\s*8)')) {
      return { carModel: 'Audi A8', carClass: 'Бизнес-седан', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:a\\s*7|а\\s*7|s\\s*7|rs\\s*7)')) {
      return { carModel: 'Audi A7', carClass: 'Бизнес-седан / Лифтбек', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:a\\s*6|а\\s*6|s\\s*6|rs\\s*6)')) {
      return { carModel: 'Audi A6', carClass: 'Бизнес-седан', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:a\\s*5|а\\s*5|s\\s*5|rs\\s*5)')) {
      return { carModel: 'Audi A5', carClass: 'Седан / Купе', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:a\\s*4|а\\s*4|s\\s*4|rs\\s*4)')) {
      return { carModel: 'Audi A4', carClass: 'Седан', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('(?:audi|ауди)?\\s*(?:a\\s*3|а\\s*3|s\\s*3)')) {
      return { carModel: 'Audi A3', carClass: 'Седан', brand: 'Audi', isDomestic: false };
    }
    if (hasRx('audi|ауди')) {
      return { carModel: 'Audi', carClass: 'Седан', brand: 'Audi', isDomestic: false };
    }

    // 9. BMW
    if (hasRx('(?:bmw|бмв|бумер|бэх[аеуоы])?\\s*(?:x\\s*7|х\\s*7)')) {
      return { carModel: 'BMW X7', carClass: 'Внедорожник', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('(?:bmw|бмв|бумер|бэх[аеуоы])?\\s*(?:x\\s*6|х\\s*6)(?:\\s*m|м)?')) {
      return { carModel: 'BMW X6', carClass: 'Внедорожник', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('(?:bmw|бмв|бумер|бэх[аеуоы])?\\s*(?:x\\s*5|х\\s*5)(?:\\s*m|м)?')) {
      return { carModel: 'BMW X5', carClass: 'Внедорожник', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('(?:bmw|бмв)?\\s*(?:xm|хм)')) {
      return { carModel: 'BMW XM', carClass: 'Внедорожник', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('(?:bmw|бмв|бумер|бэх[аеуоы])?\\s*(?:x\\s*4|х\\s*4)')) {
      return { carModel: 'BMW X4', carClass: 'Кроссовер', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('(?:bmw|бмв|бумер|бэх[аеуоы])?\\s*(?:x\\s*3|х\\s*3)')) {
      return { carModel: 'BMW X3', carClass: 'Кроссовер', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('(?:bmw|бмв|бумер|бэх[аеуоы])?\\s*(?:x\\s*1|х\\s*1|x\\s*2|х\\s*2)')) {
      return { carModel: 'BMW X1', carClass: 'Кроссовер', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('7\\s*сери[яиею]|семерк[аеуоы]|сем[ее]рк[аеуоы]|g70|g11|g12')) {
      return { carModel: 'BMW 7 серии', carClass: 'Бизнес-седан', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('5\\s*сери[яиею]|пятерк[аеуоы]|пят[ее]рк[аеуоы]|f10|ф10|g30|g60|e60|e39')) {
      return { carModel: 'BMW 5 серии', carClass: 'Бизнес-седан', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('3\\s*сери[яиею]|тройк[аеуоы]|f30|ф30|g20|e90|e46')) {
      return { carModel: 'BMW 3 серии', carClass: 'Седан', brand: 'BMW', isDomestic: false };
    }
    if (hasRx('бмв|bmw|бэх[аеуоы]|бумер[аеуом]?')) {
      return { carModel: 'BMW', carClass: 'Седан', brand: 'BMW', isDomestic: false };
    }

    // 10. Mercedes
    if (hasRx('гелик[аеуом]?|g\\s*63|g\\s*500|г63|г500|g\\s*класс|g\\s*class')) {
      return { carModel: 'Mercedes-Benz G-Class (Гелик)', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('gls|глс|gl|гл')) {
      return { carModel: 'Mercedes GLS', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('gle|гле|ml|мл|емэль')) {
      return { carModel: 'Mercedes GLE', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('glc|глк|глик')) {
      return { carModel: 'Mercedes GLC', carClass: 'Кроссовер', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('gla|гла|glb|глб')) {
      return { carModel: 'Mercedes GLA', carClass: 'Кроссовер', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('v\\s*класс|v\\s*class|viano|виано|vito|вито')) {
      return { carModel: 'Mercedes V-Class', carClass: 'Микроавтобус', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('s\\s*класс|s\\s*class|эск[аеуоы]|w222|w223|майбах|maybach')) {
      return { carModel: 'Mercedes S-Class', carClass: 'Бизнес-седан', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('e\\s*класс|e\\s*class|ешк[аеуоы]|w213|w212')) {
      return { carModel: 'Mercedes E-Class', carClass: 'Бизнес-седан', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('c\\s*класс|c\\s*class|цэшк[аеуоы]|w205|w206')) {
      return { carModel: 'Mercedes C-Class', carClass: 'Седан', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('cla|cls')) {
      return { carModel: 'Mercedes CLS', carClass: 'Бизнес-седан / Купе', brand: 'Mercedes', isDomestic: false };
    }
    if (hasRx('мерседес[аеуом]?|mercedes|мерс[аеуом]?')) {
      return { carModel: 'Mercedes-Benz', carClass: 'Седан', brand: 'Mercedes', isDomestic: false };
    }

    // 11. Porsche
    if (hasRx('кайен[аеуом]?|каен[аеуом]?|cayenne')) {
      return { carModel: 'Porsche Cayenne', carClass: 'Внедорожник', brand: 'Porsche', isDomestic: false };
    }
    if (hasRx('макан[аеуом]?|macan')) {
      return { carModel: 'Porsche Macan', carClass: 'Кроссовер', brand: 'Porsche', isDomestic: false };
    }
    if (hasRx('панамер[аеуоы]?|panamera')) {
      return { carModel: 'Porsche Panamera', carClass: 'Бизнес-седан', brand: 'Porsche', isDomestic: false };
    }
    if (hasRx('тайкан[аеуом]?|taycan')) {
      return { carModel: 'Porsche Taycan', carClass: 'Бизнес-седан', brand: 'Porsche', isDomestic: false };
    }
    if (hasRx('911|порш|порше|porsche')) {
      return { carModel: 'Porsche', carClass: 'Бизнес-седан / Купе', brand: 'Porsche', isDomestic: false };
    }

    // 12. Toyota / Lexus
    if (hasRx('крузак[аеуом]?|крузер[аеуом]?|land\\s*cruiser|лс\\s*200|лс\\s*300|lc\\s*200|lc\\s*300|тлк\\s*(?:200|300)?')) {
      return { carModel: 'Toyota Land Cruiser', carClass: 'Внедорожник', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('прад[оеауы]?|prado')) {
      return { carModel: 'Toyota Land Cruiser Prado', carClass: 'Внедорожник', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('lx\\s*(?:570|600)?|лх\\s*(?:570|600)?|gx\\s*(?:460|550)?|гх')) {
      return { carModel: 'Lexus LX/GX', carClass: 'Внедорожник', brand: 'Lexus', isDomestic: false };
    }
    if (hasRx('хайлендер[аеуом]?|highlander')) {
      return { carModel: 'Toyota Highlander', carClass: 'Кроссовер', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('рав\\s*4|rav\\s*4|rx\\s*(?:350|300)?|рх|nx|нх')) {
      return { carModel: 'Toyota RAV4 / Lexus RX', carClass: 'Кроссовер', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('камр[иеяю]|камрюх[аеуоы]|camry')) {
      return { carModel: 'Toyota Camry', carClass: 'Седан', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('королл[аеуоы]|corolla|es|ес|is|ис|ls|лс')) {
      return { carModel: 'Toyota / Lexus', carClass: 'Седан', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('альфард|alphard')) {
      return { carModel: 'Toyota Alphard', carClass: 'Микроавтобус', brand: 'Toyota', isDomestic: false };
    }
    if (hasRx('тойот[аеуоы]|toyota|лексус[аеуом]?|lexus')) {
      return { carModel: 'Toyota / Lexus', carClass: 'Седан', brand: 'Toyota', isDomestic: false };
    }

    // 13. VW / Skoda
    if (hasRx('туарег[аеуом]?|touareg|терамонт[аеуом]?|teramont')) {
      return { carModel: 'VW Touareg', carClass: 'Внедорожник', brand: 'VW', isDomestic: false };
    }
    if (hasRx('тигуан[аеуом]?|tiguan|кодиак[аеуом]?|kodiaq|карок[аеуом]?|karoq|таос|taos')) {
      return { carModel: 'VW Tiguan / Skoda Kodiaq', carClass: 'Кроссовер', brand: 'VW', isDomestic: false };
    }
    if (hasRx('поло|polo|пассат[аеуом]?|passat|октави[яиею]|octavia|суперб[аеуом]?|superb|рапид[аеуом]?|rapid|джетт[аеуоы]|jetta|гольф|golf')) {
      return { carModel: 'VW / Skoda', carClass: 'Седан', brand: 'VW', isDomestic: false };
    }
    if (hasRx('мультивен|multivan|каравелл[аеуоы]|caravelle')) {
      return { carModel: 'VW Multivan', carClass: 'Микроавтобус', brand: 'VW', isDomestic: false };
    }

    // 14. Kia / Hyundai
    if (hasRx('сорент[оеауы]|sorento|мохав[еауы]?|mohave|палисад[аеуом]?|palisade|санта\\s*фе|santa\\s*fe')) {
      return { carModel: 'Kia Sorento / Hyundai Palisade', carClass: 'Внедорожник', brand: 'Kia', isDomestic: false };
    }
    if (hasRx('спортейдж[аеуом]?|спортидж[аеуом]?|sportage|туссан[аеуом]?|tucson|крет[аеуоы]|creta|селтос[аеуом]?|seltos')) {
      return { carModel: 'Kia Sportage / Hyundai Tucson', carClass: 'Кроссовер', brand: 'Kia', isDomestic: false };
    }
    if (hasRx('карнивал[аеуом]?|carnival|стари[яиею]|staria')) {
      return { carModel: 'Kia Carnival / Hyundai Staria', carClass: 'Микроавтобус', brand: 'Kia', isDomestic: false };
    }
    if (hasRx('солярис[аеуом]?|solaris|рио|rio|к\\s*5|k\\s*5|оптим[аеуоы]|optima|сонат[аеуоы]|sonata|элантр[аеуоы]|elantra|генезис|genesis')) {
      return { carModel: 'Kia / Hyundai', carClass: 'Седан', brand: 'Kia', isDomestic: false };
    }

    // 15. Общие родовые термины кузова
    if (hasRx('внедорожник[аеуом]?|джип[аеуом]?|рамник[аеуом]?|пикап[аеуом]?')) {
      return { carModel: 'Внедорожник', carClass: 'Внедорожник', brand: null, isDomestic: false };
    }
    if (hasRx('кроссовер[аеуом]?|паркетник[аеуом]?')) {
      return { carModel: 'Кроссовер', carClass: 'Кроссовер', brand: null, isDomestic: false };
    }
    if (hasRx('микроавтобус[аеуом]?|минивэн[аеуом]?|минивен[аеуом]?|бус[аеуом]?')) {
      return { carModel: 'Микроавтобус', carClass: 'Микроавтобус', brand: null, isDomestic: false };
    }
    if (hasRx('седан[аеуом]?|хэтчбек[аеуом]?|универсал[аеуом]?|купе|лифтбек[аеуом]?')) {
      return { carModel: 'Седан', carClass: 'Седан', brand: null, isDomestic: false };
    }

    return { carModel: null, carClass: null, brand: null, isDomestic: false };
  }

  // Алиас для обратной совместимости
  const detectCarDetails = detectCar;

  function getCarExpertDetail(carModel, carClass, brand) {
    const low = (carModel || '').toLowerCase();
    const cClass = carClass || '';

    if (low.includes('tank') || low.includes('танк')) {
      return 'У Танка массивный рамный кузов, выразительные расширители арок и плоское вертикальное лобовое стекло, которое на трассе особенно подвержено сколам от гравия.';
    }
    if (low.includes('audi q8') || low.includes('ку8')) {
      return 'У Audi Q8 мускулистый рельефный кузов с большой площадью оптики и глянцевыми стойками Shadow Line, требующими бережной полировки и надежной защиты.';
    }
    if (low.includes('bmw x5') || low.includes('х5') || low.includes('x6') || low.includes('x7')) {
      return 'У BMW серии X крупный рельефный кузов и широкие пороги — на трассе передняя часть и оптика принимают на себя весь пескоструй.';
    }
    if (low.includes('gle') || low.includes('gls') || low.includes('гелик') || low.includes('g-class')) {
      return 'У премиальных внедорожников Mercedes большая площадь ЛКП и дорогостоящая оптика, для которых крайне важна долговременная бронезащита.';
    }
    if (brand === 'LiXiang' || low.includes('li auto') || low.includes('лисян')) {
      return 'У LiXiang очень деликатный и мягкий заводской лак, а огромная площадь передней части без решетки радиатора быстро собирает паутинку и сколы на трассе.';
    }
    if (brand === 'Zeekr' || low.includes('zeekr') || low.includes('зикр')) {
      return 'У Zeekr стремительный аэродинамичный силуэт, а заводской лак чувствителен к агрессивной химии на бесконтактных мойках.';
    }
    if (brand === 'Geely' || low.includes('monjaro') || low.includes('монжаро') || low.includes('тугелла')) {
      return 'У Geely (особенно Monjaro и Tugella) качественный, но деликатный лак — защита керамикой или полиуретаном сохраняет глубокий заводской цвет без выгорания.';
    }
    if (brand === 'Haval' || low.includes('dargo') || low.includes('дарго') || low.includes('f7')) {
      return 'У Haval рельефные кузовные панели и выраженная передняя оптика, для которой защита зон риска является первоочередной задачей.';
    }
    if (cClass === 'Внедорожник') {
      return 'Для полноразмерного внедорожника с высокой посадкой и просторным кузовом качественная защита и уход сохранят максимум остаточной стоимости.';
    }
    if (cClass === 'Кроссовер') {
      return 'Для кроссовера городской режим и частые трассовые поездки создают повышенную нагрузку на бампер, капот и пороги.';
    }
    if (cClass.includes('Седан')) {
      return 'Для седана основное внимание уделяется переднему бамперу, капоту, оптике и созданию безупречного зеркального глянца по бортам.';
    }
    return '';
  }

  function isEstimateRequest(userText) {
    if (!userText) return false;
    if (isLeadershipOrB2bQuery(userText)) return false;
    const norm = normalizeCarText(userText);

    // Прямой вопрос о стоимости/расчете (с толерантностью к опечаткам вроде «солько», «скоко», «почем», «стоит»)
    const priceKws = [
      'скольк', 'сольк', 'скоко', 'скока', 'склько', 'почем',
      'цен', 'стоимост', 'стоит', 'прайс', 'рассчит', 'посчит', 'тариф',
      'смет', 'расчет', 'оцен', 'выход', 'выйдет', 'обойдет'
    ];
    if (priceKws.some(k => norm.includes(k))) return true;

    // Исключение допов / пересчет / запрос одной услуги
    if (isUpsellExclusionQuery(norm)) return true;

    // Услуга + автомобиль или намерение
    const services = [
      'ppf', 'ппф', 'пленк', 'плёнк', 'оклейк', 'оклеить', 'заклеить', 'затянуть', 'закатать',
      'полировк', 'палировк', 'керамик', 'химчист', 'химчиск', 'почистить', 'салон', 'пропитк'
    ];
    const hasService = services.some(s => norm.includes(s));
    const detectedCar = detectCar(userText);
    const hasCar = !!(detectedCar.carClass || detectedCar.carModel);

    if (hasService && hasCar) return true;
    if (norm.startsWith('хочу') && (hasService || hasCar)) return true;

    // Смена авто при активной услуге («ой я приеду на танке 300 сколько будет стоить на нем»)
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

    // КРИТИЧЕСКОЕ ПРАВИЛО: никогда не подставлять Седан по умолчанию для неизвестного авто!
    if (!carClass) return null;

    const isExcl = isUpsellExclusionQuery(norm) || !!(baseState && baseState.upsellExcluded);

    const isPPF = norm.includes('ppf') || norm.includes('ппф') || norm.includes('пленк') || norm.includes('оклейк') || norm.includes('заклеит') || norm.includes('затянут') || norm.includes('закатат') || norm.includes('брон') || ((baseState && baseState.serviceName && (baseState.serviceName.includes('PPF') || baseState.serviceName.includes('пленк'))));
    const isClean = norm.includes('химчист') || norm.includes('химчиск') || norm.includes('салон') || norm.includes('почистит') || norm.includes('пропитк') || norm.includes('сиден') || ((baseState && baseState.serviceName && (baseState.serviceName.includes('химчист') || baseState.serviceName.includes('салон'))));
    const curSlot = (baseState && baseState.slot && baseState.slot !== 'суббота 14:00') ? baseState.slot : 'на ваш выбор (по согласованию)';

    if (isPPF) {
      let bp = 65000;
      if (carClass === 'Внедорожник' || carClass === 'Кроссовер') bp = 75000;
      else if (carClass === 'Микроавтобус') bp = 85000;

      const up = isExcl ? 0 : (carClass === 'Седан' || carClass === 'Бизнес-седан' || carClass === 'Бизнес-седан / Лифтбек' ? 25000 : 30000);
      const uName = isExcl ? 'Без нанокерамики (только базовый комплекс PPF)' : 'Нанокерамика 9H на остальной кузов';
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
    } else if (isClean) {
      let bp = 15000;
      if (carClass === 'Внедорожник' || carClass === 'Кроссовер') bp = 18000;
      else if (carClass === 'Микроавтобус') bp = 22000;

      const up = isExcl ? 0 : 8000;
      const uName = isExcl ? 'Без защитной пропитки (только базовая химчистка)' : 'Озонирование + защитная пропитка';
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
    } else {
      let bp = 18000;
      if (carClass === 'Внедорожник') bp = 26000;
      else if (carClass === 'Кроссовер') bp = 22000;
      else if (carClass === 'Микроавтобус') bp = 28000;

      const up = isExcl ? 0 : (carClass === 'Седан' || carClass === 'Бизнес-седан' || carClass === 'Бизнес-седан / Лифтбек' ? 25000 : 30000);
      const uName = isExcl ? 'Без керамического покрытия (только восстановительная полировка)' : 'Нанокерамика 9H (2 слоя)';
      return {
        isEstimate: true,
        carModel: carModel || 'Автомобиль',
        carClass: carClass,
        serviceCategory: 'polishing',
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

  function extractEstimate(rawText, userText, contactInfo) {
    if (!rawText && !userText) return null;

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
            const detectedInUser = detectCar(userText);
            const userNamedCar = !!(detectedInUser.carModel || detectedInUser.carClass);

            const chosenModel = userNamedCar ? (autoCalc ? autoCalc.carModel : detectedInUser.carModel) : (parsed.carModel || (autoCalc ? autoCalc.carModel : activeOrderState.carModel));
            const chosenClass = userNamedCar ? (autoCalc ? autoCalc.carClass : detectedInUser.carClass) : (parsed.carClass || (autoCalc ? autoCalc.carClass : activeOrderState.carClass));

            if (!chosenClass) return null;

            const bp = (parsed.basePrice !== undefined && parsed.basePrice !== null) ? Number(parsed.basePrice) : (autoCalc ? autoCalc.basePrice : 18000);
            const up = (parsed.upsellPrice !== undefined && parsed.upsellPrice !== null) ? Number(parsed.upsellPrice) : (autoCalc ? autoCalc.upsellPrice : 25000);

            const res = {
              isEstimate: true,
              carModel: chosenModel || 'Автомобиль',
              carClass: chosenClass,
              serviceCategory: autoCalc ? autoCalc.serviceCategory : 'polishing',
              serviceName: parsed.serviceName || (autoCalc ? autoCalc.serviceName : 'Комплексная восстановительная полировка кузова'),
              basePrice: bp,
              upsellName: parsed.upsellName || (autoCalc ? autoCalc.upsellName : 'Нанокерамика 9H (2 слоя)'),
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
        if (autoCalc) {
          activeOrderState = Object.assign({}, activeOrderState, autoCalc);
          return autoCalc;
        }
      }
    }

    // 3. Автоматический интеллектуальный расчет сметы по авто клиента
    const autoEst = computeEstimateForCar(userText, activeOrderState);
    if (autoEst) {
      activeOrderState = Object.assign({}, activeOrderState, autoEst);
      return autoEst;
    }
    return null;
  }

  function getSmartFallback(text, contactInfo) {
    const norm = normalizeCarText(text || '');
    const low = norm;

    // 0. Вопросы о руководителе, директоре, приобретении бота под ключ или партнерстве (B2B)
    if (isLeadershipOrB2bQuery(text)) {
      return {
        text: 'Здравствуйте! Данный сервис — демонстрационная версия системы «ECM Systems» для детейлинг-центров и автобизнеса.\n\nПриобрести такого умного ИИ-бота и интерактивный виджет расчета сметы на сайт с установкой под ключ можно напрямую у нашего основателя и разработчика в Telegram: @godblessed77 (https://t.me/godblessed77).\n\n• Виджет встраивается в любой сайт в 1 строчку кода с полной адаптацией под ваш бренд.\n• CRM-таблица (Google Sheets) ведет учет всех заявок + мгновенные пуши в Telegram.\n• Тест-драйв 24 часа без предоплаты. Напишите основателю: @godblessed77'
      };
    }

    // 1. Проверка на непрофильные отечественные автомобили (ВАЗ / Лада / Жигули / УАЗ)
    const detectedCar = detectCar(text);
    if (detectedCar.isDomestic) {
      return {
        text: `Здравствуйте! Автомобили марки ${detectedCar.carModel || 'отечественного производства'} не входят в список моделей нашего профильного сегмента (мы специализируемся на комплексном обслуживании, защите и уходе за современными иномарками бизнес- и премиум-класса: BMW, Mercedes, Audi, Porsche, LiXiang, Zeekr, Tank, Geely, Haval и др.).\n\nК сожалению, мы не сможем предложить обслуживание для данного автомобиля. Благодарим за интерес к нашему детейлинг-центру!`
      };
    }

    // 2. ОТКАЗ КЛИЕНТА ОТ ДИАЛОГА («спасибо, не надо», «я передумал», «нет, пока не нужно»)
    if (norm.includes('не надо') || norm.includes('не нужн') || norm.includes('передумал') || norm.includes('отмена') || norm.includes('отбой') || (norm.includes('нет') && norm.includes('спасибо'))) {
      return {
        text: 'Понял вас! Если появятся вопросы по защите или уходу за автомобилем — я всегда на связи. Будем рады видеть вас в нашем детейлинг-центре!'
      };
    }

    // 3. ЕСЛИ КЛИЕНТ ОСТАВИЛ КОНТАКТ (ТЕЛЕФОН, ТЕЛЕГРАМ, ВК)
    if (contactInfo) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;

      const car = activeOrderState.carModel || 'ваш автомобиль';
      const slot = activeOrderState.slot || 'в удобное для вас время';

      let receiptSummary = '';
      if (activeOrderState.carModel && activeOrderState.serviceName && activeOrderState.basePrice) {
        receiptSummary = ` предварительно закрепили предварительную смету по вашему ${car} (${activeOrderState.serviceName}: ${activeOrderState.totalPrice.toLocaleString('ru-RU')} ₽) и`;
      }

      return {
        text: `Отлично! Мы${receiptSummary} забронировали для вас временной интервал на ${slot}.\n\nОкно зафиксировано за вами на 15 минут! Наш старший мастер уже получил заявку и свяжется с вами по указанному контакту (${contactInfo.display}) для подтверждения времени и согласования деталей.`
      };
    }

    // 4. ИСКЛЮЧЕНИЕ ДОПРОДАЖИ: «Можно без керамики», «давайте без допов», «только химчистка»
    if (isUpsellExclusionQuery(norm)) {
      const car = activeOrderState.carModel || 'вашего автомобиля';
      const cClass = activeOrderState.carClass || 'Внедорожник';
      let sName = activeOrderState.serviceName || 'Комплексная восстановительная полировка кузова';
      let bPrice = 18000;
      let uName = 'Без дополнительных опций';
      let replyServiceWord = 'базовый комплекс';

      const isClean = norm.includes('химчист') || (activeOrderState.serviceName && activeOrderState.serviceName.includes('химчист'));
      const isPPF = norm.includes('ppf') || norm.includes('пленк') || (activeOrderState.serviceName && activeOrderState.serviceName.includes('PPF'));

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

      const est = {
        isEstimate: true,
        carModel: car,
        carClass: cClass,
        serviceCategory: isClean ? 'clean' : (isPPF ? 'ppf' : 'polishing'),
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
        text: `Да, конечно! Мы с радостью выполним только ${replyServiceWord} для вашего ${car} без дополнительных опций.\n\nВ этом случае стоимость составит ровно ${bPrice.toLocaleString('ru-RU')} ₽. Специальная акция сохраняется: нанесение гидрофобного антидождя на переднюю полусферу мы сделаем в подарок (0 ₽)!\n\nПодскажите, на какой день и время вам удобно приехать к нам в студию?`,
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    // 5. РАСПОЗНАН АВТОМОБИЛЬ ИЗ ТЕКСТА КЛИЕНТА (Смена авто или первичное указание)
    const isCarMentioned = !!(detectedCar.carModel || detectedCar.carClass);
    const hasServiceInText = norm.includes('полировк') || norm.includes('палировк') || norm.includes('ppf') || norm.includes('ппф') || norm.includes('пленк') || norm.includes('плёнк') || norm.includes('керамик') || norm.includes('оклейк') || norm.includes('оклеить') || norm.includes('заклеит') || norm.includes('затянут') || norm.includes('закатат') || norm.includes('химчист') || norm.includes('химчиск') || norm.includes('салон') || norm.includes('почистит');
    const isPriceQuery = isEstimateRequest(text);

    if (isCarMentioned) {
      const expertNote = getCarExpertDetail(detectedCar.carModel, detectedCar.carClass, detectedCar.brand);
      const isSwitchWithActiveService = !!activeOrderState.serviceName && !hasServiceInText;

      // Если в тексте названа услуга ИЛИ услуга уже была выбрана ранее в диалоге
      if (hasServiceInText || isSwitchWithActiveService || isPriceQuery) {
        const est = computeEstimateForCar(text, activeOrderState);
        if (est) {
          activeOrderState = Object.assign({}, activeOrderState, est);
          const isPPF = (est.serviceName || '').includes('PPF') || (est.serviceName || '').includes('пленк');
          const isClean = (est.serviceName || '').includes('химчист') || (est.serviceName || '').includes('салон');

          let serviceDesc = `стоимость оклейки зон риска полиуретановой пленкой PPF составляет ${est.basePrice.toLocaleString('ru-RU')} ₽`;
          if (isClean) {
            serviceDesc = `стоимость комплексной детейлинг-химчистки салона составляет ${est.basePrice.toLocaleString('ru-RU')} ₽`;
          } else if (!isPPF) {
            serviceDesc = `стоимость комплексной восстановительной полировки кузова составляет ${est.basePrice.toLocaleString('ru-RU')} ₽`;
          }

          let upsellDesc = est.upsellPrice > 0
            ? `Рекомендуем дополнить защитным комплексом: ${est.upsellName.toLowerCase()} (+${est.upsellPrice.toLocaleString('ru-RU')} ₽).`
            : `Выбран базовый комплекс без дополнительных опций.`;

          let switchComment = '';
          if (isSwitchWithActiveService) {
            switchComment = `Отлично, зафиксировал ${est.carModel} (${est.carClass})! ${expertNote}\n\n`;
          } else {
            switchComment = `Для ${est.carModel} (${est.carClass}): ${expertNote}\n\n`;
          }

          return {
            text: `${switchComment}По выбранной услуге ${serviceDesc}. ${upsellDesc} Нанесение гидрофобного антидождя на переднюю полусферу — 0 ₽ в подарок по действующей акции!\n\nПодскажите, на какой день и время вам удобно записаться в студию?`,
            estimate: est,
            rawText: JSON.stringify(est)
          };
        }
      }

      // Пользователь назвал ТОЛЬКО автомобиль, услуга еще не была выбрана
      const cModel = detectedCar.carModel || 'ваш автомобиль';
      const cClass = detectedCar.carClass || 'Внедорожник';
      activeOrderState.carModel = cModel;
      activeOrderState.carClass = cClass;

      const ppfPrice = (cClass === 'Седан') ? '65 000 ₽' : '75 000 ₽';
      const polPrice = (cClass === 'Внедорожник') ? '26 000 ₽' : ((cClass === 'Кроссовер') ? '22 000 ₽' : '18 000 ₽');
      const cleanPrice = (cClass === 'Седан') ? '15 000 ₽' : '18 000 ₽';

      return {
        text: `Отличный выбор — ${cModel} (${cClass})! ${expertNote}\n\nДля вашего кузова чаще всего выбирают:\n1. 🛡 Оклейка зон риска полиуретановой пленкой PPF — ${ppfPrice}\n2. ✨ Восстановительная полировка кузова — ${polPrice} (акция: антидождь в подарок!)\n3. 🧼 Комплексная детейлинг-химчистка салона — ${cleanPrice}\n\nКакая задача сейчас в приоритете: защитить кузов от сколов, вернуть идеальный зеркальный глянец или обновить салон?`
      };
    }

    // 6. ХИМЧИСТКА САЛОНА (БЕЗ НАЗВАННОГО АВТО)
    if (norm.includes('химчист') || norm.includes('химчиск') || norm.includes('салон') || norm.includes('почистит') || norm.includes('сиден')) {
      if (activeOrderState.carModel) {
        activeOrderState.serviceCategory = 'clean';
        activeOrderState.serviceName = 'Полная химчистка салона';
        const est = computeEstimateForCar(text, activeOrderState);
        activeOrderState = Object.assign({}, activeOrderState, est);
        return {
          text: `Для вашего ${est.carModel} (${est.carClass}) стоимость комплексной детейлинг-химчистки салона составляет ${est.basePrice.toLocaleString('ru-RU')} ₽. В комплекс входит глубокая чистка всех элементов интерьера, потолка, пола, багажника и озонирование салона.\n\nРекомендуем дополнить защитной гидрофобной пропиткой сидений (+${est.upsellPrice.toLocaleString('ru-RU')} ₽). Антидождь передней полусферы — 0 ₽ в подарок по акции!\n\nПодскажите, на какой день и время вам удобно приехать к нам в студию?`,
          estimate: est,
          rawText: JSON.stringify(est)
        };
      }
      activeOrderState.serviceCategory = 'clean';
      return {
        text: 'Стоимость комплексной детейлинг-химчистки салона с глубокой чисткой кожи/текстиля и озонированием:\n• Седаны и купе (BMW 3/5, Audi A4/A6, Camry) — 15 000 ₽\n• Кроссоверы и внедорожники (Audi Q7/Q8, BMW X5/X7, Li Auto L9, Tank 300) — 18 000 ₽\nПо действующей акции нанесение антидождя на переднюю полусферу — в подарок (0 ₽)!\n\nПодскажите, какая у вас марка и модель автомобиля? Я сразу сделаю точный расчет под ваш кузов!'
      };
    }

    // 7. ПОЛИРОВКА КУЗОВА (БЕЗ НАЗВАННОГО АВТО)
    if (norm.includes('полировк') || norm.includes('палировк') || norm.includes('царапин') || norm.includes('глянец')) {
      if (activeOrderState.carModel) {
        activeOrderState.serviceCategory = 'polishing';
        activeOrderState.serviceName = 'Комплексная восстановительная полировка кузова';
        const est = computeEstimateForCar(text, activeOrderState);
        activeOrderState = Object.assign({}, activeOrderState, est);
        return {
          text: `Для вашего ${est.carModel} (${est.carClass}) восстановительная полировка кузова составляет ${est.basePrice.toLocaleString('ru-RU')} ₽. Рекомендуем закрепить результат 2 слоями нанокерамики 9H (+${est.upsellPrice.toLocaleString('ru-RU')} ₽) для долговременной защиты от химии и царапин. Антидождь — в подарок по акции (0 ₽)!\n\nПодскажите, на какой день и время вам удобно записаться?`,
          estimate: est,
          rawText: JSON.stringify(est)
        };
      }
      activeOrderState.serviceCategory = 'polishing';
      return {
        text: 'Стоимость восстановительной полировки кузова:\n• Седаны и купе — 18 000 ₽ (+ керамика 9H 25 000 ₽)\n• Кроссоверы — 22 000 ₽ (+ керамика 9H 30 000 ₽)\n• Внедорожники — 26 000 ₽ (+ керамика 9H 30 000 ₽)\nПо действующей акции нанесение антидождя на переднюю полусферу — в подарок (0 ₽)!\n\nПодскажите, какая у вас модель автомобиля? Сделаю точный расчет под ваш кузов!'
      };
    }

    // 8. ОКЛЕЙКА ПЛЕНКОЙ PPF (БЕЗ НАЗВАННОГО АВТО)
    if (norm.includes('ppf') || norm.includes('ппф') || norm.includes('пленк') || norm.includes('плёнк') || norm.includes('оклейк') || norm.includes('оклеить') || norm.includes('заклеит') || norm.includes('затянут') || norm.includes('закатат') || norm.includes('брон')) {
      if (activeOrderState.carModel) {
        activeOrderState.serviceCategory = 'ppf';
        activeOrderState.serviceName = 'Оклейка зон риска пленкой PPF';
        const est = computeEstimateForCar(text, activeOrderState);
        activeOrderState = Object.assign({}, activeOrderState, est);
        return {
          text: `Оклейка зон риска премиальным оптическим полиуретаном PPF (капот, бампер, фары, зеркала, стойки) для вашего ${est.carModel} (${est.carClass}) составляет ${est.basePrice.toLocaleString('ru-RU')} ₽. На оставшийся кузов рекомендуем нанести нанокерамику 9H (+${est.upsellPrice.toLocaleString('ru-RU')} ₽), а антидождь сделаем в подарок по акции!\n\nПодскажите, когда вам удобно заехать на оклейку?`,
          estimate: est,
          rawText: JSON.stringify(est)
        };
      }
      activeOrderState.serviceCategory = 'ppf';
      return {
        text: 'Оклейка зон риска полиуретановой пленкой PPF (капот, бампер, крылья, фары, зеркала, стойки):\n• Седаны — 65 000 ₽\n• Кроссоверы и внедорожники — 75 000 ₽\nИспользуем 100% оптический полиуретан 200 микрон с самозатягивающимся слоем Top Coat (гарантия 5–10 лет).\n\nПодскажите, какая у вас модель автомобиля? Автомобиль новый из салона или с пробегом?'
      };
    }

    // 9. ВОПРОС О СРОКАХ И ВРЕМЕНИ ВЫПОЛНЕНИЯ
    if ((norm.includes('скольк') && norm.includes('времен')) || norm.includes('по времени') || norm.includes('сколько дней') || norm.includes('сколько часов') || norm.includes('когда готов') || norm.includes('когда забрать') || norm.includes('когда отдадите') || norm.includes('длится')) {
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
    if (norm.includes('гарант') || norm.includes('сертифик') || norm.includes('надежн')) {
      const car = activeOrderState.carModel || 'автомобиль';
      return {
        text: `На все работы по ${car} предоставляется официальная гарантия:\n• На полиуретановую пленку — гарантия от производителя от 5 до 10 лет (не желтеет, не мутнеет, не трескается от мороза).\n• На монтаж и прилегание краев — гарантия студии 1 год.\n• На керамику 9H — гарантия гидрофобного эффекта до 18 месяцев.\n\nЧерез 10–14 дней после оклейки мы приглашаем вас на бесплатный контрольный осмотр мастера.`
      };
    }

    // 11. ВОПРОС О МАТЕРИАЛАХ И БРЕНДАХ ПЛЕНОК
    if (norm.includes('материал') || (norm.includes('пленк') && (norm.includes('как') || norm.includes('бренд') || norm.includes('фирм') || norm.includes('производ'))) || norm.includes('какой состав')) {
      return {
        text: `Мы работаем исключительно со 100% оптическим полиуретаном премиум-класса толщиной 195–215 микрон (бренды Stek, Llumar, SunTek).\n\nПленка имеет прочный верхний лаковый слой Top Coat — царапины от веток и песка самозатягиваются от тепла на солнце или горячей воды. Никакого дешевого винила или гибрида.`
      };
    }

    // 12. ВОПРОС О ЗОНАХ РИСКА (ЧТО ВХОДИТ)
    if ((norm.includes('зон') && norm.includes('риск')) || norm.includes('что входит') || norm.includes('какие детали')) {
      const car = activeOrderState.carModel || 'автомобиля';
      return {
        text: `В комплекс «Зоны риска» для ${car} входит оклейка самых уязвимых от гравия и сколов элементов:\n• Капот полностью;\n• Передний бампер целиком со всеми вставками;\n• Передние крылья полностью;\n• Корпуса боковых зеркал;\n• Оптика (фары и ПТФ);\n• Зоны под ручками дверей (от ногтей);\n• Полоса на крышу над лобовым стеклом;\n• Стойки лобового стекла.`
      };
    }

    // 13. ВОПРОС О СКИДКАХ И ЦЕНЕ
    if (norm.includes('скидк') || norm.includes('подешевл') || norm.includes('дорог') || norm.includes('торг') || norm.includes('уступ')) {
      const car = activeOrderState.carModel || 'автомобиля';
      return {
        text: `В расчет для вашего ${car} уже включены максимальные бонусы по нашей акции:\n1. Антидождь передней полусферы в подарок — 0 ₽ (экономия 4 000 ₽);\n2. Бесплатный замер толщины ЛКП всего кузова высокоточным толщиномером;\n3. Детейлинг-мойка кузова перед началом работ.\n\nМы держим фиксированные честные цены с гарантией качества без скрытых наценок.`
      };
    }

    // 14. ВОПРОС ОБ ОПЛАТЕ И ПРЕДОПЛАТЕ
    if (norm.includes('оплат') || norm.includes('предоплат') || norm.includes('карт') || norm.includes('наличн') || norm.includes('сбп') || norm.includes('безнал')) {
      return {
        text: `Предоплата для бронирования не требуется! Оплата производится строго по факту завершения работ после вашего личного осмотра автомобиля.\n\nПринимаем любые удобные способы: наличные, банковская карта, СБП, а также безналичный расчет для юридических лиц.`
      };
    }

    // 15. ПЕРЕНОС ДНЯ / ВРЕМЕНИ
    if (norm.includes('воскресень') || norm.includes('понедельник') || norm.includes('вторник') || norm.includes('сред') || norm.includes('четверг') || norm.includes('пятниц') || norm.includes('будн') || norm.includes('другой день') || norm.includes('другое время') || norm.includes('утром') || norm.includes('вечером')) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      return {
        text: `Да, конечно! Мы с удовольствием примем вас в удобное для вас время${timePref ? ` (${timePref})` : ''}.\n\nПодскажите, пожалуйста, ваше имя и номер телефона (или Telegram @никнейм), и наш администратор закрепит бокс и свяжется для подтверждения деталей.`
      };
    }

    // 16. СОГЛАСИЕ НА ЗАПИСЬ / ПОДТВЕРЖДЕНИЕ
    if (norm === 'да' || norm === 'давайте' || norm === 'хорошо' || norm === 'согласен' || norm === 'подходит' || norm === 'бронируйте' || norm === 'ок' || norm === 'запишите' || norm.startsWith('да ') || norm.startsWith('давайте ')) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      const car = activeOrderState.carModel || 'автомобиль';
      return {
        text: `Отлично! С удовольствием забронируем удобное для вас время для вашего ${car}.\n\nПодскажите, пожалуйста, на какой день и время вам удобнее всего приехать, а также ваше имя и номер телефона (или Telegram @никнейм) для закрепления брони?`
      };
    }

    // 17. Запрос записи БЕЗ контакта
    if (isBookingRequest(text)) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      return {
        text: 'С удовольствием запишем вас в наш детейлинг-центр!\n\nПодскажите, пожалуйста, на какой день и время вам удобно приехать, а также ваше имя и номер телефона (или Telegram @никнейм), чтобы мастер закрепил бронь и связался с вами.'
      };
    }

    // 18. Живая консультация мастера (БЕЗ роботизированных анкет)
    if (norm.includes('выбор') || norm.includes('помог') || norm.includes('посовету') || norm.includes('подскаж') || norm.includes('что лучше')) {
      if (activeOrderState.carModel) {
        const car = activeOrderState.carModel;
        const expertNote = getCarExpertDetail(car, activeOrderState.carClass, activeOrderState.brand);
        return {
          text: `С удовольствием помогу определиться с комплексом для вашего ${car}! ${expertNote}\n\nПодскажите, какая первоочередная задача: защитить кузов от сколов по трассе (пленка PPF), вернуть зеркальный блеск (полировка + керамика) или обновить салон?`
        };
      }
      return {
        text: 'С удовольствием помогу подобрать оптимальный комплекс услуг!\n\nПодскажите, какой у вас автомобиль и какую задачу в первую очередь хотелось бы решить: защитить кузов от гравия (пленка PPF), вернуть зеркальный блеск (полировка + керамика) или обновить салон?'
      };
    }

    // 19. Адрес и локация
    if (norm.includes('где') || norm.includes('адрес') || norm.includes('находит') || norm.includes('город') || norm.includes('как доехать')) {
      return {
        text: `Наш детейлинг-центр находится по адресу: ${STUDIO_CONFIG.city}. Работаем ежедневно по предварительной записи. Подсказать стоимость услуг или подобрать удобное время?`
      };
    }

    // 20. Короткие приветствия
    if (norm === 'привет' || norm === 'здравствуйте' || norm === 'добрый день' || norm === 'добрый вечер' || norm === 'ку' || norm === 'салют') {
      if (activeOrderState.carModel) {
        return {
          text: `Здравствуйте! По вашему автомобилю ${activeOrderState.carModel} заказ-наряд зафиксирован.\n\nПодскажите, на какой день и время вам удобно запланировать визит?`
        };
      }
      return {
        text: 'Здравствуйте! Я на связи и готов подробно проконсультировать. Напишите марку и модель вашего автомобиля — и я сразу рассчитаю точную стоимость комплекса с подарком по акции!'
      };
    }

    // 21. ФОЛЛБЭК: Если автомобиль уже обсуждается в диалоге
    if (activeOrderState.carModel) {
      const car = activeOrderState.carModel;
      const cClass = activeOrderState.carClass || 'Внедорожник';
      return {
        text: `По вашему автомобилю ${car} (${cClass}) предварительный заказ-наряд зафиксирован.\n\nПодскажите, на какой день и время вам удобно приехать к нам, или хотите уточнить какие-либо детали по комплексу, материалам или срокам?`
      };
    }

    // 22. ФОЛЛБЭК: Если диалог уже идет, но авто еще не названо
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

      // Если клиент предоставил контакт (финальное подтверждение записи), гарантируем наличие сметы (только если авто определено)
      if (contactInfo && !estimate && !refusalMode && !b2bMode && activeOrderState.carModel && activeOrderState.carClass) {
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

      if (estimate && estimate.carClass) {
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
    detectCar: detectCar,
    detectCarDetails: detectCar,
    getSmartFallback: getSmartFallback,
    isEstimateRequest: isEstimateRequest,
    computeEstimateForCar: computeEstimateForCar,
    getActiveOrderState: function () { return activeOrderState; },
    setActiveOrderState: function (s) { activeOrderState = Object.assign({}, activeOrderState, s); },
    resetActiveOrderState: resetActiveOrderState,

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

  window.ECMWidget = window.EcmWidget;

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
