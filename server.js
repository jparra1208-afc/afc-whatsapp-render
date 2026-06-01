require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path"); // <-- AGREGAR

const webhookRoutes = require("./routes/webhook");
const uploadReporteRoutes = require("./routes/uploadReporte");
const trackRoutes = require("./routes/track");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.use("/", webhookRoutes);
app.use("/", uploadReporteRoutes);
app.use("/", trackRoutes);

// ===============================
// DESCARGAR CSV DE CONSULTAS
// ===============================
app.get("/consultas-csv", (req, res) => {
    const archivo = path.join(__dirname, "logs", "consultas.csv");

    res.download(archivo, "consultas.csv", (err) => {
        if (err) {
            console.error("Error descargando CSV:", err.message);
            res.status(404).send("Archivo no encontrado");
        }
    });
});
// ===============================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Servidor AFC activo puerto ${PORT}`);
});