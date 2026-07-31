// Simula el envío de mensajes interceptando whatsapp.js con un mock,
// para probar la lógica del bot sin necesitar credenciales reales.
const Module = require('module');
const path = require('path');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === './whatsapp' || request.endsWith('/whatsapp')) {
    return path.join(__dirname, 'mock_whatsapp.js');
  }
  return originalResolve.call(this, request, ...args);
};

const { handleIncomingMessage } = require('../bot');

async function run() {
  const user = '5219999999';
  const convo = [
    'Hola',
    'catalogo',
    'hombre',
    'quiero pedir Versace Eros EDT 100ml',
    '2',
    'Calle Falsa 123, entre casa azul y la tienda',
  ];

  for (const msg of convo) {
    console.log(`\n>>> Usuario: ${msg}`);
    await handleIncomingMessage(user, msg, null);
  }

  console.log('\n>>> Usuario confirma pedido (botón)');
  await handleIncomingMessage(user, 'Confirmar', 'order_confirm');
}

run();
