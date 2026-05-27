const express = require("express");

const router = express.Router();

const { buscarFactura } = require("../services/excelService");
const { obtenerGPSUnidad } = require("../services/samsaraService");

router.get("/track/:factura", async (req, res) => {
    try {
        const factura = decodeURIComponent(
            String(req.params.factura || "")
        )
            .trim()
            .replace(/\s+/g, "");

        console.log("Consulta pública /track para factura:", factura);

        const datosFactura = buscarFactura(factura);

        if (!datosFactura) {
            return res.status(404).send(`
                <h2>Factura no encontrada</h2>
                <p>No se encontró información para la factura: ${factura}</p>
            `);
        }

        const infoSamsara = await obtenerGPSUnidad(datosFactura.Unidad);

        if (!infoSamsara || !infoSamsara.gpsDisponible) {
            return res.status(404).send(`
                <h2>Ubicación no disponible</h2>
                <p>La factura fue encontrada, pero no se pudo obtener ubicación GPS.</p>
                <p><strong>Factura:</strong> ${datosFactura.Factura || factura}</p>
                <p><strong>Unidad:</strong> ${datosFactura.Unidad || "Sin dato"}</p>
            `);
        }

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Seguimiento AFC</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

    <style>
        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f4f6f8;
            color: #1f2937;
        }

        .header {
            background: #003366;
            color: white;
            padding: 16px;
            text-align: center;
        }
        .logo {
            max-width: 180px;
            margin-bottom: 10px;
        }
        .header h2 {
            margin: 0;
        }

        .info {
            padding: 16px;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .info p {
            margin: 6px 0;
        }

        #map {
            height: 70vh;
            width: 100%;
        }

        .footer {
            padding: 10px;
            font-size: 12px;
            text-align: center;
            background: #f9fafb;
            color: #6b7280;
        }
    </style>
</head>
<body>

<div class="header">
    <img src="/img/logo-afc.png" class="logo" alt="AFC" />
    <h2>Seguimiento AFC</h2>
    <p>Factura ${datosFactura.Factura || factura}</p>
</div>

    <div class="info">
        <p><strong>Cliente:</strong> ${datosFactura.Cliente || "Sin dato"}</p>
        <p><strong>Origen:</strong> ${datosFactura.Origen || "Sin dato"}</p>
        <p><strong>Destino:</strong> ${datosFactura.Destino || "Sin dato"}</p>
        <p><strong>Unidad:</strong> ${datosFactura.Unidad || "Sin dato"}</p>
        <p><strong>Remolque:</strong> ${datosFactura.Remolque || "Sin dato"}</p>
        <p><strong>Chofer:</strong> ${datosFactura.Chofer || "Sin dato"}</p>
        <p><strong>Ubicación:</strong> ${infoSamsara.direccion}</p>
        <p><strong>Velocidad:</strong> ${infoSamsara.velocidad || 0} mph</p>
        <p><strong>Última actualización:</strong> ${infoSamsara.tiempo}</p>
    </div>

    <div id="map"></div>

    <div class="footer">
        Información proporcionada por Autofletes Chihuahua. Consulta pública controlada.
    </div>

    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

    <script>
        const lat = ${infoSamsara.latitud};
        const lng = ${infoSamsara.longitud};

        const map = L.map("map").setView([lat, lng], 15);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "AFC - Autofletes Chihuahua"
        }).addTo(map);

        L.marker([lat, lng])
            .addTo(map)
            .bindPopup("Unidad ${datosFactura.Unidad || ""}")
            .openPopup();
    </script>

</body>
</html>
`;

        return res.send(html);

    } catch (error) {
        console.error("Error en /track:", error.message);

        return res.status(500).send(`
            <h2>Error consultando seguimiento</h2>
            <p>No fue posible consultar la ubicación en este momento.</p>
        `);
    }
});

module.exports = router;