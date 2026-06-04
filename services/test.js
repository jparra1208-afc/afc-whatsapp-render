require("dotenv").config();
console.log("Token cargado:", process.env.SAMSARA_API_TOKEN ? "SI" : "NO");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

console.log("Token Samsara existe:", process.env.SAMSARA_API_TOKEN ? "SI" : "NO");

async function exportarLiveSharing() {
    try {
        let todos = [];
        let after = null;
        let hasNextPage = true;

        while (hasNextPage) {
            const response = await axios.get(
                "https://api.samsara.com/live-shares",
                {
                    headers: {
                        Authorization: `Bearer ${process.env.SAMSARA_API_TOKEN}`
                    },
                    params: after ? { after } : {}
                }
            );

            todos.push(...response.data.data);

            hasNextPage = response.data.pagination?.hasNextPage || false;
            after = response.data.pagination?.endCursor;
        }

        const csv = [
            "Unidad,Descripcion,LiveSharingUrl"
        ];

        todos.forEach(l => {
            csv.push(
                `"${l.name}","${l.description || ""}","${l.liveSharingUrl}"`
            );
        });

        fs.writeFileSync(
            "live-sharing-samsara.csv",
            csv.join("\n"),
            "utf8"
        );

        console.log(`Links encontrados: ${todos.length}`);
        console.log("Archivo generado en:");
        console.log(path.resolve("live-sharing-samsara.csv"));

    } catch (error) {
        console.log("❌ Error exportando Live Sharing:");
        console.log(error.response?.data || error.message);
    }
}

exportarLiveSharing();