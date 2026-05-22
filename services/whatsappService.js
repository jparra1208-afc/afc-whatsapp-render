const axios = require("axios");

async function enviarMensajeWhatsApp(numero, mensaje) {

    const url = `https://graph.facebook.com/v25.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

    console.log("Intentando enviar WhatsApp...");
    console.log("Numero destino:", numero);
    console.log("Phone Number ID:", process.env.META_PHONE_NUMBER_ID);
    console.log("Token existe:", process.env.META_TOKEN ? "SI" : "NO");

    const payload = {
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: {
            body: mensaje
        }
    };

    const response = await axios.post(url, payload, {
        headers: {
            Authorization: `Bearer ${process.env.META_TOKEN}`,
            "Content-Type": "application/json"
        }
    });

    console.log("Respuesta Meta:", response.data);

}

module.exports = {
    enviarMensajeWhatsApp
};