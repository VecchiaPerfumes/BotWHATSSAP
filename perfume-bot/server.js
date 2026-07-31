require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./bot');
const wa = require('./whatsapp');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Ruta simple de salud, útil para revisar que el server esté vivo
app.get('/', (req, res) => {
  res.send('Bot de perfumes: activo ✅');
});

// 1) Verificación del webhook (Meta hace un GET la primera vez que lo configuras)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado correctamente.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Recepción de mensajes entrantes
app.post('/webhook', async (req, res) => {
  // Responder rápido a Meta para que no reintente el envío
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return; // puede ser un evento de "status" (entregado/leído), lo ignoramos

    const from = message.from; // número del cliente
    await wa.markAsRead(message.id);

    let rawText = '';
    let interactiveId = null;

    if (message.type === 'text') {
      rawText = message.text.body;
    } else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        interactiveId = message.interactive.button_reply.id;
        rawText = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        interactiveId = message.interactive.list_reply.id;
        rawText = message.interactive.list_reply.title;
      }
    } else {
      // audio, imagen, sticker, etc.
      await wa.sendText(
        from,
        'Por ahora solo puedo leer mensajes de texto 🙂. ¿Puedes escribirme lo que necesitas?'
      );
      return;
    }

    await handleIncomingMessage(from, rawText, interactiveId);
  } catch (err) {
    console.error('Error procesando el webhook:', err);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor del bot escuchando en el puerto ${PORT}`);
});
