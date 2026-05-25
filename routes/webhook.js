require("dotenv").config();

const express = require("express");
const router = express.Router();

const { enviarMensajeWhatsApp } = require("../services/whatsappService");
const { buscarFactura } = require("../services/excelService");
const { obtenerGPSUnidad } = require("../services/samsaraService");

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
        }

        return res.sendStatus(403);
    }

    return res.sendStatus(400);
});

// RECIBIR MENSAJES
router.post("/webhook", async (req, res) => {
    try {
        const value = req.body.entry?.[0]?.changes?.[0]?.value;

        if (value?.statuses) {
            console.log("Evento de estatus recibido, se ignora.");
            return res.sendStatus(200);
        }

        const mensaje = value?.messages?.[0];

        if (!mensaje) {
            console.log("Evento sin mensaje, se ignora.");
            return res.sendStatus(200);
        }

        const numero = mensaje.from;
        const texto = mensaje.text?.body || "";

        console.log("Mensaje real recibido:", texto);
        console.log("Número origen:", numero);

        const factura = texto
          .toUpperCase()
         .replace("FACTURA", "")
         .trim();

        if (!factura) {
            await enviarMensajeWhatsApp(
                numero,
                "Envía la consulta así: factura 12345"
            );

            return res.sendStatus(200);
        }

        console.log("Factura extraída:", factura);

        const datosFactura = buscarFactura(factura);

        if (!datosFactura) {
            await enviarMensajeWhatsApp(
                numero,
                `No encontré información para la factura ${factura}`
            );

            return res.sendStatus(200);
        }

        let infoSamsara = null;

        if (datosFactura.Unidad) {
            try {
                infoSamsara = await obtenerGPSUnidad(datosFactura.Unidad);
            } catch (errorSamsara) {
                console.error(
                    "Error consultando Samsara:",
                    errorSamsara.response?.data || errorSamsara.message
                );
            }
        }

        let respuesta = `
Factura: ${datosFactura.Factura || factura}
Cliente: ${datosFactura.Cliente || "Sin dato"}
Origen: ${datosFactura.Origen || "Sin dato"}
Destino: ${datosFactura.Destino || "Sin dato"}
Unidad: ${datosFactura.Unidad || "Sin dato"}
Remolque: ${datosFactura.Remolque || "Sin dato"}
Chofer: ${datosFactura.Chofer || "Sin dato"}
`;

        if (infoSamsara?.gpsDisponible) {
            respuesta += `

Ubicación actual:
${infoSamsara.direccion}

Velocidad:
${infoSamsara.velocidad || 0} mph

Última actualización:
${infoSamsara.tiempo}

Mapa:
${infoSamsara.mapa}
`;
        } else if (infoSamsara?.encontrado) {
            respuesta += `

Samsara:
Unidad encontrada, pero sin GPS disponible.
`;
        } else {
            respuesta += `

Samsara:
No encontré la unidad en Samsara.
`;
        }

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