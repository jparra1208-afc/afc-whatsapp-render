require("dotenv").config();
const axios = require("axios");

console.log("🚀 Iniciando prueba Live Sharing");
console.log("Token Samsara existe:", process.env.SAMSARA_API_TOKEN ? "SI" : "NO");

async function probarLiveSharing() {
    try {
        const response = await axios.get(
            "https://api.samsara.com/live-shares",
            {
                headers: {
                    Authorization: `Bearer ${process.env.SAMSARA_API_TOKEN}`
                }
            }
        );

        console.log("✅ RESPUESTA:");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log("❌ ERROR:");
        console.log(error.response?.data || error.message);
    }
}

probarLiveSharing();