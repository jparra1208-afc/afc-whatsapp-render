require("dotenv").config();

const express = require("express");
const router = express.Router();

const { enviarMensajeWhatsApp } = require("../services/whatsappService");
const { buscarFactura } = require("../services/excelService");
const { obtenerGPSUnidad } = require("../services/samsaraService");
const { registrarConsulta } = require("../services/consultasService");
const { obtenerLiveShareUnidad } = require("../services/samsaraLiveShareService");

function limpiarLista(valores) {
    return (valores || [])
        .map(v => String(v || "").trim())
        .filter(Boolean);
}

async function obtenerLiveSharingPrioridad(datosFactura) {
    const remolques = limpiarLista(datosFactura.RemolquesLista);
    const unidades = limpiarLista(datosFactura.UnidadesLista);

    const links = [];

    for (const remolque of remolques) {
        const link = await obtenerLiveShareUnidad(remolque);

        if (link) {
            links.push({
                tipo: "Remolque",
                numero: remolque,
                link
            });
        }
    }

    if (links.length > 0) {
        return {
            fuente: "REMOLQUE",
            links
        };
    }

    for (const unidad of unidades) {
        const link = await obtenerLiveShareUnidad(unidad);

        if (link) {
            links.push({
                tipo: "Unidad",
                numero: unidad,
                link
            });
        }
    }

    return {
        fuente: links.length > 0 ? "UNIDAD" : "NO_DISPONIBLE",
        links
    };
}

function formatearLinksLiveSharing(resultadoLiveSharing) {
    if (!resultadoLiveSharing || resultadoLiveSharing.links.length === 0) {
        return "No disponible";
    }

    return resultadoLiveSharing.links
        .map(item => `${item.tipo} ${item.numero}:\n${item.link}`)
        .join("\n\n");
}

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
        const value = req.body?.entry?.[0]?.changes?.[0]?.value;

        if (!value) {
            console.log("⚠️ POST recibido sin estructura válida de Meta, se ignora.");
            return res.sendStatus(200);
        }

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

        const telefonosAutorizados = (
            process.env.TELEFONOS_AUTORIZADOS || ""
        )
            .split(",")
            .map(t => t.trim());

        if (!telefonosAutorizados.includes(numero)) {
            await enviarMensajeWhatsApp(
                numero,
                "No tienes autorización para consultar información. Contacta a Autofletes Chihuahua."
            );

            return res.sendStatus(200);
        }

        console.log("Mensaje real recibido:", texto);
        console.log("Número origen:", numero);

        const textoNormalizado = texto.trim().toLowerCase();

        if (
            textoNormalizado === "hola" ||
            textoNormalizado === "menu" ||
            textoNormalizado === "menú" ||
            textoNormalizado === "ayuda" ||
            textoNormalizado === "inicio"
        ) {
            const bienvenida = `
🚛 Bienvenido al asistente automático de Autofletes Chihuahua (AFC)

Puedes consultar el estatus de tu embarque en tiempo real.

📦 ¿Cómo consultar una factura?

Envía el número de factura así:

factura 224652-TC

El sistema mostrará:

✅ Cliente
✅ Origen y destino
✅ Unidad asignada
✅ Remolque
✅ Operador
✅ Ubicación GPS
✅ Link público Samsara Live Sharing

⚡ Disponible 24/7
`;

            await enviarMensajeWhatsApp(numero, bienvenida);
            return res.sendStatus(200);
        }

        const factura = texto
            .toUpperCase()
            .replace("FACTURA", "")
            .trim();

        if (!factura) {
            await enviarMensajeWhatsApp(
                numero,
                "Envía la consulta así: factura 224652-TC"
            );

            return res.sendStatus(200);
        }

        console.log("Factura extraída:", factura);

        const datosFactura = buscarFactura(factura);

        console.log("DEBUG Remolque:", datosFactura?.Remolque);
        console.log("DEBUG RemolquesLista:", datosFactura?.RemolquesLista);
        console.log("DEBUG Unidad:", datosFactura?.Unidad);
        console.log("DEBUG UnidadesLista:", datosFactura?.UnidadesLista);
        if (!datosFactura) {
            await enviarMensajeWhatsApp(
                numero,
                `No encontré información para la factura ${factura}`
            );

            await registrarConsulta({
                telefono: numero,
                cliente: "",
                factura: factura,
                unidad: "",
                remolque: "",
                consulta_tipo: "FACTURA",
                resultado: "FACTURA_NO_ENCONTRADA",
                link_samsara: ""
            });

            return res.sendStatus(200);
        }

        const facturaLink = String(datosFactura.Factura || factura)
            .trim()
            .replace(/\s+/g, "");

        const linkAFC = `https://afc-whatsapp-render.onrender.com/track/${encodeURIComponent(facturaLink)}`;

        let infoSamsara = null;

const activoConsultaGPS =
    datosFactura.RemolquesLista?.[0] ||
    datosFactura.Remolque ||
    datosFactura.UnidadesLista?.[0] ||
    datosFactura.Unidad;

console.log("GPS consultado para:", activoConsultaGPS);

if (activoConsultaGPS) {
    try {
        infoSamsara = await obtenerGPSUnidad(activoConsultaGPS);

        console.log("Resultado GPS:", infoSamsara);

    } catch (errorSamsara) {
        console.error(
            "Error consultando Samsara:",
            errorSamsara.response?.data || errorSamsara.message
        );
    }
}

        let resultadoLiveSharing = {
            fuente: "NO_DISPONIBLE",
            links: []
        };

        try {
            resultadoLiveSharing = await obtenerLiveSharingPrioridad(datosFactura);

            console.log("DEBUG Resultado LiveSharing:", JSON.stringify(resultadoLiveSharing, null, 2));
            console.log("Live Sharing fuente:", resultadoLiveSharing.fuente);
            console.log("Live Sharing links:", resultadoLiveSharing.links);
        } catch (errorLiveShare) {
            console.error(
                "Error consultando Live Sharing Samsara:",
                errorLiveShare.response?.data || errorLiveShare.message
            );
        }

        const textoLiveSharing = formatearLinksLiveSharing(resultadoLiveSharing);

        const primerLiveSharing =
            resultadoLiveSharing.links?.[0]?.link || null;

        let respuesta =
`🚛 FACTURA ${datosFactura.Factura || factura}

👤 Cliente: ${datosFactura.Cliente || "Sin dato"}
📍 Origen: ${datosFactura.Origen || "Sin dato"}
🏁 Destino: ${datosFactura.Destino || "Sin dato"}

🚚 Unidad: ${datosFactura.Unidad || "Sin dato"}
📦 Remolque: ${datosFactura.Remolque || "Sin dato"}
👨 Operador: ${datosFactura.Chofer || "Sin dato"}`;

        if (infoSamsara?.gpsDisponible) {
            respuesta += `

📡 Ubicación:
${infoSamsara.direccion}



🕒 Última actualización:
${infoSamsara.tiempo}



🛰️ Samsara Live Sharing:
${textoLiveSharing}`;

        } else if (infoSamsara?.encontrado) {
            respuesta += `

🛰️ Samsara:
Unidad encontrada, pero sin GPS disponible.



🛰️ Samsara Live Sharing:
${textoLiveSharing}`;

        } else {
            respuesta += `

🛰️ Samsara:
No encontré la unidad en Samsara.

🛰️ Samsara Live Sharing:
${textoLiveSharing}`;

        }
        

        await enviarMensajeWhatsApp(numero, respuesta);

        await registrarConsulta({
            telefono: numero,
            cliente: datosFactura.Cliente || "",
            factura: datosFactura.Factura || factura,
            unidad: datosFactura.Unidad || "",
            remolque: datosFactura.Remolque || "",
            consulta_tipo: "FACTURA",
            resultado: infoSamsara?.gpsDisponible
                ? "EXITOSA_CON_GPS"
                : infoSamsara?.encontrado
                    ? "EXITOSA_SIN_GPS"
                    : "EXITOSA_SIN_SAMSARA",
            link_samsara: primerLiveSharing || infoSamsara?.mapa || linkAFC
        });

        return res.sendStatus(200);

    } catch (error) {
        console.error(
            "Error procesando webhook:",
            error.response?.data || error.message
        );

        return res.sendStatus(200);
    }
});

module.exports = router;