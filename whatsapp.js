const axios = require('axios');

const GRAPH_VERSION = 'v20.0';

function getClient() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en el archivo .env'
    );
  }

  const baseURL = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`;

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

// Envía un mensaje de texto simple
async function sendText(to, body) {
  const client = getClient();
  try {
    await client.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    });
  } catch (err) {
    console.error(
      'Error enviando mensaje de WhatsApp:',
      err.response?.data || err.message
    );
  }
}

// Envía un mensaje con botones rápidos (máximo 3 botones permite WhatsApp)
async function sendButtons(to, bodyText, buttons) {
  const client = getClient();
  try {
    await client.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((btn, i) => ({
            type: 'reply',
            reply: { id: btn.id || `btn_${i}`, title: btn.title.slice(0, 20) },
          })),
        },
      },
    });
  } catch (err) {
    console.error(
      'Error enviando botones de WhatsApp:',
      err.response?.data || err.message
    );
  }
}

// Marca un mensaje entrante como leído (check azul)
async function markAsRead(messageId) {
  const client = getClient();
  try {
    await client.post('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  } catch (err) {
    console.error('Error marcando como leído:', err.response?.data || err.message);
  }
}

module.exports = { sendText, sendButtons, markAsRead };
