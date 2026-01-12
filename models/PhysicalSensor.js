const mongoose = require("mongoose");

const PhysicalSensorSchema = new mongoose.Schema({
  address: { type: String, unique: true },
  pin: Number,
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PhysicalSensor", PhysicalSensorSchema);
