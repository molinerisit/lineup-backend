require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const QuickChart = require("quickchart-js");

const Measurement = require("./models/Measurement");
const Sensor = require("./models/Sensor");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3000;

// Estado en memoria para el Heartbeat del ESP32
let lastDeviceStatus = {
  online: false,
  ip: "--",
  mapping: [],
  timestamp: null,
};

const ESP_HARDWARE_IDS = [
  "HELADERA-01",
  "HELADERA-02",
  "HELADERA-03",
  "HELADERA-04",
  "HELADERA-05",
];

// ==========================================
// CONEXIÓN A BASE DE DATOS
// ==========================================
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/trazabilidadDB"
  )
  .then(() => console.log("✅ MongoDB Conectado"))
  .catch((err) => console.error("❌ Error Mongo:", err));

app.use(express.json());
app.use(cors({ origin: "*" }));

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ==========================================
// FUNCIONES DE ENVÍO WHATSAPP (ESTABLES)
// ==========================================

const responderWhatsApp = async (number, text) => {
  try {
    await axios.post(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      {
        number: number,
        text: text,
      },
      { headers: { apikey: process.env.EVOLUTION_API_KEY } }
    );
  } catch (error) {
    console.error("❌ Error enviando texto:", error.message);
  }
};

const responderWhatsAppConImagen = async (number, imageUrl, caption = "") => {
  try {
    await axios.post(
      `${process.env.EVOLUTION_API_URL}/message/sendImage/${process.env.EVOLUTION_INSTANCE}`,
      {
        number: number,
        url: imageUrl,
        caption: caption,
      },
      { headers: { apikey: process.env.EVOLUTION_API_KEY } }
    );
  } catch (error) {
    console.error("❌ Error enviando imagen:", error.message);
  }
};

const sendWhatsAppAlert = async (number, sensorName, temp) => {
  // Cambiamos de botones a Texto Formateado para evitar el Error 400
  const mensaje =
    `🚨 *ALERTA DE TEMPERATURA*\n\n` +
    `📍 *Equipo:* ${sensorName}\n` +
    `🌡️ *Temperatura:* ${temp}°C\n\n` +
    `⚠️ _El límite ha sido superado._\n` +
    `👉 Escribe *Estado* para ver todos tus equipos.`;

  await responderWhatsApp(number, mensaje);
};

// ==========================================
// RUTA DE DATOS (ESP32)
// ==========================================

app.post("/api/data", async (req, res) => {
  const { sensorId, tempC, voltageV } = req.body;
  try {
    const sensor = await Sensor.findOne({ hardwareId: sensorId }).populate(
      "owner"
    );
    if (!sensor) return res.status(404).send("Sensor no configurado");

    await new Measurement({
      sensorId,
      temperatureC: Number(tempC),
      voltageV: Number(voltageV),
    }).save();

    if (tempC > sensor.alertThreshold && sensor.owner?.whatsapp) {
      const ahora = new Date();
      const cooldownMs = (process.env.ALERT_COOLDOWN || 30) * 60000;

      if (!sensor.lastAlertSent || ahora - sensor.lastAlertSent > cooldownMs) {
        await sendWhatsAppAlert(
          sensor.owner.whatsapp,
          sensor.friendlyName,
          tempC
        );
        sensor.lastAlertSent = ahora;
        await sensor.save();
      } else {
        console.log(`⏳ Cooldown activo para ${sensor.friendlyName}`);
      }
    }
    res.send("OK");
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ==========================================
// WEBHOOK UNIFICADO (BOT INTELIGENTE)
// ==========================================

app.post("/api/webhook/whatsapp", async (req, res) => {
  try {
    const data = req.body.data;
    if (!data.message) return res.sendStatus(200);

    const text = (
      data.message.conversation ||
      data.message.extendedTextMessage?.text ||
      ""
    )
      .toLowerCase()
      .trim();

    const from = data.key.remoteJid.split("@")[0];
    const user = await User.findOne({ whatsapp: from });
    if (!user) return res.sendStatus(200);

    console.log(`💬 Comando recibido: ${text}`);

    // COMANDO: ESTADO
    if (text === "estado") {
      const sensors = await Sensor.find({ owner: user._id, enabled: true });
      let reporte = `📋 *REPORTE DE EQUIPOS*\n\n`;
      for (const s of sensors) {
        const lastM = await Measurement.findOne({
          sensorId: s.hardwareId,
        }).sort({ timestamp: -1 });
        const temp = lastM ? `${lastM.temperatureC}°C` : "N/A";
        const icon =
          lastM && lastM.temperatureC > s.alertThreshold ? "🔴" : "🟢";
        reporte += `${icon} *${s.friendlyName}*: ${temp}\n`;
      }
      await responderWhatsApp(from, reporte);
    }

    // COMANDO: HISTORIAL
    if (text.startsWith("historial")) {
      const busqueda = text.replace("historial", "").trim();
      const sensor = await Sensor.findOne({
        owner: user._id,
        friendlyName: { $regex: new RegExp(busqueda, "i") },
      });

      if (sensor) {
        const docs = await Measurement.find({ sensorId: sensor.hardwareId })
          .sort({ timestamp: -1 })
          .limit(10);
        if (docs.length > 0) {
          const chart = new QuickChart();
          chart.setConfig({
            type: "line",
            data: {
              labels: docs
                .map((m) => new Date(m.timestamp).toLocaleTimeString())
                .reverse(),
              datasets: [
                {
                  label: "Temperatura °C",
                  data: docs.map((m) => m.temperatureC).reverse(),
                  borderColor: "blue",
                  fill: true,
                  backgroundColor: "rgba(0,0,255,0.1)",
                },
              ],
            },
          });
          await responderWhatsAppConImagen(
            from,
            chart.getUrl(),
            `📊 Historial: ${sensor.friendlyName}`
          );
        }
      } else {
        await responderWhatsApp(from, `❌ No encontré el equipo "${busqueda}"`);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

// ==========================================
// RUTAS RESTANTES (LOGIN, REGISTRO, PERFIL)
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ message: "Usuario creado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }
  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET
  );
  res.json({ token, username: user.username });
});

app.get("/api/latest", authenticateToken, async (req, res) => {
  try {
    const data = await Sensor.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(req.user.id),
          enabled: true,
        },
      },
      {
        $lookup: {
          from: "measurements",
          localField: "hardwareId",
          foreignField: "sensorId",
          as: "m",
        },
      },
      { $unwind: { path: "$m", preserveNullAndEmptyArrays: true } },
      { $sort: { "m.timestamp": -1 } },
      {
        $group: {
          _id: "$hardwareId",
          friendlyName: { $first: "$friendlyName" },
          alertThreshold: { $first: "$alertThreshold" },
          temperatureC: { $first: "$m.temperatureC" },
          voltageV: { $first: "$m.voltageV" },
          timestamp: { $first: "$m.timestamp" },
        },
      },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/api/sensors/config", authenticateToken, async (req, res) => {
  try {
    const sensorData = { ...req.body, owner: req.user.id, enabled: true };
    const sensor = await Sensor.findOneAndUpdate(
      { hardwareId: req.body.hardwareId },
      sensorData,
      { upsert: true, new: true }
    );
    res.json(sensor);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar" });
  }
});

app.get("/api/auth/profile", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

app.put("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const { whatsapp, oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch)
        return res.status(401).json({ message: "Contraseña incorrecta" });
      user.password = newPassword;
    }
    if (whatsapp) user.whatsapp = whatsapp;
    await user.save();
    res.json({ message: "Perfil actualizado" });
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get("/api/history", authenticateToken, async (req, res) => {
  const { sensorId, limit = 100 } = req.query;
  const sensor = await Sensor.findOne({
    hardwareId: sensorId,
    owner: req.user.id,
  });
  if (!sensor) return res.status(403).send("No autorizado");
  const docs = await Measurement.find({ sensorId })
    .sort({ timestamp: -1 })
    .limit(Number(limit));
  res.json(docs);
});

app.delete("/api/sensors/:hardwareId", authenticateToken, async (req, res) => {
  await Sensor.deleteOne({
    hardwareId: req.params.hardwareId,
    owner: req.user.id,
  });
  await Measurement.deleteMany({ sensorId: req.params.hardwareId });
  res.json({ message: "Eliminado" });
});

app.get("/api/sensors/ids", authenticateToken, (req, res) =>
  res.json(ESP_HARDWARE_IDS)
);
app.get("/api/device/status", authenticateToken, (req, res) =>
  res.json(lastDeviceStatus)
);

app.listen(PORT, () =>
  console.log(`🚀 Servidor inteligente activo en puerto ${PORT}`)
);
