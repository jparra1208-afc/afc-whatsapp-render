require("dotenv").config();

const express = require("express");

const router = express.Router();


// VALIDACIÓN META WEBHOOK
router.get("/webhook", (req, res) => {

    const verify_token = process.env.VERIFY_TOKEN;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {

        if (mode === "subscribe" && token === verify_token) {

            console.log("WEBHOOK VERIFICADO");

            return res.status(200).send(challenge);

        } else {

            return res.sendStatus(403);

        }

    }

});


// RECIBIR MENSAJES
router.post("/webhook", async (req, res) => {

    console.log("Mensaje recibido:");

    console.log(JSON.stringify(req.body, null, 2));

    res.sendStatus(200);

});

module.exports = router;