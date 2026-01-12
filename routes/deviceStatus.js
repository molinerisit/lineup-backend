const express = require('express');
const router = express.Router();
const DeviceStatus = require('../models/DeviceStatus');

router.post('/status', async (req, res) => {
  const { hardwareId, pin, online } = req.body;

  if (!hardwareId || pin === undefined) {
    return res.status(400).json({ error: 'hardwareId y pin requeridos' });
  }

  const status = await DeviceStatus.findOneAndUpdate(
    { hardwareId },
    {
      hardwareId,
      pin,
      online: online ?? true,
      lastSeen: new Date()
    },
    { upsert: true, new: true }
  );

  res.json(status);
});

router.get('/status', async (req, res) => {
  const data = await DeviceStatus.find();
  res.json(data);
});

module.exports = router;
