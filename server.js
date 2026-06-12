const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

// IMPORTANT: Render port fix
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log("AIS Server running on port", PORT);
});

// WebSocket server for Wix frontend
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on("connection", (ws) => {
  console.log("Wix client connected");
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

// ===============================
// AIS STREAM CONNECTION (CLEAN)
// ===============================

const aisSocket = new WebSocket("wss://stream.aisstream.io/v0/stream");

aisSocket.on("open", () => {
  console.log("Connected to AISStream");

  const subscription = {
    APIKey: process.env.AISSTREAM_KEY,
    BoundingBoxes: [
      [
        [40, -75],
        [50, -55]
      ]
    ]
  };
console.log("Sending subscription:", JSON.stringify(subscription));
  aisSocket.send(JSON.stringify(subscription));
});
aisSocket.on("error", (err) => {
  console.log("AISSocket error:", err);
});

aisSocket.on("close", (code, reason) => {
  console.log("AISSocket closed:", code, reason.toString());
});
aisSocket.on("message", (data) => {
  try {
    const text = data.toString(); // <-- FIX IS HERE

    console.log("RAW AIS:", text);

    const msg = JSON.parse(text);

    console.log("MESSAGE TYPE:", msg.MessageType);

    if (
      msg.MessageType === "PositionReport" &&
      msg.Message?.PositionReport
    ) {
      const ship = msg.Message.PositionReport;

      const clean = {
        mmsi: ship.UserID,
        lat: ship.Latitude,
        lon: ship.Longitude,
        speed: ship.Speed,
        course: ship.Course
      };

      clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify(clean));
        }
      });
    }

  } catch (err) {
    console.log("Parse error:", err.message);
  }
});
