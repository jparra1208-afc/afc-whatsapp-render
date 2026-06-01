const fs = require("fs");
const path = require("path");

const archivo = path.join(__dirname, "..", "logs", "consultas.csv");

async function registrarConsulta(data) {
    try {
        const linea = [
            new Date().toISOString(),
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
        fs.appendFileSync(archivo, linea, "utf8");

        console.log("✅ Consulta registrada en CSV");
    } catch (error) {
        console.error("❌ Error registrando consulta:", error.message);
    }
}

module.exports = { registrarConsulta };