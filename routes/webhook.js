const express = require("express");

const router = express.Router();

router.get("/webhook", (req, res) => {
    res.send("Webhook AFC activo");
});

router.post("/webhook", (req, res) => {
    console.log("POST recibido desde Meta");
    console.log(JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
});

module.exports = router;