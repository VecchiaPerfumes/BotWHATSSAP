const catalog = require('./catalog');
const wa = require('./whatsapp');

// Sesión en memoria por número de teléfono.
// OJO: al reiniciar el servidor se pierde. Para producción real,
// conviene mover esto a una base de datos (Redis, SQLite, etc).
const sessions = new Map();

function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, { stage: 'idle', order: {} });
  }
  return sessions.get(from);
}

function resetSession(from) {
  sessions.set(from, { stage: 'idle', order: {} });
}

const BUSINESS_NAME = process.env.BUSINESS_NAME || 'nuestra perfumería';
const DELIVERY_INFO =
  process.env.DELIVERY_INFO ||
  'Hacemos delivery. Costo según zona, se confirma al tomar el pedido.';
const HUMAN_CONTACT_NUMBER = process.env.HUMAN_CONTACT_NUMBER;

const GREETING_WORDS = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello'];
const MENU_WORDS = ['menu', 'ayuda', 'opciones'];
const CATALOG_WORDS = ['catalogo', 'catálogo', 'productos', 'perfumes', 'ver todo'];
const DELIVERY_WORDS = ['delivery', 'envio', 'envío', 'domicilio', 'entrega'];
const HUMAN_WORDS = ['humano', 'persona', 'asesor', 'hablar con alguien', 'atencion humana'];
const ORDER_WORDS = ['pedido', 'comprar', 'quiero pedir', 'ordenar', 'orden'];

function includesAny(text, words) {
  return words.some((w) => text.includes(w));
}

async function sendMainMenu(from) {
  await wa.sendButtons(
    from,
    `👋 ¡Hola! Bienvenido/a a *${BUSINESS_NAME}* 🧴✨\n\n¿En qué te puedo ayudar hoy?`,
    [
      { id: 'menu_catalogo', title: 'Ver catálogo' },
      { id: 'menu_pedido', title: 'Hacer un pedido' },
      { id: 'menu_humano', title: 'Hablar con alguien' },
    ]
  );
}

async function sendCategoryMenu(from) {
  const labels = catalog.CATEGORY_LABELS;
  const lines = Object.entries(labels)
    .map(([, label]) => `• ${label}`)
    .join('\n');
  await wa.sendText(
    from,
    `Estas son nuestras categorías:\n\n${lines}\n\nEscribe el nombre de la categoría (ej: "hombre", "mujer", "unisex", "sets de regalo") o el nombre de un perfume que te interese, y te muestro precio y disponibilidad. 🙂`
  );
}

function categoryFromText(text) {
  if (text.includes('mas vendid') || text.includes('más vendid')) return 'mas_vendidos';
  if (text.includes('hombre') || text.includes('men')) return 'hombre';
  if (text.includes('mujer') || text.includes('women')) return 'mujer';
  if (text.includes('unisex')) return 'unisex';
  if (text.includes('set') || text.includes('regalo')) return 'sets_regalo';
  return null;
}

async function sendProductList(from, products, introText) {
  if (products.length === 0) {
    await wa.sendText(
      from,
      'No encontré ningún perfume con ese criterio 😕. Prueba con otro nombre, o escribe *catálogo* para ver todas las categorías.'
    );
    return;
  }
  const list = products.map((p) => catalog.formatProduct(p)).join('\n\n');
  await wa.sendText(from, `${introText}\n\n${list}`);
  await wa.sendText(
    from,
    'Si quieres pedir alguno, escribe: *"quiero pedir [nombre del perfume]"* 🛍️'
  );
}

async function notifyHumanOfOrder(from, session) {
  if (!HUMAN_CONTACT_NUMBER) return;
  const { productId, quantity, address } = session.order;
  const product = catalog.getById(productId);
  const summary =
    `🧾 *Nuevo pedido*\n` +
    `Cliente: ${from}\n` +
    `Producto: ${product ? product.name : productId}\n` +
    `Cantidad: ${quantity}\n` +
    `Dirección: ${address}\n`;
  await wa.sendText(HUMAN_CONTACT_NUMBER, summary);
}

async function startOrderFlow(from, product) {
  const session = getSession(from);
  session.stage = 'awaiting_quantity';
  session.order = { productId: product.id };
  await wa.sendText(
    from,
    `Perfecto, quieres pedir *${product.name}* (${
      product.price_usd ? `$${product.price_usd}` : 'precio a consultar'
    }).\n\n¿Cuántas unidades deseas?`
  );
}

async function handleIncomingMessage(from, rawText, interactiveId) {
  const session = getSession(from);
  const text = catalog.normalize((rawText || '').trim());

  // --- Prioridad 1: flujo de pedido en curso ---
  if (session.stage === 'awaiting_product_choice') {
    const matches = catalog.search(rawText, { onlyAvailable: true });
    if (matches.length === 1) {
      return startOrderFlow(from, matches[0]);
    }
    if (matches.length > 1) {
      return sendProductList(
        from,
        matches,
        'Todavía hay varias coincidencias, escribe el nombre completo tal cual aparece:'
      );
    }
    await wa.sendText(
      from,
      'No encontré ese perfume disponible. Prueba con otro nombre, o escribe *catálogo* para ver las opciones.'
    );
    return;
  }

  if (session.stage === 'awaiting_quantity') {
    const qty = parseInt(rawText.match(/\d+/)?.[0] || '', 10);
    if (!qty || qty <= 0) {
      await wa.sendText(from, 'Por favor dime un número válido de unidades (ej: 1, 2, 3...).');
      return;
    }
    session.order.quantity = qty;
    session.stage = 'awaiting_address';
    await wa.sendText(
      from,
      '¡Genial! Ahora dime la *dirección completa* para el delivery (calle, número, referencia).'
    );
    return;
  }

  if (session.stage === 'awaiting_address') {
    if (rawText.trim().length < 5) {
      await wa.sendText(from, 'Necesito la dirección completa para poder coordinar el delivery 🙏');
      return;
    }
    session.order.address = rawText.trim();
    session.stage = 'awaiting_confirm';
    const product = catalog.getById(session.order.productId);
    await wa.sendButtons(
      from,
      `Resumen de tu pedido:\n\n🧴 ${product.name}\n📦 Cantidad: ${session.order.quantity}\n📍 Dirección: ${session.order.address}\n\n${DELIVERY_INFO}\n\n¿Confirmas el pedido?`,
      [
        { id: 'order_confirm', title: 'Confirmar ✅' },
        { id: 'order_cancel', title: 'Cancelar ❌' },
      ]
    );
    return;
  }

  if (session.stage === 'awaiting_confirm') {
    const confirmed = interactiveId === 'order_confirm' || includesAny(text, ['confirmo', 'si', 'sí', 'confirmar']);
    const cancelled = interactiveId === 'order_cancel' || includesAny(text, ['cancelar', 'no']);
    if (confirmed) {
      await notifyHumanOfOrder(from, session);
      await wa.sendText(
        from,
        '✅ ¡Pedido confirmado! En breve nos contactamos para coordinar el pago y la entrega. ¡Gracias por tu compra! 💜'
      );
      resetSession(from);
      return;
    }
    if (cancelled) {
      await wa.sendText(from, 'Pedido cancelado. Si necesitas algo más, aquí estoy 🙂');
      resetSession(from);
      return;
    }
    await wa.sendText(from, 'Por favor confirma con "Confirmar" o "Cancelar".');
    return;
  }

  // --- Prioridad 2: botones del menú principal ---
  if (interactiveId === 'menu_catalogo') return sendCategoryMenu(from);
  if (interactiveId === 'menu_humano') {
    await wa.sendText(
      from,
      'Enseguida un asesor humano te va a contactar. Mientras tanto, ¿hay algo más en lo que te pueda ayudar? 🙂'
    );
    return;
  }
  if (interactiveId === 'menu_pedido') {
    await wa.sendText(
      from,
      '¿Qué perfume te gustaría pedir? Escribe el nombre (ej: "quiero pedir Versace Eros").'
    );
    return;
  }

  // --- Prioridad 3: saludo ---
  if (includesAny(text, GREETING_WORDS) && text.length < 20) {
    resetSession(from);
    await sendMainMenu(from);
    return;
  }

  // --- Prioridad 4: menú / catálogo ---
  if (includesAny(text, MENU_WORDS)) return sendMainMenu(from);
  if (includesAny(text, CATALOG_WORDS)) return sendCategoryMenu(from);

  // --- Prioridad 5: delivery / info del negocio ---
  if (includesAny(text, DELIVERY_WORDS)) {
    await wa.sendText(from, `🚚 ${DELIVERY_INFO}`);
    return;
  }

  // --- Prioridad 6: hablar con humano ---
  if (includesAny(text, HUMAN_WORDS)) {
    await wa.sendText(from, 'Claro, en un momento te contacta un asesor humano. 🙂');
    return;
  }

  // --- Prioridad 7: categoría específica ---
  const cat = categoryFromText(text);
  if (cat) {
    const products = catalog.getByCategory(cat);
    return sendProductList(from, products, `Aquí tienes nuestra colección *${catalog.CATEGORY_LABELS[cat]}*:`);
  }

  // --- Prioridad 8: iniciar pedido ---
  if (includesAny(text, ORDER_WORDS)) {
    // Intenta extraer el nombre del producto del mismo mensaje
    const withoutOrderWords = ORDER_WORDS.reduce(
      (acc, w) => acc.replace(w, ''),
      text
    ).trim();
    const matches = withoutOrderWords ? catalog.search(withoutOrderWords, { onlyAvailable: true }) : [];
    if (matches.length === 1) {
      return startOrderFlow(from, matches[0]);
    }
    if (matches.length > 1) {
      session.stage = 'awaiting_product_choice';
      return sendProductList(
        from,
        matches,
        'Encontré varias opciones, escribe el nombre exacto del que quieres pedir:'
      );
    }
    session.stage = 'awaiting_product_choice';
    await wa.sendText(from, '¿Qué perfume te gustaría pedir? Dime el nombre exacto.');
    return;
  }

  // --- Prioridad 9: búsqueda libre (nombre de perfume, nota olfativa, "mas vendidos", etc) ---
  if (text.includes('mas vendid') || text.includes('más vendid') || text.includes('recomend')) {
    return sendProductList(from, catalog.getBestSellers(), '🔥 Nuestros más vendidos:');
  }

  const results = catalog.search(rawText);
  if (results.length > 0) {
    return sendProductList(from, results, 'Esto encontré para ti:');
  }

  // --- Fallback ---
  await wa.sendText(
    from,
    'No estoy seguro de haber entendido 🤔. Puedes escribir:\n\n• *catálogo* – ver todas las categorías\n• el nombre de un perfume\n• *pedido* – hacer un pedido\n• *delivery* – info de envíos\n• *humano* – hablar con una persona'
  );
}

module.exports = { handleIncomingMessage };
