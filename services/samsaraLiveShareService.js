const axios = require("axios");

async function obtenerLiveShareUnidad(unidad) {
    try {
        let todosLosLinks = [];
        let after = null;
        let hasNextPage = true;

        while (hasNextPage) {
            const params = {};

            if (after) {
                params.after = after;
            }

            const response = await axios.get(
                "https://api.samsara.com/live-shares",
                {
                    headers: {
                        Authorization: `Bearer ${process.env.SAMSARA_API_TOKEN}`
                    },
                    params
                }
            );

            const data = response.data?.data || [];
            todosLosLinks = todosLosLinks.concat(data);

            hasNextPage = response.data?.pagination?.hasNextPage || false;
            after = response.data?.pagination?.endCursor || null;
        }

        const unidadBuscada = String(unidad).trim();

        const link = todosLosLinks.find(l =>
            String(l.name || "").trim() === unidadBuscada ||
            String(l.description || "").trim() === unidadBuscada ||
            String(l.name || "").trim().startsWith(unidadBuscada + " ")
        );

        console.log(`Live Sharing buscado para unidad ${unidadBuscada}:`, link?.liveSharingUrl || "NO ENCONTRADO");

        return link?.liveSharingUrl || null;

    } catch (error) {
        console.error(
            "Error obteniendo Live Share:",
            error.response?.data || error.message
        );

        return null;
    }
}

module.exports = { obtenerLiveShareUnidad };