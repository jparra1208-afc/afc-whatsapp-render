require("dotenv").config();

const express = require("express");
const cors = require("cors");

const webhookRoutes = require("./routes/webhook");
const uploadReporteRoutes = require("./routes/uploadReporte");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", webhookRoutes);
app.use("/", uploadReporteRoutes);

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

    console.log(`Servidor AFC activo puerto ${PORT}`);

});