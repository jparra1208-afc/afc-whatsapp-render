require("dotenv").config();

const express = require("express");
const cors = require("cors");

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

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Servidor AFC activo puerto ${PORT}`);
});