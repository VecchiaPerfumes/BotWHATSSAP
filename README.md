# Bot de WhatsApp para tu Perfumería 🧴✨

Bot listo para responder por WhatsApp Business: muestra tu catálogo (140 perfumes ya cargados, organizados en Más Vendidos, Hombre, Mujer, Unisex y Sets de Regalo), dice precio y disponibilidad, y toma pedidos con dirección de delivery.

## ¿Qué hace el bot?

- Saluda y muestra un menú con botones.
- Busca perfumes por nombre o por nota olfativa (ej: "vainilla", "cítrico").
- Muestra precio y si hay stock (✅ Disponible / ❌ Agotado).
- Toma pedidos: pregunta cantidad, dirección, confirma, y **te avisa a ti** (al número que configures) con el resumen del pedido.
- Responde sobre delivery y deriva a un humano si el cliente lo pide.

## Paso 1: Crear tu app en Meta for Developers

1. Entra a https://developers.facebook.com/ y crea una cuenta de desarrollador (si no tienes).
2. Crea una **App** nueva, tipo "Business".
3. Dentro de la app, agrega el producto **WhatsApp**.
4. Meta te asigna automáticamente un **número de prueba** para empezar a probar gratis, y ahí mismo verás:
   - `Temporary access token` (token temporal, dura 24h — luego generas uno permanente)
   - `Phone number ID`
5. Para usar tu **número de WhatsApp Business real** (no el de prueba), en la misma sección hay una opción para agregar tu número y verificarlo por SMS/llamada.
6. Para producción necesitarás verificar tu negocio en **Meta Business Manager** (puede tardar 1-3 días la primera vez).

## Paso 2: Preparar el proyecto

```bash
# 1. Instala dependencias
npm install

# 2. Copia el archivo de variables de entorno
cp .env.example .env
```

Abre `.env` y completa:

```
WHATSAPP_TOKEN=el_token_que_te_dio_meta
WHATSAPP_PHONE_NUMBER_ID=el_phone_number_id
WHATSAPP_VERIFY_TOKEN=inventa-una-palabra-secreta-123
BUSINESS_NAME=Nombre de tu perfumería
DELIVERY_INFO=Hacemos delivery en toda la ciudad, costo según zona.
HUMAN_CONTACT_NUMBER=+521XXXXXXXXXX   <- TU número, para recibir los pedidos
PORT=3000
```

## Paso 3: Probar el bot localmente (sin conectar a WhatsApp)

Ya incluí un simulador de conversación para que veas que la lógica funciona sin gastar cuota de la API:

```bash
node scripts/test_bot.js
```

Esto imprime en la consola una conversación de ejemplo completa (saludo → catálogo → pedido → confirmación).

## Paso 4: Levantar el servidor real

```bash
npm start
```

Esto levanta el bot en `http://localhost:3000`. Pero Meta necesita una URL pública para enviarte los mensajes (un "webhook"), así que localhost no sirve directamente. Dos opciones:

**Opción rápida para probar (recomendada al inicio):**
Usa [ngrok](https://ngrok.com/) para exponer tu servidor local a internet:
```bash
ngrok http 3000
```
Te dará una URL tipo `https://abc123.ngrok-free.app`.

**Opción para producción:**
Sube este proyecto a un servidor que corra 24/7, por ejemplo [Railway](https://railway.app/), [Render](https://render.com/) o una VPS. Ahí simplemente configuras las mismas variables de entorno del `.env` en el panel del servicio.

## Paso 5: Configurar el Webhook en Meta

1. En tu app de Meta for Developers, ve a **WhatsApp > Configuration**.
2. En "Webhook", pon:
   - **Callback URL**: `https://tu-url-publica.com/webhook`
   - **Verify Token**: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN` dentro de tu `.env`
3. Dale a "Verify and Save". Si tu servidor está corriendo, debería verificarse solo ✅.
4. En "Webhook fields", suscríbete a **messages**.

¡Listo! Ahora, cuando alguien te escriba a tu número de WhatsApp Business, tu servidor recibirá el mensaje y el bot responderá automáticamente.

## Paso 6 (opcional pero recomendado): Token permanente

El token que te da Meta al inicio expira en 24 horas. Para que el bot no se caiga, necesitas un **token permanente** (System User Token):
1. Ve a Meta Business Suite > Configuración del negocio > Usuarios del sistema.
2. Crea un "System User" con rol Admin.
3. Asígnale tu app de WhatsApp con permisos `whatsapp_business_messaging`.
4. Genera un token sin fecha de expiración y reemplázalo en tu `.env`.

## Estructura del proyecto

```
perfume-bot/
├── server.js       # Servidor Express + webhook de WhatsApp
├── bot.js          # Lógica de conversación (menú, búsqueda, pedidos)
├── catalog.js       # Carga y búsqueda del catálogo
├── whatsapp.js     # Envío de mensajes a la API de WhatsApp
├── data/
│   └── catalog.json # Tu catálogo de 140 perfumes ya estructurado
├── scripts/
│   ├── test_bot.js       # Simulador de conversación (sin WhatsApp real)
│   └── parse_catalog.py  # Script que generó catalog.json (por si actualizas precios/stock)
└── .env.example
```

## ¿Cómo actualizo precios o stock?

Edita directamente `data/catalog.json` — cada perfume tiene:
```json
{
  "id": "versace-eros-edt-100ml",
  "name": "Versace Eros EDT 100ml",
  "price_usd": 110,
  "available": true,
  "category": "hombre",
  "notes": "Fresco y juvenil con menta, manzana verde y vainilla."
}
```
Cambia `price_usd` o `available` (true/false) y reinicia el servidor (`npm start`).

## Notas importantes

- **Riesgo de bloqueo**: como usas la API oficial de Meta (no un método no oficial tipo QR), tu número no corre riesgo de ser baneado por automatización.
- **Costos**: Meta cobra por conversación una vez agotadas las conversaciones gratuitas mensuales. Revisa los precios actuales en https://developers.facebook.com/docs/whatsapp/pricing
- **Memoria del bot**: ahora mismo la conversación de cada cliente se guarda en memoria (se pierde si reinicias el servidor a medio pedido). Si quieres que sea más robusto a futuro, puedo ayudarte a conectarlo a una base de datos.
