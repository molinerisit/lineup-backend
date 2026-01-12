const mongoose = require("mongoose");

const sensorSchema = new mongoose.Schema(
  {
    hardwareId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    friendlyName: {
      type: String,
      required: true,
    },
    alertThreshold: {
      type: Number,
      default: 5.0,
    },
    voltageThreshold: {
      type: Number,
      default: 4.2,
    },
    pin: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      default: null, // Se llena automáticamente cuando el ESP32 sincroniza
    },
    lastAlertSent: { type: Date }, // <--- AGREGAR ESTO
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sensor", sensorSchema);
