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

ПРАВИЛО ДОПРОДАЖИ (UPSELL) И ОБЪЯСНЕНИЕ ЦЕННОСТИ:
Никогда не предлагай услугу одной строчкой без объяснения, за что клиент платит и чем она полезна:
- К химчистке: предлагай ТОЛЬКО защитную гидрофобную пропитку сидений и озонирование (+8 000 ₽) с пояснением: «Также, если вам интересно, можем дополнительно сделать озонирование и защитную гидрофобную пропитку сидений (+8 000 ₽) — пропитка создаст невидимый барьер, чтобы жидкости и грязь не впитывались в кожу и текстиль, а озонирование уничтожит бактерии и запахи». КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО предлагать нанокерамику для химчистки!
- К полировке: предлагай нанокерамику 9H в 2 слоя, поясняя, что она защитит отполированный лак от реагентов и паутинки на 18 месяцев.
- К оклейке PPF: предлагай нанокерамику на остальной кузов, поясняя, что она защитит открытые элементы и выровняет зеркальный глянец.
- Если клиент просит только базовую услугу или без допов — соглашайся и считай только базовую цену.

ОТЕЧЕСТВЕННЫЕ АВТО:
Автомобили ВАЗ / Лада / УАЗ / Жигули не входят в профильный сегмент студии. Вежливо объясни, что мы специализируемся на современных иномарках бизнес- и премиум-класса.

БРОНИРОВАНИЕ:
Не назначай время сам. Всегда спрашивай: «На какой день и время вам удобно приехать?». Для закрепления брони уточни имя и номер телефона (или Telegram @никнейм).

ПРАВИЛО «НИКОГДА НЕ ПЕРЕСПРАШИВАЙ ТО, ЧТО КЛИЕНТ УЖЕ НАПИСАЛ»:
Если клиент уже указал автомобиль, услугу или день визита (например: «можно завтра будет заехать на прадик 200 химчистку сделать»):
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО слать общий прайс-лист по всем классам и переспрашивать марку!
- Сразу подтверди, что на завтра свободные окна есть, назови точную цену для Toyota Land Cruiser Prado (18 000 ₽ + антидождь в подарок), зафиксируй смету и спроси точное время визита и контакт для закрепления брони.
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
  const MAX_DEMO_MESSAGES = 500;

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
    containerEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    messages.forEach(m => fragment.appendChild(createMessageElement(m)));
    containerEl.appendChild(fragment);

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

    // 2. Telegram: t.me/link, @handle или "тг: handle"
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

    // 3. ВКонтакте: ссылка vk.com/handle или "вк: handle"
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
    const raw = text.toLowerCase().replace(/ё/g, "е");

    // 1. Формат ЧЧ:ММ или ЧЧ.ММ (например 14:00, 14.30, 9:15)
    const exactMatch = raw.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (exactMatch) {
      const h = parseInt(exactMatch[1], 10);
      const m = exactMatch[2];
      const hh = h < 10 ? "0" + h : "" + h;
      return { hour: h, minute: parseInt(m, 10), formatted: `${hh}:${m}`, raw: exactMatch[0] };
    }

    // 2. Словесные формы: проверяем сначала конкретные числа (два, три...), а потом уже единицу/час
    const wordItems = [
      { words: ["два", "двум", "двух", "двумя"], h: 14 },
      { words: ["три", "трем", "трех", "тремя"], h: 15 },
      { words: ["четыре", "четырем", "четырех"], h: 16 },
      { words: ["пять", "пяти"], h: 17 },
      { words: ["шесть", "шести"], h: 18 },
      { words: ["семь", "семи"], h: 19 },
      { words: ["восемь", "восьми"], h: 20 },
      { words: ["девять", "девяти"], h: 9 },
      { words: ["десять", "десяти"], h: 10 },
      { words: ["одиннадцать", "одиннадцати"], h: 11 },
      { words: ["двенадцать", "двенадцати"], h: 12 },
      { words: ["полдень"], h: 12 },
      { words: ["обед"], h: 13 },
      { words: ["час", "часу", "один", "одному", "единицу"], h: 13 }
    ];

    for (const item of wordItems) {
      for (const w of item.words) {
        const rx = new RegExp("(?:^|\\s)(?:(?:в|к|около|примерно|часа? в)\\s+)?" + w + "(?:\\s+час[а-я]*)?(?:\\s+(?:дня|вечера|утра|ночи))?(?:\\s|$|[.,!?;:])", "i");
        if (rx.test(raw)) {
          const hasTimeMarker = /(?:^|\s)(?:в|к|около|примерно|часа? в|приеду|буду|заеду|записат|свободно)/i.test(raw) ||
                                raw.includes("час") || raw.includes("дня") || raw.includes("утра") || raw.includes("вечера");
          if (hasTimeMarker) {
            let h = item.h;
            if (raw.includes("утра") && h >= 12) h -= 12;
            const hh = h < 10 ? "0" + h : "" + h;
            return { hour: h, minute: 0, formatted: `${hh}:00`, raw: w };
          }
        }
      }
    }

    // 3. Цифры с предлогом времени или словом час/дня/вечера/утра
    const hasDigitTimeContext = /(?:^|\s)(?:в|к|около|примерно|после|до)\s+(\d{1,2})(?:\s*(?:ч|час|часа|часов|дня|вечера|утра|ночи))?(?:\s|$|[.,!?;:])/i.test(raw) ||
                                /(?:^|\s)(\d{1,2})\s*(?:ч\b|час|часа|часов|дня|вечера|утра|ночи)(?:\s|$|[.,!?;:])/i.test(raw);

    if (hasDigitTimeContext) {
      const m = raw.match(/(?:(?:^|\s)(?:в|к|около|примерно|после|до)\s+(\d{1,2}))|(?:(?:^|\s)(\d{1,2})\s*(?:ч\b|час|часа|часов|дня|вечера|утра|ночи))/i);
      if (m) {
        const numStr = m[1] || m[2];
        let num = parseInt(numStr, 10);
        if (num >= 0 && num <= 24) {
          if (num >= 1 && num <= 7) {
            if (!raw.includes("ночи") && !raw.includes("утра")) {
              num += 12;
            }
          }
          const hh = num < 10 ? "0" + num : "" + num;
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

  function isUpsellExclusionQuery(text) {
    if (!text) return false;
    const norm = normalizeCarText(text || "").toLowerCase();

    // Исключаем нейтральные фразы вроде «без проблем», «без опозданий», «без разницы»
    if (norm.includes("без проблем") || norm.includes("без разниц") || norm.includes("без опоздан") || norm.includes("без задерж")) {
      return false;
    }

    // 1. «только / просто / чисто» + услуга с опечатками (только, тольео, толька, тольк, ток, тока, проста, просто, чисто)
    if (/(?:^|\s)(?:толь[кеоае]{1,2}|толк|тока|ток|прост[оа]?|чист[оа]?|лишь)\s+(?:одну\s+)?(?:хим\s*чист|чистк|химк|полиров|пленк|оклейк|баз|салон|одну|один)/i.test(norm)) {
      return true;
    }

    // 2. «только / просто» + сумма («только за 18к», «только 18000», «только базу»)
    if (/(?:^|\s)(?:толь[кеоае]{1,2}|толк|тока|ток|прост[оа]?|чист[оа]?|лишь)\s+(?:за\s+)?(?:\d+\s*(?:к|тыс|руб|р)?|баз)/i.test(norm)) {
      return true;
    }

    // 3. «давайте / давате / хочу / можно / сделайте / оставьте» + «только / просто» с опечатками
    if (/(?:давайте|давате|давай|хочу|можно|мне|нам|сделайте|оставьте|будем)\s+(?:толь[кеоае]{1,2}|толк|тока|ток|прост[оа]?|чист[оа]?|лишь)(?:\s|$)/i.test(norm)) {
      return true;
    }

    // 4. Любое «без ...»
    if (norm.includes("без ")) {
      if (/без\s+(?:защитн[а-я]*\s+)?(?:этого|нее|него|них|доп|пропит|припит|припт|керам|нано|озон|лишн|навяз|второг|покрыт|опци|услуг|плюшек)/i.test(norm)) {
        return true;
      }
      if (/(?:давайте|давате|давай|можно|хочу|лучше|только|будем|мне|нам)\s+без(?:\s|$)/i.test(norm) || norm.startsWith("без ")) {
        return true;
      }
    }

    // 5. Прямые указания убрать доп / отказ от допа
    if (/доп[а-я]*\s+(?:не\s+(?:нужн|надо)|не\s+хочу)/i.test(norm) || /не\s+(?:нужн|надо)\s+доп/i.test(norm)) {
      return true;
    }
    if (/дополнительн[а-я]*\s+(?:не\s+(?:нужн|надо)|ничего)/i.test(norm)) {
      return true;
    }
    if (/не\s+надо\s+(?:никак[а-я]*\s+)?(?:керамик|нано|пропит|припит|доп|лишн|этого|ее|его)/i.test(norm)) {
      return true;
    }
    if (/уберите\s+(?:керамик|нано|пропит|припит|доп|лишн|это|ее|его)/i.test(norm)) {
      return true;
    }

    // 6. «[услуга] и все», «[услуга] без всего», «больше ничего»
    if (/(?:хим\s*чист|чистк|полиров|оклейк|пленк)[а-я]*\s+(?:и\s+все|больше\s+ничего|без\s+всего)/i.test(norm)) {
      return true;
    }

    // 7. «одну услугу», «только базу», «без допов»
    if (norm.includes("одну услуг") || norm.includes("один комплекс") || norm.includes("только баз") || norm.includes("без доп")) {
      return true;
    }

    return false;
  }

  function isBookingRequest(text) {
    if (!text) return false;
    const low = text.toLowerCase();
    // Если клиент просит убрать доп или только одну услугу — это НЕ запрос на запись!
    if (isUpsellExclusionQuery(low)) {
      return false;
    }
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

  function parseDateIntent(text) {
    const norm = normalizeCarText(text || '');
    let hasDate = false;
    let display = null;
    let time = null;

    if (norm.includes('завтра')) {
      hasDate = true;
      display = 'завтра';
    } else if (norm.includes('послезавтра')) {
      hasDate = true;
      display = 'послезавтра';
    } else if (norm.includes('сегодня')) {
      hasDate = true;
      display = 'сегодня';
    } else if (norm.includes('суббот')) {
      hasDate = true;
      display = 'эту субботу';
    } else if (norm.includes('воскресень')) {
      hasDate = true;
      display = 'это воскресенье';
    } else if (norm.includes('пятниц')) {
      hasDate = true;
      display = 'эту пятницу';
    } else if (norm.includes('четверг')) {
      hasDate = true;
      display = 'этот четверг';
    } else if (norm.includes('сред')) {
      hasDate = true;
      display = 'эту среду';
    } else if (norm.includes('вторник')) {
      hasDate = true;
      display = 'этот вторник';
    } else if (norm.includes('понедельник')) {
      hasDate = true;
      display = 'этот понедельник';
    } else if (norm.includes('выходн')) {
      hasDate = true;
      display = 'эти выходные';
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
    const norm = normalizeCarText(text || '');
    if (/хим\s*чист|химчист|химчиск|чистк|почист|салон|сиден|озонир|химк[аеуоы]/i.test(norm)) {
      return { category: 'clean', name: 'Полная химчистка салона' };
    }
    if (/ppf|ппф|пленк|плёнк|оклейк|оклеить|брон|заклеит|затянут|закатат|зоны риска/i.test(norm)) {
      return { category: 'ppf', name: 'Оклейка зон риска пленкой PPF' };
    }
    if (/полиров|палиров|глянец|блеск|паутинк|царапин/i.test(norm)) {
      return { category: 'polishing', name: 'Комплексная восстановительная полировка кузова' };
    }
    if (norm.includes('керамик') || norm.includes('9h') || norm.includes('жидкое стекло')) {
      return { category: 'ceramic', name: 'Нанокерамика 9H (2 слоя)' };
    }
    if (norm.includes('шумк') || norm.includes('шумоизоляц')) {
      return { category: 'noise', name: 'Премиальная шумоизоляция' };
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

    // 1. Отечественные авто (ВАЗ / Лада / УАЗ / Жигули)
    if (hasRx('жигул[иейяь]?|жигуле|жигуль|ваз|таз|девятк[аеуоы]|четырк[аеуоы]|сем[ее]рк[аеуоы]|приор[аеуоы]|priora|грант[аеуоы]|granta|вест[аеуоы]|vesta|лада|lada')) {
      if (hasRx('нив[аеуоы]|niva')) {
        return { carModel: 'Lada Niva', carClass: 'Внедорожник', brand: 'Lada', isDomestic: true, rawMention: null };
      }
      return { carModel: 'Lada / Жигули', carClass: 'Седан', brand: 'Lada', isDomestic: true, rawMention: null };
    }
    if (hasRx('уаз|патриот[аеуом]?|patriot|хантер[аеуом]?')) {
      return { carModel: 'УАЗ Патриот', carClass: 'Внедорожник', brand: 'UAZ', isDomestic: true, rawMention: null };
    }

    // 2. Toyota / Lexus (Прадо / Прадик / Крузак / Двухсотка / Трехсотка / LC 200 / LC 300 / 200 / 300)
    const hasPradoWord = hasRx('прад(?:ик[аеуом]?|[оеауы]|ом)?|prado');
    const hasCruiserWord = hasRx('крузак[аеуом]?|крузер[аеуом]?|двухсотк[аеуоы]?|трехсотк[аеуоы]?|land\\s*cruiser|тлк|lc\\s*(?:200|300)?|лс\\s*(?:200|300)?');
    const has200or300 = hasRx('(?:200|300|150|120|100)(?:\\s*(?:ка|ку|ке))?');

    if (hasPradoWord || (hasCruiserWord && hasRx('прад')) || (has200or300 && hasRx('прад(?:ик[аеуом]?|[оеауы]|ом)?'))) {
      const model = 'Toyota Land Cruiser Prado';
      return { carModel: model, carClass: 'Внедорожник', brand: 'Toyota', isDomestic: false, rawMention: null };
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
    if (hasRx('es|ес|is|ис|ls|лс')) {
      if (hasRx('лех|лексус|lexus|тойот')) {
        return { carModel: 'Lexus ES/LS', carClass: 'Бизнес-седан', brand: 'Lexus', isDomestic: false, rawMention: null };
      }
    }
    if (hasRx('лех[аеуоы]|лехус[аеуом]?|лексус[аеуом]?|lexus')) {
      return { carModel: 'Lexus', carClass: 'Внедорожник', brand: 'Lexus', isDomestic: false, rawMention: null };
    }
    if (hasRx('тойот[аеуоы]|toyota')) {
      return { carModel: 'Toyota', carClass: 'Кроссовер', brand: 'Toyota', isDomestic: false, rawMention: null };
    }

    // 3. Mercedes-Benz
    if (hasRx('гелик[аеуом]?|гелендваген[аеуом]?|g\\s*class|г\\s*класс|g\\s*63|g\\s*500|g63|g500')) {
      return { carModel: 'Mercedes G-Class (Гелик)', carClass: 'Внедорожник', brand: 'Mercedes', isDomestic: false, rawMention: null };
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

    // 4. BMW
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

    // 5. Audi
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

    // 6. Porsche
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

    // 7. Tank (300, 400, 500, 700)
    if (hasRx('танк[аеуом]?|tank')) {
      let model = 'Tank 300';
      if (hasRx('500|пятьсот')) model = 'Tank 500';
      else if (hasRx('400|четыреста')) model = 'Tank 400';
      else if (hasRx('700|семьсот')) model = 'Tank 700';
      return { carModel: model, carClass: 'Внедорожник', brand: 'Tank', isDomestic: false, rawMention: null };
    }

    // 8. LiXiang / Li Auto (L6, L7, L8, L9)
    if (hasRx('лисян[аеуом]?|ли\\s*сян|li\\s*auto|lixiang|ли\\s*[6789]|li\\s*[6789]|l[6789]|л[6789]')) {
      let model = 'Li Auto L9';
      if (hasRx('8|л8|l8')) model = 'Li Auto L8';
      else if (hasRx('7|л7|l7')) model = 'Li Auto L7';
      else if (hasRx('6|л6|l6')) model = 'Li Auto L6';
      return { carModel: model, carClass: 'Внедорожник', brand: 'LiXiang', isDomestic: false, rawMention: null };
    }

    // 9. Zeekr (001, 009, 7X, X, 007)
    if (hasRx('зикр[аеуом]?|zeekr')) {
      if (hasRx('009')) return { carModel: 'Zeekr 009', carClass: 'Микроавтобус', brand: 'Zeekr', isDomestic: false, rawMention: null };
      if (hasRx('7x|7х|x|х|икс')) return { carModel: 'Zeekr X/7X', carClass: 'Кроссовер', brand: 'Zeekr', isDomestic: false, rawMention: null };
      return { carModel: 'Zeekr 001', carClass: 'Бизнес-седан / Лифтбек', brand: 'Zeekr', isDomestic: false, rawMention: null };
    }

    // 10. Geely (Monjaro, Tugella, Atlas, Coolray, Preface, Emgrand)
    if (hasRx('монжар[оеауы]?|монж[аеуом]?|monjaro')) {
      return { carModel: 'Geely Monjaro', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    }
    if (hasRx('тугелл?[аеуоы]?|tugella')) {
      return { carModel: 'Geely Tugella', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    }
    if (hasRx('атлас[аеуом]?|atlas|кулрей[аеуом]?|coolray|окаванго|okavango')) {
      return { carModel: 'Geely Atlas / Coolray', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    }
    if (hasRx('префейс[аеуом]?|preface|эмгранд[аеуом]?|emgrand')) {
      return { carModel: 'Geely Preface / Emgrand', carClass: 'Седан', brand: 'Geely', isDomestic: false, rawMention: null };
    }
    if (hasRx('джили|geely')) {
      return { carModel: 'Geely', carClass: 'Кроссовер', brand: 'Geely', isDomestic: false, rawMention: null };
    }

    // 11. Haval (Dargo, H9, Jolion, F7, M6)
    if (hasRx('дарг[оеауы]?|dargo|h\\s*9|н\\s*9')) {
      return { carModel: 'Haval Dargo / H9', carClass: 'Внедорожник', brand: 'Haval', isDomestic: false, rawMention: null };
    }
    if (hasRx('джолион[аеуом]?|jolion|f\\s*7|ф\\s*7|m\\s*6|м\\s*6')) {
      return { carModel: 'Haval Jolion / F7', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false, rawMention: null };
    }
    if (hasRx('хавал[аеуом]?|хавейл[аеуом]?|haval')) {
      return { carModel: 'Haval', carClass: 'Кроссовер', brand: 'Haval', isDomestic: false, rawMention: null };
    }

    // 12. Chery / Exeed / Jetour / Omoda / Jaecoo / Changan / Voyah
    if (hasRx('тигг[оеауы]?|tiggo|аризз[оеауы]|arrizo|черей|chery')) {
      if (hasRx('аризз|arrizo')) return { carModel: 'Chery Arrizo', carClass: 'Седан', brand: 'Chery', isDomestic: false, rawMention: null };
      return { carModel: 'Chery Tiggo', carClass: 'Кроссовер', brand: 'Chery', isDomestic: false, rawMention: null };
    }
    if (hasRx('эксид[аеуом]?|exeed')) {
      if (hasRx('vx|вх')) return { carModel: 'Exeed VX', carClass: 'Внедорожник', brand: 'Exeed', isDomestic: false, rawMention: null };
      return { carModel: 'Exeed TXL/RX', carClass: 'Кроссовер', brand: 'Exeed', isDomestic: false, rawMention: null };
    }
    if (hasRx('джетур[аеуом]?|jetour|т\\s*2|t\\s*2|дашинг|dashing')) {
      return { carModel: 'Jetour T2 / Dashing', carClass: 'Внедорожник', brand: 'Jetour', isDomestic: false, rawMention: null };
    }
    if (hasRx('омод[аеуоы]|omoda|с\\s*5|c\\s*5|s\\s*5|с5|c5|s5|джейк[уо]|jaecoo|j\\s*7|j7')) {
      return { carModel: 'Omoda C5 / Jaecoo J7', carClass: 'Кроссовер', brand: 'Omoda', isDomestic: false, rawMention: null };
    }
    if (hasRx('чанган[аеуом]?|changan|юни|uni|cs\\s*55|cs\\s*75')) {
      return { carModel: 'Changan UNI / CS', carClass: 'Кроссовер', brand: 'Changan', isDomestic: false, rawMention: null };
    }
    if (hasRx('воях[аеуом]?|вой[яеи]|voyah')) {
      if (hasRx('дрим|dream')) return { carModel: 'Voyah Dream', carClass: 'Микроавтобус', brand: 'Voyah', isDomestic: false, rawMention: null };
      return { carModel: 'Voyah Free', carClass: 'Кроссовер', brand: 'Voyah', isDomestic: false, rawMention: null };
    }

    // 13. VW / Skoda
    if (hasRx('туарег[аеуом]?|touareg|терамонт[аеуом]?|teramont')) {
      return { carModel: 'VW Touareg', carClass: 'Внедорожник', brand: 'VW', isDomestic: false, rawMention: null };
    }
    if (hasRx('тиг[аеуоы]|тигуан[аеуом]?|tiguan|кодиак[аеуом]?|kodiaq|карок[аеуом]?|karoq|таос|taos')) {
      return { carModel: 'VW Tiguan / Skoda Kodiaq', carClass: 'Кроссовер', brand: 'VW', isDomestic: false, rawMention: null };
    }
    if (hasRx('октах[аеуоы]?|октави[яиею]|octavia|суперб[аеуом]?|superb|рапид[аеуом]?|rapid|поло|polo|пассат[аеуом]?|passat|джетт[аеуоы]|jetta|гольф|golf')) {
      return { carModel: 'Skoda / VW', carClass: 'Седан', brand: 'VW', isDomestic: false, rawMention: null };
    }
    if (hasRx('мультивен|multivan|каравелл[аеуоы]|caravelle')) {
      return { carModel: 'VW Multivan', carClass: 'Микроавтобус', brand: 'VW', isDomestic: false, rawMention: null };
    }

    // 14. Kia / Hyundai
    if (hasRx('сорент[оеауы]|sorento|мохав[еауы]?|mohave|палисад[аеуом]?|palisade|санта\\s*фе|santa\\s*fe')) {
      return { carModel: 'Kia Sorento / Hyundai Palisade', carClass: 'Внедорожник', brand: 'Kia', isDomestic: false, rawMention: null };
    }
    if (hasRx('спортейдж[аеуом]?|спортидж[аеуом]?|sportage|туссан[аеуом]?|тусон|tucson|крет[аеуоы]|creta|селтос[аеуом]?|seltos')) {
      return { carModel: 'Kia Sportage / Hyundai Tucson', carClass: 'Кроссовер', brand: 'Kia', isDomestic: false, rawMention: null };
    }
    if (hasRx('карнивал[аеуом]?|carnival|стари[яиею]|staria')) {
      return { carModel: 'Kia Carnival / Hyundai Staria', carClass: 'Микроавтобус', brand: 'Kia', isDomestic: false, rawMention: null };
    }
    if (hasRx('солярис[аеуом]?|соляр[аеуоы]?|solaris|рио|rio|к\\s*5|k\\s*5|к5|k5|оптим[аеуоы]|optima|сонат[аеуоы]|sonata|церато|cerato|элантр[аеуоы]|elantra|круз[аеуом]?|cruze|генезис|genesis')) {
      return { carModel: 'Kia / Hyundai / Chevrolet', carClass: 'Седан', brand: 'Kia', isDomestic: false, rawMention: null };
    }

    // 15. Общие родовые термины кузова
    if (hasRx('внедорожник[аеуом]?|джип[аеуом]?|рамник[аеуом]?|пикап[аеуом]?')) {
      return { carModel: 'Внедорожник', carClass: 'Внедорожник', brand: null, isDomestic: false, rawMention: null };
    }
    if (hasRx('кроссовер[аеуом]?|паркетник[аеуом]?')) {
      return { carModel: 'Кроссовер', carClass: 'Кроссовер', brand: null, isDomestic: false, rawMention: null };
    }
    if (hasRx('микроавтобус[аеуом]?|минивэн[аеуом]?|минивен[аеуом]?|бус[аеуом]?')) {
      return { carModel: 'Микроавтобус', carClass: 'Микроавтобус', brand: null, isDomestic: false, rawMention: null };
    }
    if (hasRx('седан[аеуом]?|хэтчбек[аеуом]?|универсал[аеуом]?|купе|лифтбек[аеуом]?')) {
      return { carModel: 'Седан', carClass: 'Седан', brand: null, isDomestic: false, rawMention: null };
    }

    // 16. Извлечение незнакомой модели («на [X]», «у меня [X]»)
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

  function parseMessageEntities(text, activeOrderState) {
    const norm = normalizeCarText(text || '');
    const detectedCar = detectCar(text);
    const service = parseServiceIntent(text);
    const dateIntent = parseDateIntent(text);
    const bookingIntent = parseBookingIntent(text);
    const contactInfo = extractContactInfo(text);

    return {
      norm: norm,
      car: detectedCar,
      service: service,
      dateIntent: dateIntent,
      bookingIntent: bookingIntent,
      contactInfo: contactInfo
    };
  }

  // Алиас для обратной совместимости
  const detectCarDetails = detectCar;

  function getCarExpertDetail(carModel, carClass, brand) {
    const low = (carModel || '').toLowerCase();
    const cClass = carClass || '';

    if (low.includes('prado') || low.includes('прадо') || low.includes('прадик') || low.includes('land cruiser') || low.includes('крузак')) {
      return 'На Прадо и Крузаках салон просторный, с хорошей плотной кожей — после правильной чистки вернем заводскую матовость и свежесть.';
    }
    if (low.includes('tank') || low.includes('танк')) {
      return 'Танк — отличный брутальный рамник! Лобовое у него вертикальное, поэтому на трассе часто ловит гравий, а в салоне главное — аккуратно вычистить фактурный пластик и сиденья.';
    }
    if (low.includes('audi q8') || low.includes('ку8')) {
      return 'Q8 — шикарный кузов с мускулистым рельефом и глянцем Shadow Line. После правильного детейлинга машина выглядит как с витрины!';
    }
    if (low.includes('bmw x5') || low.includes('х5') || low.includes('x6') || low.includes('x7')) {
      return 'Иксы — классика премиума! Рельефные формы и богатый салон — уделим максимум внимания коже и всем скрытым полостям.';
    }
    if (low.includes('гелик') || low.includes('g-class') || low.includes('г-класс')) {
      return 'Гелик — культовый аппарат! Салон массивный и фактурный, вычистим каждую строчку кожи и все труднодоступные места.';
    }
    if (low.includes('gle') || low.includes('gls')) {
      return 'На GLE/GLS премиальная деликатная отделка — бережно обработаем немецкими составами Koch Chemie, чтобы салон пах новым авто.';
    }
    if (brand === 'LiXiang' || low.includes('li auto') || low.includes('лисян')) {
      return 'На Лисяне роскошный светлый салон и мягкий заводской лак — бережно очистим кожу и защитим от затирания джинсами.';
    }
    if (brand === 'Zeekr' || low.includes('zeekr') || low.includes('зикр')) {
      return 'Зикр — очень стильный и технологичный. Бережно вычистим весь салон и глянцевые панели без малейших разводов.';
    }
    if (brand === 'Geely' || low.includes('monjaro') || low.includes('монжаро') || low.includes('тугелла')) {
      return 'На Монжаро отличный комбинированный салон с замшей и кожей — деликатно вычистим все материалы без переувлажнения.';
    }
    if (brand === 'Haval' || low.includes('dargo') || low.includes('дарго') || low.includes('f7')) {
      return 'Отличная семейная машина! Тщательно вычистим сиденья, ковролин и багажник, чтобы в салоне было максимально свежо.';
    }
    if (low.includes('мерс') || low.includes('mercedes') || brand === 'Mercedes') {
      return 'У Mercedes благородные материалы отделки — бережно вычистим премиальную кожу и алькантару немецкими составами Koch Chemie.';
    }
    if (low.includes('бмв') || low.includes('bmw') || brand === 'BMW') {
      return 'Салон BMW с рельефной отделкой — уделим максимум внимания фактурной коже и всем элементам интерьера.';
    }
    if (low.includes('ауди') || low.includes('audi') || brand === 'Audi') {
      return 'В салоне Audi премиальная эргономика — вернем коже матовость и чистоту, деликатно очистим все стыки.';
    }
    if (low.includes('порш') || low.includes('porsche') || brand === 'Porsche') {
      return 'У Порше эталонный интерьер — деликатно обработаем кожу и алькантару, сохранив заводскую матовую текстуру без жирного блеска.';
    }
    if (low.includes('lexus') || low.includes('лексус') || brand === 'Lexus') {
      return 'На Лексусе очень мягкая и приятная кожа — обработаем бережными защитными бальзамами, вернем мягкость и свежесть.';
    }
    if (cClass === 'Внедорожник') {
      return 'Для большого внедорожника с просторным салоном комплексный уход вернет ощущение нового автомобиля из салона.';
    }
    if (cClass === 'Кроссовер') {
      return 'Отличный городской кроссовер — тщательно обновим интерьер, чтобы в салоне было приятно и комфортно каждый день.';
    }
    if (cClass.includes('Седан')) {
      return 'Для седана сделаем идеальный лоск — сиденья и пластик будут чистыми, свежими и приятными на ощупь.';
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
    const parsedSvc = parseServiceIntent(userText);
    const hasService = !!parsedSvc.category || /ppf|ппф|пленк|оклейк|полиров|керамик|хим\s*чист|химчист|чистк|почист|салон/i.test(norm);
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

    const svcIntent = parseServiceIntent(userText);
    const hasPPFInText = svcIntent.category === 'ppf' || /ppf|ппф|пленк|плёнк|оклейк|оклеить|заклеит|затянут|закатат|брон/i.test(norm);
    const hasCleanInText = svcIntent.category === 'clean' || /хим\s*чист|химчист|химчиск|чистк|почист|салон|сиден|кожа|пропитк|озонир|химк/i.test(norm);
    const hasPolishingInText = svcIntent.category === 'polishing' || /полиров|палиров|глянец|блеск|паутинк|царапин/i.test(norm);

    let isPPF = false;
    let isClean = false;
    let isPolishing = false;

    if (hasCleanInText) {
      isClean = true;
    } else if (hasPPFInText) {
      isPPF = true;
    } else if (hasPolishingInText) {
      isPolishing = true;
    } else if (baseState && (baseState.serviceCategory || baseState.serviceName)) {
      if (baseState.serviceCategory === 'clean' || (baseState.serviceName && baseState.serviceName.includes('химчист'))) {
        isClean = true;
      } else if (baseState.serviceCategory === 'ppf' || (baseState.serviceName && (baseState.serviceName.includes('PPF') || baseState.serviceName.includes('пленк')))) {
        isPPF = true;
      } else {
        isPolishing = true;
      }
    } else {
      isPolishing = true;
    }

    const dateIntent = parseDateIntent(userText);
    let curSlot = (baseState && baseState.slot && baseState.slot !== 'суббота 14:00') ? baseState.slot : 'на ваш выбор (по согласованию)';
    if (dateIntent && dateIntent.hasDate) {
      curSlot = dateIntent.display + (dateIntent.time ? (' в ' + dateIntent.time) : ' (время на ваш выбор)');
    }

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

            const isExcl = isUpsellExclusionQuery(userText) || !!activeOrderState.upsellExcluded;
            const bp = (parsed.basePrice !== undefined && parsed.basePrice !== null) ? Number(parsed.basePrice) : (autoCalc ? autoCalc.basePrice : 18000);
            const up = isExcl ? 0 : ((parsed.upsellPrice !== undefined && parsed.upsellPrice !== null) ? Number(parsed.upsellPrice) : (autoCalc ? autoCalc.upsellPrice : 25000));

            const res = {
              isEstimate: true,
              carModel: chosenModel || 'Автомобиль',
              carClass: chosenClass,
              serviceCategory: autoCalc ? autoCalc.serviceCategory : 'polishing',
              serviceName: parsed.serviceName || (autoCalc ? autoCalc.serviceName : 'Комплексная восстановительная полировка кузова'),
              basePrice: bp,
              upsellName: isExcl ? 'Без дополнительных опций' : (parsed.upsellName || (autoCalc ? autoCalc.upsellName : 'Нанокерамика 9H (2 слоя)')),
              upsellPrice: up,
              totalPrice: isExcl ? bp : ((parsed.totalPrice !== undefined && parsed.totalPrice !== null) ? Number(parsed.totalPrice) : (bp + up)),
              slot: parsed.slot || activeOrderState.slot || 'по согласованию (на ваш выбор)',
              upsellExcluded: isExcl
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

  function getFollowUpTimingQuestion(state, entities) {
    const hasCurrentDate = entities && entities.dateIntent && entities.dateIntent.hasDate;
    const currentDay = hasCurrentDate ? entities.dateIntent.display : null;
    const currentTime = hasCurrentDate && entities.dateIntent.time ? entities.dateIntent.time : null;

    const prevSlot = (state && state.slot && state.slot !== 'на ваш выбор (по согласованию)' && state.slot !== 'суббота 14:00' && state.slot !== 'по согласованию (на ваш выбор)') ? state.slot : null;

    if (currentDay && currentTime) {
      return `На ${currentDay} в ${currentTime} бокс зарезервирован! Оставьте ваш контакт (номер телефона или Telegram), чтобы старший мастер закрепил бронь за вами 🤝`;
    }
    if (currentDay) {
      return `По времени на ${currentDay}: к скольки вам удобнее подъехать — до обеда (например, к 11:30) или во второй половине дня (14:00 / 16:30)? И подскажите контакт (телефон или Telegram), чтобы закрепить бокс.`;
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
        return `По времени ${dayMention}: к скольки вам удобнее заехать — в первой половине дня или ближе к вечеру? И оставьте контакт (телефон или ник в Telegram), чтобы мастер зафиксировал за вами бокс.`;
      }
    }
    return `В какой день вам было бы удобнее приехать: в будни или на выходных? Подберу для вас самое удобное свободное окно!`;
  }

  function getSmartFallback(text, contactInfo) {
    const norm = normalizeCarText(text || "");
    const low = norm;
    const entities = parseMessageEntities(text, activeOrderState);

    // 0. Вопросы о руководителе, директоре или партнерстве
    if (isLeadershipOrB2bQuery(text)) {
      return {
        text: "По вопросам сотрудничества, корпоративного обслуживания или связи с руководством студии, пожалуйста, оставьте ваш номер телефона или контакт в Telegram — управляющий свяжется с вами в ближайшее время."
      };
    }

    // 1. Проверка на непрофильные отечественные автомобили (ВАЗ / Лада / Жигули / УАЗ)
    if (entities.car && entities.car.isDomestic) {
      return {
        text: `Здравствуйте! К сожалению, мы специализируемся исключительно на современных иномарках бизнес- и премиум-сегмента (BMW, Mercedes, Audi, Porsche, LiXiang, Tank, Zeekr, Geely и др.), поэтому автомобили ${entities.car.carModel || "отечественного автопрома"} в работу не берем. Спасибо за понимание и удачи на дорогах! 🤝`
      };
    }

    // 2. ОТКАЗ КЛИЕНТА ОТ ДИАЛОГА («спасибо, не надо», «я передумал», «нет, пока не нужно»)
    if (norm.includes("не надо") || norm.includes("не нужн") || norm.includes("передумал") || norm.includes("отмена") || norm.includes("отбой") || (norm.includes("нет") && norm.includes("спасибо"))) {
      return {
        text: "Понял вас, без проблем! Будут вопросы по уходу или защите автомобиля — пишите в любое время. Всегда рады видеть в студии! 🤝"
      };
    }

    // 3. ЕСЛИ КЛИЕНТ ОСТАВИЛ КОНТАКТ (ТЕЛЕФОН, ТЕЛЕГРАМ, ВК)
    const effContact = contactInfo || entities.contactInfo;
    if (effContact) {
      const timePref = extractTimePreference(text) || (entities.dateIntent.hasDate ? (entities.dateIntent.display + (entities.dateIntent.time ? (" в " + entities.dateIntent.time) : "")) : null);
      if (timePref) activeOrderState.slot = timePref;

      const car = activeOrderState.carModel || "ваш автомобиль";
      const slot = activeOrderState.slot || "в удобное для вас время";
      const slotPrep = (slot.startsWith("на ") || slot.startsWith("в ") || slot.startsWith("к ")) ? slot : `на ${slot}`;

      let receiptSummary = "";
      if (activeOrderState.carModel && activeOrderState.serviceName && activeOrderState.basePrice) {
        receiptSummary = ` на комплекс: ${activeOrderState.serviceName} (${activeOrderState.totalPrice.toLocaleString("ru-RU")} ₽)`;
      }

      return {
        text: `Супер, контакт записал! 👍\n\nЗабронировал для вашего ${car} бокс ${slotPrep}${receiptSummary}.\n\nЯ уже передал заявку старшему мастеру смены. Он наберет вам (или напишет в ${effContact.display}), чтобы подтвердить время заезда и ответить на любые технические вопросы. До встречи в студии! 🤝`
      };
    }

    // 4. ИСКЛЮЧЕНИЕ ДОПРОДАЖИ: «Можно без керамики», «давайте без допов», «только химчистка», «без защитной пропитки»
    if (isUpsellExclusionQuery(norm)) {
      const car = (entities.car && entities.car.carModel) || activeOrderState.carModel || "автомобиля";
      const cClass = (entities.car && entities.car.carClass) || activeOrderState.carClass || "Внедорожник";
      let sName = activeOrderState.serviceName || "Комплексная восстановительная полировка кузова";
      let bPrice = 18000;
      let uName = "Без дополнительных опций";
      let replyServiceWord = "базовый комплекс";

      const isClean = (entities.service && entities.service.category === "clean") || /хим\s*чист|чистк|салон/i.test(norm) || (activeOrderState.serviceName && activeOrderState.serviceName.includes("химчист"));
      const isPPF = (entities.service && entities.service.category === "ppf") || /ppf|пленк|оклейк|брон/i.test(norm) || (activeOrderState.serviceName && activeOrderState.serviceName.includes("PPF"));

      if (isClean) {
        sName = "Полная химчистка салона";
        bPrice = (cClass === "Седан" || cClass === "Бизнес-седан" || cClass === "Бизнес-седан / Лифтбек") ? 15000 : 18000;
        uName = "Без защитной пропитки (только базовая химчистка)";
        replyServiceWord = "полную химчистку салона";
      } else if (isPPF) {
        sName = "Оклейка зон риска пленкой PPF";
        bPrice = (cClass === "Седан" || cClass === "Бизнес-седан" || cClass === "Бизнес-седан / Лифтбек") ? 65000 : 75000;
        uName = "Без нанокерамики (только базовый комплекс PPF)";
        replyServiceWord = "оклейку зон риска пленкой PPF";
      } else {
        sName = "Комплексная восстановительная полировка кузова";
        bPrice = (cClass === "Внедорожник") ? 26000 : ((cClass === "Кроссовер") ? 22000 : 18000);
        uName = "Без нанокерамики (только восстановительная полировка)";
        replyServiceWord = "восстановительную полировку кузова";
      }

      const est = {
        isEstimate: true,
        carModel: car,
        carClass: cClass,
        serviceCategory: isClean ? "clean" : (isPPF ? "ppf" : "polishing"),
        serviceName: sName,
        basePrice: bPrice,
        upsellName: uName,
        upsellPrice: 0,
        totalPrice: bPrice,
        slot: activeOrderState.slot || "по согласованию (на ваш выбор)",
        upsellExcluded: true
      };
      activeOrderState = Object.assign({}, activeOrderState, est);

      const hasKnownCar = !!((entities.car && entities.car.carModel) || activeOrderState.carModel);
      if (!hasKnownCar) {
        const sedPrice = isClean ? "15 000 ₽" : (isPPF ? "65 000 ₽" : "18 000 ₽");
        const suvPrice = isClean ? "18 000 ₽" : (isPPF ? "75 000 ₽" : "22 000 ₽");
        return {
          text: `Без проблем, договорились! Сделаем только ${replyServiceWord} без лишних допов 👍\n\nПо базовой стоимости:\n• Седаны и купе — ${sedPrice}\n• Кроссоверы и внедорожники — ${suvPrice}\n\nПодарочный антидождь на переднюю полусферу по акции обязательно сделаем бесплатно 🤝\n\nПодскажите, какая у вас марка и модель авто? Сразу назову точную цену под ваш кузов и подберу время!`,
          estimate: est,
          rawText: JSON.stringify(est)
        };
      }

      const timingQ = getFollowUpTimingQuestion(activeOrderState, entities);

      return {
        text: `Без проблем, договорились! Сделаем только ${replyServiceWord} для вашего ${car}, без лишних допов 👍\n\nПо сумме всё выйдет ровно ${bPrice.toLocaleString("ru-RU")} ₽. И подарочный антидождь на переднюю полусферу по акции обязательно нанесем бесплатно 🤝\n\n${timingQ}`,
        estimate: est,
        rawText: JSON.stringify(est)
      };
    }

    // 4.5. ВЫБОР ИЛИ УТОЧНЕНИЕ ВРЕМЕНИ ВИЗИТА («приеду в 2 часа», «в 14:00», «к двум», «давайте в 15»)
    const parsedTime = parseTimeEntity(text);
    if (parsedTime && !isEstimateRequest(text) && !entities.car.carModel) {
      let dayPrefix = (entities.dateIntent.hasDate && entities.dateIntent.display !== 'это время') ? entities.dateIntent.display : null;
      if (!dayPrefix && activeOrderState.slot) {
        const lowSlot = activeOrderState.slot.toLowerCase();
        if (lowSlot.includes("завтра")) dayPrefix = "на завтра";
        else if (lowSlot.includes("сегодня")) dayPrefix = "на сегодня";
        else if (lowSlot.includes("послезавтра")) dayPrefix = "на послезавтра";
        else if (lowSlot.includes("суббот")) dayPrefix = "на субботу";
        else if (lowSlot.includes("воскресень")) dayPrefix = "на воскресенье";
        else if (lowSlot.includes("понедельник")) dayPrefix = "на понедельник";
        else if (lowSlot.includes("вторник")) dayPrefix = "на вторник";
        else if (lowSlot.includes("сред")) dayPrefix = "на среду";
        else if (lowSlot.includes("четверг")) dayPrefix = "на четверг";
        else if (lowSlot.includes("пятниц")) dayPrefix = "на пятницу";
        else if (lowSlot.includes("выходн")) dayPrefix = "на выходные";
      }

      const fullSlot = dayPrefix ? `${dayPrefix} в ${parsedTime.formatted}` : `в ${parsedTime.formatted}`;
      activeOrderState.slot = fullSlot;

      const car = activeOrderState.carModel || "ваш автомобиль";

      return {
        text: `Договорились, зафиксировал время ${fullSlot}! 👍\n\nПодскажите, пожалуйста, ваше имя и номер телефона (или Telegram @никнейм), чтобы старший мастер закрепил бокс за вами и связался для подтверждения деталей!`
      };
    }

    // 5. РАСПОЗНАН АВТОМОБИЛЬ ИЛИ НЕЗНАКОМАЯ МОДЕЛЬ
    const detectedCar = entities.car;
    const isCarMentioned = !!(detectedCar.carModel || detectedCar.carClass);
    const hasActiveCar = !!(activeOrderState.carModel && activeOrderState.carClass);

    // 5.0. Незнакомая модель («на эклэир», «у меня [X]»)
    if (detectedCar.rawMention && !detectedCar.carClass && !hasActiveCar) {
      const rawCar = detectedCar.rawMention;
      let sName = "детейлинг-комплекс";
      if (entities.service.category === "clean" || norm.includes("химчист")) {
        sName = "полную химчистку салона";
      } else if (entities.service.category === "ppf" || norm.includes("пленк") || norm.includes("ppf")) {
        sName = "оклейку зон риска пленкой PPF";
      } else if (entities.service.category === "polishing" || norm.includes("полиров")) {
        sName = "восстановительную полировку кузова";
      }
      const datePart = entities.dateIntent.hasDate
        ? `На ${entities.dateIntent.display} у нас как раз есть свободные окна в боксе 👍`
        : "Свободные окна на этой неделе есть 👍";
      return {
        text: `Понял вас! На ${rawCar} с удовольствием сделаем ${sName}! ${datePart}\n\nПодскажите только, какой у вас тип кузова — седан или кроссовер/внедорожник, чтобы назвать точную сумму сметы и закрепить бокс?`
      };
    }

    // 5.1. Автомобиль распознан (или уже был сохранен ранее)
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
      const currentCarClass = activeOrderState.carClass || detectedCar.carClass || "Внедорожник";
      const expertNote = getCarExpertDetail(currentCarModel, currentCarClass, activeOrderState.brand || detectedCar.brand);

      // А. Названа услуга ИЛИ был запрос цены ИЛИ идет смена авто при активной услуге
      if (hasServiceInMsg || hasServiceActive || isPriceQuery) {
        const est = computeEstimateForCar(text, activeOrderState);
        if (est) {
          activeOrderState = Object.assign({}, activeOrderState, est);

          if (entities.dateIntent.hasDate) {
            const dateSlot = entities.dateIntent.display + (entities.dateIntent.time ? (" в " + entities.dateIntent.time) : " (время на ваш выбор)");
            est.slot = dateSlot;
            activeOrderState.slot = dateSlot;
          }

          const isClean = est.serviceCategory === "clean" || (est.serviceName || "").includes("химчист") || (est.serviceName || "").includes("салон");
          const isPPF = est.serviceCategory === "ppf" || (est.serviceName || "").includes("PPF") || (est.serviceName || "").includes("пленк");

          let serviceDesc = `Оклейка зон риска полиуретаном PPF (200 мкм) выйдет ${est.basePrice.toLocaleString("ru-RU")} ₽. В комплекс входит бронь капота, бампера, передних крыльев, фар, зеркал и стоек премиальной американской пленкой Stek/Llumar`;
          if (isClean) {
            serviceDesc = `Комплексная детейлинг-химчистка выйдет ровно ${est.basePrice.toLocaleString("ru-RU")} ₽. В работу входит полная глубокая чистка сидений (кожа/текстиль), пола, потолка, багажника, антибактериальное озонирование и деликатная сушка`;
          } else if (!isPPF) {
            serviceDesc = `Восстановительная полировка кузова выйдет ${est.basePrice.toLocaleString("ru-RU")} ₽. Удалим до 95% паутинки от моек и мелких царапин, вернем глубокий зеркальный глянец`;
          }

          let upsellDesc = "";
          if (est.upsellPrice > 0) {
            if (isClean) {
              upsellDesc = `\n\nКстати, по желанию можем сразу нанести защитную гидрофобную пропитку сидений (+${est.upsellPrice.toLocaleString("ru-RU")} ₽). Она создает невидимый барьер: если случайно прольете кофе или воду, жидкость не впитается, а просто соберется каплями на поверхности. Добавим или пока только базовую химчистку?`;
            } else if (isPPF) {
              upsellDesc = `\n\nКстати, к оклейке зон риска рекомендуем добавить нанокерамику 9H на остальной кузов (+${est.upsellPrice.toLocaleString("ru-RU")} ₽) — это защитит лак от реагентов и выровняет зеркальный глянец по всей машине.`;
            } else {
              upsellDesc = `\n\nКстати, к полировке рекомендую добавить нанокерамику 9H в 2 слоя (+${est.upsellPrice.toLocaleString("ru-RU")} ₽) — она создаст мощный гидрофобный щит от реагентов, солнца и агрессивных моек на 18 месяцев, закрепив зеркальный блеск.`;
            }
          } else {
            upsellDesc = `\n\nДелаем базовый комплекс без дополнительных опций 👍`;
          }

          const giftDesc = `\n\nАнтидождь на переднюю полусферу по акции обязательно сделаем вам в подарок (0 ₽) 🎁`;

          const timingQ = getFollowUpTimingQuestion(activeOrderState, entities);

          // Если клиент сразу написал день/время визита (например, «можно завтра будет заехать на прадик 200 химчистку сделать»)
          if (entities.dateIntent.hasDate) {
            const dateGreeting = `Отлично! На ${entities.dateIntent.display} у нас как раз есть свободные окна в боксе 👍\n\n`;
            return {
              text: `${dateGreeting}Для вашего ${est.carModel} (${est.carClass}): ${serviceDesc}.${upsellDesc}${giftDesc}\n\n${timingQ}`,
              estimate: est,
              rawText: JSON.stringify(est)
            };
          }

          // Если клиент сменил авто в процессе диалога
          const isSwitchWithActiveService = hasServiceActive && !hasServiceInMsg && isCarMentioned;
          let switchComment = "";
          if (isSwitchWithActiveService) {
            switchComment = `Принято, пересчитал смету на ${est.carModel} (${est.carClass})! 👍 ${expertNote ? expertNote + ' ' : ''}\n\n`;
          } else {
            switchComment = expertNote
              ? `Для вашего ${est.carModel} (${est.carClass}): ${expertNote}\n\n`
              : `Для вашего ${est.carModel} (${est.carClass}):\n\n`;
          }

          return {
            text: `${switchComment}${serviceDesc}.${upsellDesc}${giftDesc}\n\n${timingQ}`,
            estimate: est,
            rawText: JSON.stringify(est)
          };
        }
      }

      // Б. Пользователь назвал ТОЛЬКО автомобиль, услуга еще не была выбрана
      if (isCarMentioned) {
        const cModel = currentCarModel || "ваш автомобиль";
        const cClass = currentCarClass || "Внедорожник";

        const ppfPrice = (cClass === "Седан" || cClass === "Бизнес-седан" || cClass === "Бизнес-седан / Лифтбек") ? "65 000 ₽" : "75 000 ₽";
        const polPrice = (cClass === "Внедорожник") ? "26 000 ₽" : ((cClass === "Кроссовер") ? "22 000 ₽" : "18 000 ₽");
        const cleanPrice = (cClass === "Седан" || cClass === "Бизнес-седан" || cClass === "Бизнес-седан / Лифтбек") ? "15 000 ₽" : "18 000 ₽";

        const dateIntro = entities.dateIntent.hasDate ? `На ${entities.dateIntent.display} свободные боксы как раз есть!\n\n` : "";

        return {
          text: `Отличный автомобиль — ${cModel} (${cClass})! 👍 ${expertNote}\n\n${dateIntro}Сориентирую по стоимости основных комплексов для вашего кузова:\n1. 🛡 Бронирование зон риска пленкой PPF (200 мкм) — ${ppfPrice}\n2. ✨ Восстановительная полировка кузова — ${polPrice}\n3. 🧼 Комплексная химчистка салона — ${cleanPrice}\n\nПодарочный антидождь на переднюю полусферу по акции обязательно нанесем бонусом (0 ₽) 🎁\n\nКакая задача сейчас в приоритете: защитить кузов от сколов (PPF), вернуть зеркальный блеск (полировка) или обновить салон (химчистка)?`
        };
      }
    }

    // 6. ОБЩИЙ ВОПРОС ПО УСЛУГАМ («какие у вас услуги», «что делаете», «список услуг», «какой прайс»)
    const isServiceInquiry = (norm.includes("какие") && (norm.includes("услуг") || norm.includes("работ") || norm.includes("делает") || norm.includes("предлагает"))) ||
      norm.includes("список услуг") || norm.includes("весь прайс") || norm.includes("что вы делаете") || norm.includes("чем занимаетесь");

    if (isServiceInquiry) {
      return {
        text: `В нашем детейлинг-центре «${STUDIO_CONFIG.company_name}» выполняем полный цикл профессионального ухода:\n\n` +
          `1. 🛡 Бронирование зон риска пленкой PPF (200 мкм) — защита от гравия и сколов (от 65 000 ₽);\n` +
          `2. ✨ Восстановительная детейлинг-полировка — удаление паутинки и возврат заводского глянца (от 18 000 ₽);\n` +
          `3. 💎 Нанокерамика 9H (в 2–3 слоя) — мощный гидрофоб и зеркальный блеск на 18 месяцев;\n` +
          `4. 🧼 Комплексная химчистка салона — очистка кожи и текстиля с озонированием и защитной пропиткой (от 15 000 ₽);\n` +
          `5. 🌧 Антидождь на переднюю полусферу — 0 ₽ в подарок по акции 🎁\n\n` +
          `Подскажите, какая у вас машина? Сразу назову точную смету под ваш кузов и сориентирую по свободным боксам!`
      };
    }

    // 6.1. УТОЧНЯЮЩИЕ ВОПРОСЫ («только эти?», «а еще что?», «это все?»)
    if (norm.includes("только эти") || norm.includes("это все") || norm.includes("что еще") || norm.includes("а еще") || norm.includes("другие услуги")) {
      return {
        text: `Также мы выполняем шумоизоляцию премиум-материалами (Comfort Mat), полировку и бронирование оптики, локальную полировку царапин, удаление вмятин без покраски (PDR) и реставрацию кожи салона.\n\nКакая задача для вашего авто сейчас в приоритете? Напишите модель автомобиля — подберем лучшее решение!`
      };
    }

    // 6.2. КОРОТКИЕ ПОДТВЕРЖДЕНИЯ («ак», «ок», «хорошо», «понял», «ладно», «ясно», «договорились»)
    if (norm === "ак" || norm === "ок" || norm === "хорошо" || norm === "понял" || norm === "ясно" || norm === "ладно" || norm === "договорились" || norm === "угу") {
      if (activeOrderState.carModel) {
        return {
          text: `Договорились! По вашему ${activeOrderState.carModel} смету зафиксировал 👍 В какой день вам удобнее приехать в студию?`
        };
      }
      return {
        text: `Отлично! Напишите марку и модель вашего автомобиля — сразу рассчитаю точную смету под ваш кузов и подскажу свободное время для визита.`
      };
    }

    // 7. ХИМЧИСТКА САЛОНА (БЕЗ НАЗВАННОГО АВТО)
    if (norm.includes("химчист") || norm.includes("химчиск") || norm.includes("салон") || norm.includes("почистит") || norm.includes("сиден")) {
      return {
        text: "По стоимости комплексной химчистки салона:\n• Седаны и купе — 15 000 ₽\n• Кроссоверы и внедорожники — 18 000 ₽\n• Минивэны и микроавтобусы — 22 000 ₽\n\nВ работу входит всё под ключ: полная очистка сидений, ковролина, потолка, багажника, антибактериальное озонирование и деликатная сушка. Антидождь на переднюю полусферу — в подарок (0 ₽) 🎁\n\nПодскажите модель вашего авто — сразу рассчитаю точную смету!"
      };
    }

    // 8. ПОЛИРОВКА КУЗОВА (БЕЗ НАЗВАННОГО АВТО)
    if (norm.includes("полировк") || norm.includes("палировк") || norm.includes("царапин") || norm.includes("глянец")) {
      return {
        text: "По восстановительной детейлинг-полировке кузова:\n• Седаны и купе — 18 000 ₽ (+ керамика 9H 25 000 ₽)\n• Кроссоверы — 22 000 ₽ (+ керамика 9H 30 000 ₽)\n• Внедорожники — 26 000 ₽ (+ керамика 9H 30 000 ₽)\n\nУбираем до 95% мелких царапин и паутинки, возвращаем зеркальный заводской глянец. По акции антидождь на переднюю полусферу — в подарок (0 ₽) 🎁\n\nПодскажите модель авто — сориентирую точнее и подберу удобное время!"
      };
    }

    // 9. ОКЛЕЙКА ПЛЕНКОЙ PPF (БЕЗ НАЗВАННОГО АВТО)
    if (norm.includes("ppf") || norm.includes("ппф") || norm.includes("пленк") || norm.includes("плёнк") || norm.includes("оклейк") || norm.includes("оклеить") || norm.includes("заклеит") || norm.includes("затянут") || norm.includes("закатат") || norm.includes("брон")) {
      return {
        text: "По оклейке зон риска полиуретановой пленкой PPF (капот, бампер, передние крылья, фары, зеркала, стойки):\n• Седаны — 65 000 ₽\n• Кроссоверы и внедорожники — 75 000 ₽\n\nРаботаем только с премиальным американским полиуретаном 200 мкм (Stek, Llumar) с самозатягивающимся слоем Top Coat (гарантия 5–10 лет).\n\nКакая у вас модель автомобиля? Автомобиль новый из салона или с пробегом?"
      };
    }

    // 10. ВОПРОС О СРОКАХ И ВРЕМЕНИ ВЫПОЛНЕНИЯ
    if ((norm.includes("скольк") && norm.includes("времен")) || norm.includes("по времени") || norm.includes("сколько дней") || norm.includes("сколько часов") || norm.includes("когда готов") || norm.includes("когда забрать") || norm.includes("когда отдадите") || norm.includes("длится")) {
      const car = activeOrderState.carModel || "автомобиля";
      const isPPF = (activeOrderState.serviceName || "").includes("PPF") || (activeOrderState.serviceName || "").includes("пленк");
      const timing = isPPF
        ? `Оклейка зон риска для ${car} занимает 1–2 рабочих дня. Пленке требуется технологическая сушка в теплом боксе и фиксация подворотов.`
        : `Комплексная полировка и химчистка для ${car} занимает 1 рабочий день: утром привозите, на следующий день забираете в идеальном состоянии.`;

      return {
        text: `${timing}\n\nВ какой день вам было бы удобнее приехать: в будни или на выходных? Забронирую бокс под ваш график! 👍`
      };
    }

    // 11. ВОПРОС О ГАРАНТИИ
    if (norm.includes("гарант") || norm.includes("сертифик") || norm.includes("надежн")) {
      const car = activeOrderState.carModel || "автомобиль";
      return {
        text: `На все работы по ${car} предоставляется официальная гарантия:\n• На полиуретановую пленку — гарантия от производителя от 5 до 10 лет (не желтеет, не мутнеет, не трескается от мороза).\n• На монтаж и прилегание краев — гарантия студии 1 год.\n• На керамику 9H — гарантия гидрофобного эффекта до 18 месяцев.\n\nЧерез 10–14 дней после оклейки мы приглашаем вас на бесплатный контрольный осмотр мастера.`
      };
    }

    // 12. ВОПРОС О МАТЕРИАЛАХ И БРЕНДАХ ПЛЕНОК
    if (norm.includes("материал") || (norm.includes("пленк") && (norm.includes("как") || norm.includes("бренд") || norm.includes("фирм") || norm.includes("производ"))) || norm.includes("какой состав")) {
      return {
        text: "Мы работаем исключительно со 100% оптическим полиуретаном премиум-класса толщиной 195–215 микрон (бренды Stek, Llumar, SunTek).\n\nПленка имеет прочный верхний лаковый слой Top Coat — царапины от веток и песка самозатягиваются от тепла на солнце или горячей воды. Никакого дешевого винила или гибрида."
      };
    }

    // 13. ВОПРОС О ЗОНАХ РИСКА (ЧТО ВХОДИТ)
    if ((norm.includes("зон") && norm.includes("риск")) || norm.includes("что входит") || norm.includes("какие детали")) {
      const car = activeOrderState.carModel || "автомобиля";
      return {
        text: `В комплекс «Зоны риска» для ${car} входит оклейка самых уязвимых от гравия и сколов элементов:\n• Капот полностью;\n• Передний бампер целиком со всеми вставками;\n• Передние крылья полностью;\n• Корпуса боковых зеркал;\n• Оптика (фары и ПТФ);\n• Зоны под ручками дверей (от ногтей);\n• Полоса на крышу над лобовым стеклом;\n• Стойки лобового стекла.`
      };
    }

    // 14. ВОПРОС О СКИДКАХ И ЦЕНЕ
    if (norm.includes("скидк") || norm.includes("подешевл") || norm.includes("дорог") || norm.includes("торг") || norm.includes("уступ")) {
      const car = activeOrderState.carModel || "автомобиля";
      return {
        text: `В расчет для вашего ${car} уже включены максимальные бонусы по нашей акции:\n1. Антидождь передней полусферы в подарок — 0 ₽ (экономия 4 000 ₽);\n2. Бесплатный замер толщины ЛКП всего кузова высокоточным толщиномером;\n3. Детейлинг-мойка кузова перед началом работ.\n\nМы держим фиксированные честные цены с гарантией качества без скрытых наценок.`
      };
    }

    // 15. ВОПРОС ОБ ОПЛАТЕ И ПРЕДОПЛАТЕ
    if (norm.includes("оплат") || norm.includes("предоплат") || norm.includes("карт") || norm.includes("наличн") || norm.includes("сбп") || norm.includes("безнал")) {
      return {
        text: "Предоплата для бронирования не требуется! Оплата производится строго по факту завершения работ после вашего личного осмотра автомобиля.\n\nПринимаем любые удобные способы: наличные, банковская карта, СБП, а также безналичный расчет для юридических лиц."
      };
    }

    // 16. ПЕРЕНОС ДНЯ / ВРЕМЕНИ
    if (norm.includes("воскресень") || norm.includes("понедельник") || norm.includes("вторник") || norm.includes("сред") || norm.includes("четверг") || norm.includes("пятниц") || norm.includes("будн") || norm.includes("другой день") || norm.includes("другое время") || norm.includes("утром") || norm.includes("вечером")) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      return {
        text: `Без проблем, договорились! С удовольствием примем вас${timePref ? (" в " + timePref) : " в удобное время"} 👍\n\nПодскажите ваше имя и контакт (телефон или ник в Telegram), и мастер закрепит за вами бокс!`
      };
    }

    // 17. Запрос записи / свободные окна (БЕЗ авто и услуги)
    if (isBookingRequest(text) || norm.includes("записат") || norm.includes("заехать") || norm.includes("приехать") || norm.includes("окна") || norm.includes("свободно")) {
      const timePref = extractTimePreference(text);
      if (timePref) activeOrderState.slot = timePref;
      return {
        text: "С удовольствием подберем для вас удобное окно в студии! 👍\n\nПодскажите, какая у вас машина и какая услуга интересует (химчистка, полировка, оклейка пленкой PPF), чтобы я сразу рассчитал точную смету и забронировал бокс."
      };
    }

    // 18. Живая консультация мастера (БЕЗ роботизированных анкет)
    if (norm.includes("выбор") || norm.includes("помог") || norm.includes("посовету") || norm.includes("подскаж") || norm.includes("что лучше")) {
      if (activeOrderState.carModel) {
        const car = activeOrderState.carModel;
        const expertNote = getCarExpertDetail(car, activeOrderState.carClass, activeOrderState.brand);
        return {
          text: `С удовольствием помогу определиться с комплексом для вашего ${car}! 👍 ${expertNote}\n\nПодскажите, какая первоочередная задача: защитить кузов от сколов по трассе (пленка PPF), вернуть зеркальный блеск (полировка + керамика) или обновить салон?`
        };
      }
      return {
        text: "С удовольствием помогу подобрать оптимальный комплекс услуг! 👍\n\nПодскажите, какой у вас автомобиль и какую задачу в первую очередь хотелось бы решить: защитить кузов от гравия (пленка PPF), вернуть зеркальный блеск (полировка + керамика) или обновить салон?"
      };
    }

    // 19. Адрес и локация
    if (norm.includes("где") || norm.includes("адрес") || norm.includes("находит") || norm.includes("город") || norm.includes("как доехать")) {
      return {
        text: `Наш детейлинг-центр находится по адресу: ${STUDIO_CONFIG.city}. Работаем ежедневно по предварительной записи. Подсказать стоимость услуг или подобрать удобное время?`
      };
    }

    // 20. Короткие приветствия
    if (norm === "привет" || norm === "здравствуйте" || norm === "добрый день" || norm === "добрый вечер" || norm === "ку" || norm === "салют") {
      if (activeOrderState.carModel) {
        return {
          text: `Здравствуйте! Рад снова слышать 👋 По вашему ${activeOrderState.carModel} предварительную смету держим. В какой день вам удобнее приехать к нам в студию?`
        };
      }
      return {
        text: "Здравствуйте! 👋 Я на связи. Подскажите марку и модель авто — быстро сориентирую по стоимости, подберу лучший комплекс и забронирую бокс с подарком по акции!"
      };
    }

    // 21. ФОЛЛБЭК: Если автомобиль уже обсуждается в диалоге
    if (activeOrderState.carModel) {
      const car = activeOrderState.carModel;
      const cClass = activeOrderState.carClass || "Внедорожник";
      return {
        text: `По вашему ${car} (${cClass}) смету держим в памяти 👍\n\nПодскажите, на какой день вам удобнее спланировать заезд или хотите уточнить что-то по материалам и срокам?`
      };
    }

    // 22. ФОЛЛБЭК: Если диалог уже идет, но авто еще не названо
    return {
      text: "С удовольствием помогу с выбором и подробно проконсультирую! 👍\n\nНапишите, какая у вас марка и модель машины — сразу сориентирую по точной стоимости и свободным окнам для записи."
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

  function stripCodePieces(text) {
    if (!text) return '';
    let clean = String(text).replace(/```[a-z]*[\s\S]*?```/gi, '');
    clean = clean.replace(/```[a-z]*/gi, '');

    // Удаляем любые остатки JSON со сметой из видимого сообщения (включая многострочные)
    const jsonStartMatch = clean.match(/\{[\s\r\n]*"(?:isEstimate|carModel|serviceName|basePrice|totalPrice|carClass|slot)"/i);
    if (jsonStartMatch && typeof jsonStartMatch.index === 'number') {
      clean = clean.substring(0, jsonStartMatch.index);
    }

    // Удаляем [CONFIRM_LEAD:...] и другие системные теги
    clean = clean.replace(/\[(?:PENDING_BOOKING|CONFIRM_LEAD|CANCEL_LEAD|RESCHEDULE_LEAD):[^\]]*\]/gi, '');
    return clean.trim();
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

  let lastSyncedContactKey = null;
  let lastSyncedTime = 0;

  function syncLeadToExternalServices(leadData) {
    if (!leadData) return;
    const contactKey = `${leadData.phone || leadData.tg_username || leadData.contactDisplay}_${leadData.car}_${leadData.service}`;
    const now = Date.now();
    if (lastSyncedContactKey === contactKey && (now - lastSyncedTime) < 15000) {
      return;
    }
    lastSyncedContactKey = contactKey;
    lastSyncedTime = now;

    const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzu8ArfBKXIC3TXHTft_E71DexXH4U_URuptyEqCRTxub9eUejPLaLwiFGAeyIghy3S/exec";
    const TG_BOT_TOKEN = "9042228037:AAEy1Sij6yYSSqdl1OW6S8e253auvBywajg";
    const TG_ADMIN_ID = 5031947136;

    // 1. Отправка в Google Таблицу через Apps Script Webhook
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
        status: "⏳ Ожидает подтверждения"
      };

      fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(sheetPayload)
      }).catch(function(err) {
        console.warn("[ECM Widget] Google Sheets sync notice:", err);
      });
    } catch (e) {
      console.warn("[ECM Widget] Google Sheets sync error:", e);
    }

    // 2. Мгновенное уведомление в Telegram бот владельца (@ecm_owner_demo_bot)
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
      }).catch(function(err) {
        console.warn("[ECM Widget] Telegram notify notice:", err);
      });
    } catch (e) {
      console.warn("[ECM Widget] Telegram notify error:", e);
    }
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
          text: 'В демо доступно 500 сообщений. Для сброса нажмите кнопку «Обновить диалог» в шапке.'
        });
        renderAllStreams();
        return;
      }

      messages.push({ role: 'user', text: trimmed });
      renderAllStreams();

      // Сохраняем пожелание по времени, если пользователь его указал
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

          if (dayPrefix) {
            activeOrderState.slot = `${dayPrefix} ${timePref}`;
          } else {
            activeOrderState.slot = timePref;
          }
        } else {
          activeOrderState.slot = timePref;
        }
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

      // Карточка заказ-наряда формируется ТОЛЬКО в самом начале как образец и в конце при фактической записи (оставлен контакт)
      const isFinalBooking = !!contactInfo && !refusalMode && !b2bMode;

      if (isFinalBooking) {
        const estClass = (estimate && estimate.carClass) || activeOrderState.carClass || 'Внедорожник';
        const estModel = (estimate && estimate.carModel) || activeOrderState.carModel || 'Автомобиль клиента';
        const estService = (estimate && estimate.serviceName) || activeOrderState.serviceName || 'Комплексная восстановительная полировка кузова';
        const estBasePrice = (estimate && estimate.basePrice !== undefined && estimate.basePrice !== null && !isNaN(estimate.basePrice))
          ? Number(estimate.basePrice)
          : (activeOrderState.basePrice || 18000);
        const isExcl = (estimate && estimate.upsellExcluded) || !!activeOrderState.upsellExcluded;
        const estUpsellPrice = isExcl
          ? 0
          : ((estimate && estimate.upsellPrice !== undefined && estimate.upsellPrice !== null && !isNaN(estimate.upsellPrice))
              ? Number(estimate.upsellPrice)
              : (activeOrderState.upsellPrice !== undefined ? activeOrderState.upsellPrice : 0));
        const estUpsellName = isExcl
          ? 'Без дополнительных опций'
          : ((estimate && estimate.upsellName) || activeOrderState.upsellName || (estUpsellPrice > 0 ? 'Нанокерамика 9H (2 слоя)' : 'Без дополнительных опций'));
        const estTotalPrice = (estimate && estimate.totalPrice !== undefined && estimate.totalPrice !== null && !isNaN(estimate.totalPrice))
          ? Number(estimate.totalPrice)
          : (estBasePrice + estUpsellPrice);
        const estSlot = (estimate && estimate.slot) || activeOrderState.slot || 'по согласованию (на ваш выбор)';

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

        // Заменяем предыдущую подтвержденную карточку (если клиент скорректировал контакт или время), не трогая стартовый образец в шапке
        const prevConfirmedIdx = messages.findIndex(m => m.isEstimate && !m.isInitialSample);
        if (prevConfirmedIdx !== -1) {
          messages.splice(prevConfirmedIdx, 1);
        }
        messages.push(finalOrderCard);

        const clientDisplayName = contactInfo.name
          ? `${contactInfo.name} / ${estModel} (${estClass})`
          : `${estModel} (${estClass})`;

        // Отправка в реальные сервисы (Google Sheets и Telegram)
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
              service: `${estService} + ${estUpsellName}`,
              cost: `${Number(estTotalPrice).toLocaleString('ru-RU')} ₽`,
              source: 'Виджет на сайте',
              status: 'Бронь подтверждена'
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
      return handleUserSend(text);
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
