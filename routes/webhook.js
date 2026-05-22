require("dotenv").config();

const express = require("express");

const router = express.Router();

const { enviarMensajeWhatsApp } = require("../services/whatsappService");
const { buscarFactura } = require("../services/excelService");
// VALIDACIÓN META WEBHOOK
router.get("/webhook", (req, res) => {

    const verify_token = process.env.VERIFY_TOKEN;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {

        if (mode === "subscribe" && token === verify_token) {

            console.log("WEBHOOK VERIFICADO");

            return res.status(200).send(challenge);

        } else {

            return res.sendStatus(403);

        }

    }

});


// RECIBIR MENSAJES
router.post("/webhook", async (req, res) => {

    try {

        console.log("Mensaje recibido:");

        console.log(JSON.stringify(req.body, null, 2));

        const value = req.body.entry?.[0]?.changes?.[0]?.value;

        const mensaje = value?.messages?.[0];

        if (!mensaje) {

            return res.sendStatus(200);

        }

        const numero = mensaje.from;

        const texto = mensaje.text?.body || "";

      const factura = texto.match(/\d+/)?.[0];

if (!factura) {

    await enviarMensajeWhatsApp(
        numero,
        "Envía la consulta así: factura 12345"
    );

    return res.sendStatus(200);
}

const datosFactura = buscarFactura(factura);

if (!datosFactura) {

    await enviarMensajeWhatsApp(
        numero,
        `No encontré información para la factura ${factura}`
    );

    return res.sendStatus(200);
}

const respuesta = `
Factura: ${factura}
Unidad: ${datosFactura.Unidad || "Sin dato"}
Cliente: ${datosFactura.Cliente || "Sin dato"}
Estatus: ${datosFactura.Estatus || "Sin dato"}
`;

await enviarMensajeWhatsApp(numero, respuesta); 
        res.sendStatus(200);

    } catch (error) {

        console.error(

            "Error procesando webhook:",

            error.response?.data || error.message

        );

        res.sendStatus(200);

    }

});

module.exports = router;