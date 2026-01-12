const express = require("express");
const router = express.Router();
const Measurement = require("../models/Measurement");

router.get("/history", async (req, res) => {
  const { sensorId, limit = 100 } = req.query;

  if (!sensorId) {
    return res.status(400).json({ error: "sensorId requerido" });
  }

  const history = await Measurement.find({ sensorId })
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  res.json(history);
});

module.exports = router;
