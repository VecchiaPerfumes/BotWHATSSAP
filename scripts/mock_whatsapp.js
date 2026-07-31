async function sendText(to, body) {
  console.log(`[BOT -> ${to}]:\n${body}`);
}

async function sendButtons(to, bodyText, buttons) {
  const btnList = buttons.map((b) => `[${b.title}]`).join(' ');
  console.log(`[BOT -> ${to}] (botones):\n${bodyText}\n${btnList}`);
}

async function markAsRead() {}

module.exports = { sendText, sendButtons, markAsRead };
