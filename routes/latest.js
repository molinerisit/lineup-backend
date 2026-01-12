const express = require("express");
const router = express.Router();
const Measurement = require("../models/Measurement");

router.get("/latest", async (_req, res) => {
  const data = await Measurement.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$sensorId",
        tempC: { $first: "$tempC" },
        voltageV: { $first: "$voltageV" },
        createdAt: { $first: "$createdAt" },
      }
    }
  ]);

  res.json(data);
});

module.exports = router;
