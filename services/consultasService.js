const fs = require("fs");
const path = require("path");

const archivo = path.join(__dirname, "..", "logs", "consultas.csv");

async function registrarConsulta(data) {
    try {
        const linea = [
    new Date().toLocaleString("es-MX", {
        timeZone: "America/Chihuahua",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).replace(",", ""),
    data.telefono || "",
    data.cliente || "",
    data.factura || "",
    data.unidad || "",
    data.remolque || "",
    data.consulta_tipo || "FACTURA",
    data.resultado || "",
    data.link_samsara || ""
]
        .map(valor => `"${String(valor).replace(/"/g, '""')}"`)
        .join(",") + "\n";
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        console.log("📁 Archivo CSV:", archivo);
        console.log("📝 Datos recibidos:", data);
        fs.appendFileSync(archivo, linea, "utf8");
        
        console.log("✅ Consulta registrada en CSV");
    } catch (error) {
        console.error("❌ Error registrando consulta:", error.message);
    }
}

module.exports = { registrarConsulta };