const express = require("express");
const router = express.Router();
const Measurement = require("../models/Measurement");

router.post("/data", async (req, res) => {
  const { sensorId, tempC, voltageV } = req.body;

  if (!sensorId || tempC == null || voltageV == null) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  await Measurement.create({
    sensorId,
    tempC,
    voltageV,
  });

  res.sendStatus(201);
});

module.exports = router;
