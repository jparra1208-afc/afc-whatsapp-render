require("dotenv").config();

const { obtenerLiveShareUnidad } = require("./samsaraLiveShareService");

console.log("Token Samsara existe:", process.env.SAMSARA_API_TOKEN ? "SI" : "NO");

async function probarRemolque() {
    try {
        const link = await obtenerLiveShareUnidad("558");

        console.log("Live Sharing 558:");
        console.log(link || "NO ENCONTRADO");
    } catch (error) {
        console.log(error.response?.data || error.message);
    }
}

probarRemolque();