const mongoose = require("mongoose");

const DeviceStatusSchema = new mongoose.Schema({
  hardwareId: String,
  pin: Number,
  online: Boolean,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("DeviceStatus", DeviceStatusSchema);
