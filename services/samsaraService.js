const axios = require("axios");

function normalizar(valor) {
    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

async function obtenerGPSUnidad(unidadBuscada) {
    const unidadNormalizada = normalizar(unidadBuscada);

    const response = await axios.get(
        "https://api.samsara.com/fleet/vehicles/stats/feed",
        {
            headers: {
                Authorization: `Bearer ${process.env.SAMSARA_API_TOKEN}`
            },
            params: {
                types: "gps"
            }
        }
    );

    const vehiculos = response.data.data || [];
    console.log("Unidad buscada en Samsara:", unidadNormalizada);
    console.log("Total vehículos Samsara:", vehiculos.length);
    console.log("Primeros vehículos Samsara:", vehiculos.slice(0, 20).map(v => v.name));
    const vehiculo = vehiculos.find(v => {
        return normalizar(v.name).includes(unidadNormalizada);
    });

    if (!vehiculo) {
        return null;
    }

    const gps = vehiculo.gps?.[0];

    if (!gps) {
        return {
            nombre: vehiculo.name,
            id: vehiculo.id,
            encontrado: true,
            gpsDisponible: false
        };
    }

    return {
        nombre: vehiculo.name,
        id: vehiculo.id,
        encontrado: true,
        gpsDisponible: true,
        latitud: gps.latitude,
        longitud: gps.longitude,
        velocidad: gps.speedMilesPerHour,
        direccion: gps.reverseGeo?.formattedLocation || "Sin dirección",
        tiempo: gps.time,
        mapa: `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`
    };
}

module.exports = {
    obtenerGPSUnidad
};