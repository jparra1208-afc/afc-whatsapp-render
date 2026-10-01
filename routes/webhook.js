require("dotenv").config();

const express = require("express");

const router = express.Router();

const {
    enviarMensajeWhatsApp
} = require("../services/whatsappService");

const {
    buscarFactura
} = require("../services/excelService");

const {
    obtenerGPSUnidad
} = require("../services/samsaraService");

const {
    registrarConsulta
} = require("../services/consultasService");

const {
    obtenerLiveShareUnidad
} = require("../services/samsaraLiveShareService");

const {
    obtenerUltimaUnidadGM
} = require("../services/autobotGmService");


// ============================================
// LIMPIAR LISTAS
// ============================================

function limpiarLista(valores) {

    return (valores || [])
        .map(v => String(v || "").trim())
        .filter(Boolean);

}


// ============================================
// OBTENER LIVE SHARING
// PRIORIDAD:
// 1. REMOLQUE
// 2. ULTIMA UNIDAD ASIGNADA
// ============================================

async function obtenerLiveSharingPrioridad(
    datosFactura,
    ultimaUnidadGM = null
) {

    const remolques = limpiarLista(
        datosFactura.RemolquesLista
    );

    const unidades = limpiarLista(
        datosFactura.UnidadesLista
    );

    const links = [];


    // ====================================
    // 1. BUSCAR LIVE SHARING DEL REMOLQUE
    // ====================================

    for (const remolque of remolques) {

        const link = await obtenerLiveShareUnidad(
            remolque
        );

        if (link) {

            links.push({
                tipo: "Remolque",
                numero: remolque,
                link
            });

        }

    }


    // ====================================
    // SI EXISTE LIVE SHARING DEL REMOLQUE
    // SE UTILIZA COMO PRIORIDAD ABSOLUTA
    // ====================================

    if (links.length > 0) {

        return {
            fuente: "REMOLQUE",
            links
        };

    }


    // ====================================
    // 2. FALLBACK:
    // BUSCAR SOLO LA ULTIMA UNIDAD ASIGNADA
    // ====================================

    const ultimaUnidadExcel =
        unidades.length > 0
            ? unidades[unidades.length - 1]
            : String(
                datosFactura.Unidad || ""
            ).trim();


    // Prioridad:
    // 1. Ultima unidad obtenida desde GM
    // 2. Ultima unidad del Excel

    const ultimaUnidad =
        String(
            ultimaUnidadGM ||
            ultimaUnidadExcel ||
            ""
        ).trim();


    console.log(
        "Live Sharing - tracto seleccionado:",
        {
            gm: ultimaUnidadGM,
            excel: ultimaUnidadExcel,
            seleccionado: ultimaUnidad,
            fuente:
                ultimaUnidadGM
                    ? "GM"
                    : "EXCEL"
        }
    );


    // ====================================
    // BUSCAR LIVE SHARING DEL TRACTO
    // ====================================

    if (ultimaUnidad) {

        const link = await obtenerLiveShareUnidad(
            ultimaUnidad
        );

        if (link) {

            links.push({
                tipo: "Unidad",
                numero: ultimaUnidad,
                link
            });

        }

    }


    // ====================================
    // RESULTADO FINAL
    // ====================================

    return {

        fuente:
            links.length > 0
                ? "UNIDAD"
                : "NO_DISPONIBLE",

        links

    };

}


// ============================================
// FORMATEAR LINKS SAMSARA
// ============================================

function formatearLinksLiveSharing(
    resultadoLiveSharing
) {

    if (
        !resultadoLiveSharing ||
        !resultadoLiveSharing.links ||
        resultadoLiveSharing.links.length === 0
    ) {

        return "No disponible";

    }

    return resultadoLiveSharing.links
        .map(item =>
            `${item.tipo} ${item.numero}:\n${item.link}`
        )
        .join("\n\n");

}


// ============================================
// FORMATEAR NUMERO DE VIAJE
// ============================================

function formatearNumeroViaje(datosFactura) {

    const numeroViaje = String(
        datosFactura.NumeroViaje ?? ""
    ).trim();


    if (!numeroViaje) {

        return "";

    }


    return `\n📄 No. Viaje: ${numeroViaje}`;

}


// ============================================
// VALIDACION META WEBHOOK
// ============================================

router.get("/webhook", (req, res) => {

    const verify_token =
        process.env.VERIFY_TOKEN;

    const mode =
        req.query["hub.mode"];

    const token =
        req.query["hub.verify_token"];

    const challenge =
        req.query["hub.challenge"];


    if (mode && token) {

        if (
            mode === "subscribe" &&
            token === verify_token
        ) {

            console.log(
                "WEBHOOK VERIFICADO"
            );

            return res
                .status(200)
                .send(challenge);

        }

        return res.sendStatus(403);

    }


    return res.sendStatus(400);

});


// ============================================
// RECIBIR MENSAJES WHATSAPP
// ============================================

router.post("/webhook", async (req, res) => {

    try {

        const value =
            req.body?.entry?.[0]?.changes?.[0]?.value;


        if (!value) {

            console.log(
                "POST recibido sin estructura válida de Meta"
            );

            return res.sendStatus(200);

        }


        // ====================================
        // IGNORAR EVENTOS DE ESTATUS
        // ====================================

        if (value?.statuses) {

            console.log(
                "Evento de estatus recibido, se ignora."
            );

            return res.sendStatus(200);

        }


        const mensaje =
            value?.messages?.[0];


        if (!mensaje) {

            console.log(
                "Evento sin mensaje, se ignora."
            );

            return res.sendStatus(200);

        }


        const numero =
            mensaje.from;

        const texto =
            mensaje.text?.body || "";


        // ====================================
        // VALIDAR TELEFONOS AUTORIZADOS
        // ====================================

        console.log(
            "DEBUG ENV EN PETICION:",
            JSON.stringify(
                process.env.TELEFONOS_AUTORIZADOS
            )
        );


        const telefonosAutorizados = (
            process.env.TELEFONOS_AUTORIZADOS || ""
        )
            .split(",")
            .map(t => t.trim());


        console.log(
            "DEBUG numero recibido:",
            JSON.stringify(numero)
        );


        console.log(
            "DEBUG telefonos autorizados:",
            telefonosAutorizados
        );


        console.log(
            "DEBUG autorizado:",
            telefonosAutorizados.includes(numero)
        );


        if (
            !telefonosAutorizados.includes(numero)
        ) {

            await enviarMensajeWhatsApp(
                numero,
                "No tienes autorización para consultar información. Contacta a Autofletes Chihuahua."
            );

            return res.sendStatus(200);

        }


        console.log(
            "Mensaje real recibido:",
            texto
        );


        console.log(
            "Número origen:",
            numero
        );


        const textoNormalizado =
            texto.trim().toLowerCase();


        // ====================================
        // MENU DE BIENVENIDA
        // ====================================

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

✅ Número de viaje (cuando exista)

✅ Remolque

✅ Ubicación GPS

✅ Link público Samsara Live Sharing

⚡ Disponible 24/7

`;


            await enviarMensajeWhatsApp(
                numero,
                bienvenida
            );


            return res.sendStatus(200);

        }


        // ====================================
        // EXTRAER FACTURA
        // ====================================

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


        console.log(
            "Factura extraída:",
            factura
        );


        // ====================================
        // BUSCAR FACTURA EN GM
        // ====================================

        const datosFactura =
            buscarFactura(factura);


        // ====================================
        // FACTURA NO ENCONTRADA
        // ====================================

        if (!datosFactura) {

            await enviarMensajeWhatsApp(
                numero,
                `No encontré información para la factura ${factura}`
            );


            // ====================================
            // REGISTRAR CONSULTA CSV
            // ====================================

            await registrarConsulta({

                telefono: numero,

                cliente: "",

                factura: factura,

                unidad: "",

                remolque: "",

                consulta_tipo: "FACTURA",

                resultado:
                    "FACTURA_NO_ENCONTRADA",

                link_samsara: ""

            });


            return res.sendStatus(200);

        }


        // ====================================
        // OBTENER ULTIMO TRACTO DESDE GM
        // ====================================

        const ultimaUnidadGM =
            await obtenerUltimaUnidadGM(
                datosFactura.Factura || factura
            );


        console.log(
            "DEBUG Ultima Unidad GM:",
            ultimaUnidadGM
        );


        // ====================================
        // DEBUG
        // ====================================

        console.log(
            "DEBUG Remolque:",
            datosFactura?.Remolque
        );


        console.log(
            "DEBUG RemolquesLista:",
            datosFactura?.RemolquesLista
        );


        console.log(
            "DEBUG Unidad:",
            datosFactura?.Unidad
        );


        console.log(
            "DEBUG UnidadesLista:",
            datosFactura?.UnidadesLista
        );


        console.log(
            "DEBUG No Viaje Cliente:",
            datosFactura?.NumeroViaje
        );


        console.log(
            "DEBUG FechaLlegada:",
            datosFactura?.FechaLlegada
        );


        // ====================================
        // VALIDAR VIAJE FINALIZADO
        // ====================================

        const fechaLlegada =
            String(
                datosFactura?.FechaLlegada || ""
            ).trim();


        console.log(
            "VALIDANDO VIAJE FINALIZADO:",
            fechaLlegada
        );


        if (fechaLlegada.length > 0) {

            const respuestaFinalizado =
`✅ VIAJE FINALIZADO

🚛 Factura: ${datosFactura.Factura || factura}

👤 Cliente: ${datosFactura.Cliente || "Sin dato"}

📍 Origen: ${datosFactura.Origen || "Sin dato"}

🏁 Destino: ${datosFactura.Destino || "Sin dato"}

📦 Remolque: ${datosFactura.Remolque || "Sin dato"}${formatearNumeroViaje(datosFactura)}

📅 Fecha de llegada: ${fechaLlegada}

El viaje ya cuenta con fecha de llegada registrada en GM Transport.`;


            await enviarMensajeWhatsApp(
                numero,
                respuestaFinalizado
            );


            await registrarConsulta({

                telefono: numero,

                cliente:
                    datosFactura.Cliente || "",

                factura:
                    datosFactura.Factura || factura,

                unidad:
                    datosFactura.Unidad || "",

                remolque:
                    datosFactura.Remolque || "",

                consulta_tipo:
                    "FACTURA",

                resultado:
                    "VIAJE_FINALIZADO",

                link_samsara:
                    ""

            });


            return res.sendStatus(200);

        }


        // ====================================
        // GENERAR LINK AFC
        // ====================================

        const facturaLink =
            String(
                datosFactura.Factura || factura
            )
                .trim()
                .replace(/\s+/g, "");


        const linkAFC =
            `https://afc-whatsapp-render.onrender.com/track/${encodeURIComponent(facturaLink)}`;


        // ====================================
        // CONSULTAR GPS SAMSARA
        // PRIORIDAD:
        // 1. REMOLQUE
        // 2. ULTIMO TRACTO ASIGNADO
        // ====================================

        let infoSamsara = null;

        let activoConsultaGPS = null;

        let tipoSeguimientoGPS = null;

        let gpsRemolqueNoDisponible = false;


        // ====================================
        // OBTENER REMOLQUE
        // ====================================

        const remolqueGPS =
            datosFactura.RemolquesLista?.[0] ||
            datosFactura.Remolque ||
            null;


        // ====================================
        // OBTENER ULTIMA UNIDAD ASIGNADA
        // ====================================

        const unidadesGPS =
            Array.isArray(
                datosFactura.UnidadesLista
            )
                ? datosFactura.UnidadesLista
                    .filter(Boolean)
                : [];


        const ultimaUnidadExcelGPS =
            unidadesGPS.length > 0
                ? unidadesGPS[
                    unidadesGPS.length - 1
                ]
                : datosFactura.Unidad || null;


        const ultimaUnidadGPS =
            ultimaUnidadGM ||
            ultimaUnidadExcelGPS ||
            null;


        console.log(
            "GPS - tracto seleccionado:",
            {
                gm: ultimaUnidadGM,
                excel: ultimaUnidadExcelGPS,
                seleccionado: ultimaUnidadGPS,
                fuente:
                    ultimaUnidadGM
                        ? "GM"
                        : "EXCEL"
            }
        );


        console.log(
            "Remolque candidato GPS:",
            remolqueGPS
        );


        console.log(
            "Ultima unidad candidata GPS:",
            ultimaUnidadGPS
        );


        // ====================================
        // 1. INTENTAR REMOLQUE
        // ====================================

        if (remolqueGPS) {

            try {

                const resultadoRemolque =
                    await obtenerGPSUnidad(
                        remolqueGPS
                    );


                if (resultadoRemolque) {

                    infoSamsara =
                        resultadoRemolque;

                    activoConsultaGPS =
                        remolqueGPS;

                    tipoSeguimientoGPS =
                        "REMOLQUE";

                }

            } catch (errorRemolque) {

                console.log(
                    "GPS de remolque no disponible:",
                    remolqueGPS
                );

            }

        }


        // ====================================
        // 2. FALLBACK AL ULTIMO TRACTO
        // ====================================

        if (
            !infoSamsara &&
            ultimaUnidadGPS
        ) {

            gpsRemolqueNoDisponible =
                Boolean(remolqueGPS);


            try {

                const resultadoUnidad =
                    await obtenerGPSUnidad(
                        ultimaUnidadGPS
                    );


                if (resultadoUnidad) {

                    infoSamsara =
                        resultadoUnidad;

                    activoConsultaGPS =
                        ultimaUnidadGPS;

                    tipoSeguimientoGPS =
                        "UNIDAD";

                }

            } catch (errorUnidad) {

                console.error(
                    "GPS del tracto tampoco disponible:",
                    ultimaUnidadGPS,
                    errorUnidad.response?.data ||
                    errorUnidad.message
                );

            }

        }


        console.log(
            "GPS finalmente utilizado:",
            {
                activo:
                    activoConsultaGPS,

                tipo:
                    tipoSeguimientoGPS,

                fallbackTracto:
                    gpsRemolqueNoDisponible
            }
        );


        // ====================================
        // CONSULTAR LIVE SHARING
        // ====================================

        let resultadoLiveSharing = {

            fuente:
                "NO_DISPONIBLE",

            links: []

        };


        try {

            resultadoLiveSharing =
                await obtenerLiveSharingPrioridad(
                    datosFactura,
                    ultimaUnidadGM
                );


            console.log(
                "DEBUG Resultado LiveSharing:",
                JSON.stringify(
                    resultadoLiveSharing,
                    null,
                    2
                )
            );


            console.log(
                "Live Sharing fuente:",
                resultadoLiveSharing.fuente
            );


            console.log(
                "Live Sharing links:",
                resultadoLiveSharing.links
            );


        } catch (errorLiveShare) {

            console.error(
                "Error consultando Live Sharing Samsara:",
                errorLiveShare.response?.data ||
                errorLiveShare.message
            );

        }


        // ====================================
        // FORMATEAR LINK SAMSARA
        // ====================================

        const textoLiveSharing =
            formatearLinksLiveSharing(
                resultadoLiveSharing
            );


        const primerLiveSharing =
            resultadoLiveSharing
                .links?.[0]?.link ||
            null;


        // ====================================
        // VALIDAR GPS SAMSARA
        // SIN LIVE SHARING
        // ====================================

        const linkGpsTracto =
            !primerLiveSharing &&
            infoSamsara?.gpsDisponible
                ? infoSamsara.mapa
                : null;


        // ====================================
        // NUEVO MENSAJE WHATSAPP
        // ====================================

        let respuesta =
`🚛 FACTURA ${datosFactura.Factura || factura}

👤 Cliente: ${datosFactura.Cliente || "Sin dato"}

📍 Origen: ${datosFactura.Origen || "Sin dato"}

🏁 Destino: ${datosFactura.Destino || "Sin dato"}

📦 Remolque: ${datosFactura.Remolque || "Sin dato"}${formatearNumeroViaje(datosFactura)}`;


        // ====================================
        // INDICAR FALLBACK DE REMOLQUE A TRACTO
        // ====================================

        if (
            resultadoLiveSharing.fuente === "UNIDAD" &&
            gpsRemolqueNoDisponible
        ) {

            const unidadSeguimiento =
                resultadoLiveSharing
                    .links?.[0]?.numero ||
                ultimaUnidadGPS ||
                datosFactura.Unidad ||
                "";


            respuesta += `

📡 GPS del remolque no disponible.

🚛 Seguimiento en tiempo real mediante el tracto ${unidadSeguimiento}.`;

        }


        // ====================================
        // AGREGAR SEGUIMIENTO
        // ====================================

        respuesta += `

🔎 Seguimiento de la carga:

`;


        if (primerLiveSharing) {

            respuesta +=
                textoLiveSharing;

        }

        else if (linkGpsTracto) {

            respuesta +=
`📡 Live Sharing no disponible.

🚛 Ubicación actual mediante GPS Samsara del tracto:

${linkGpsTracto}`;

        }

        else {

            respuesta +=
                "⚠️ No existe seguimiento disponible en este momento.";

        }


        // ====================================
        // ENVIAR RESPUESTA WHATSAPP
        // ====================================

        await enviarMensajeWhatsApp(
            numero,
            respuesta
        );


        // ====================================
        // REGISTRAR CONSULTA CSV
        // ====================================

        await registrarConsulta({

            telefono:
                numero,

            cliente:
                datosFactura.Cliente || "",

            factura:
                datosFactura.Factura || factura,

            unidad:
                datosFactura.Unidad || "",

            remolque:
                datosFactura.Remolque || "",

            consulta_tipo:
                "FACTURA",


            // ====================================
            // RESULTADO DE LA CONSULTA
            // ====================================
            //
            // 1. LIVE SHARING DEL REMOLQUE
            // 2. LIVE SHARING DEL TRACTO
            // 3. GPS DISPONIBLE PERO SIN LIVE SHARING
            // 4. SIN GPS Y SIN LIVE SHARING
            // ====================================

            resultado:

                resultadoLiveSharing.fuente === "REMOLQUE"

                    ? "EXITOSA_CON_GPS_REMOLQUE"

                    : resultadoLiveSharing.fuente === "UNIDAD"

                        ? "EXITOSA_CON_GPS_TRACTO"

                        : infoSamsara?.gpsDisponible

                            ? "GPS_DISPONIBLE_SIN_LIVE_SHARING"

                            : "SIN_GPS_SIN_LIVE_SHARING",


            // ====================================
            // GUARDAR UNICAMENTE LIVE SHARING
            // ====================================
            //
            // IMPORTANTE:
            // NO guardar infoSamsara.mapa como
            // link_samsara cuando no existe
            // Live Sharing.
            // ====================================

            link_samsara:
                primerLiveSharing || ""

        });


        return res.sendStatus(200);


    } catch (error) {

        console.error(
            "Error procesando webhook:",
            error.response?.data ||
            error.message
        );


        return res.sendStatus(200);

    }

});


module.exports = router;