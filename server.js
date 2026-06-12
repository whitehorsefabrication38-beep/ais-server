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

  aisSocket.send(JSON.stringify(subscription));
});

aisSocket.on("message", (data) => {
  try {
    console.log("RAW AIS:", data);

    const msg = JSON.parse(data);

    if (msg.MessageType === "PositionReport") {
      const ship = msg.Message.PositionReport;

      const clean = {
        mmsi: ship.UserID,
        lat: ship.Latitude,
        lon: ship.Longitude,
        speed: ship.Speed,
        course: ship.Course
      };

      // send to Wix
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
   
