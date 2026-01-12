const mongoose = require('mongoose');

const MeasurementSchema = new mongoose.Schema({
    sensorId: {
        type: String,
        required: true,
        index: true 
    },
    temperatureC: {
        type: Number,
        required: true
    },
    voltageV: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model('Measurement', MeasurementSchema);