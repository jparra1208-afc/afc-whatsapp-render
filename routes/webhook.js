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

        const factura = texto.match(/\d+/)?.[0];

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

        const respuesta = `
Factura: ${datosFactura.Factura || factura}
Cliente: ${datosFactura.Cliente || "Sin dato"}
Origen: ${datosFactura.Origen || "Sin dato"}
Destino: ${datosFactura.Destino || "Sin dato"}
Unidad: ${datosFactura.Unidad || "Sin dato"}
Remolque: ${datosFactura.Remolque || "Sin dato"}
Chofer: ${datosFactura.Chofer || "Sin dato"}
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