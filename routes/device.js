const express = require("express");
const router = express.Router();
const Sensor = require("../models/Sensor");

router.get("/config", async (_req, res) => {
  const sensors = await Sensor.find({ enabled: true })
    .select("hardwareId pin -_id");

  res.json(sensors);
});

module.exports = router;
