const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.static('public'));

let db = { users: {} }; 

// WhatsApp Connection Function
async function startWhatsApp(num) {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${num}`);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "open") {
            if (db.users[num]) db.users[num].status = "Connected";
        }
        if (connection === "close") {
            if (db.users[num]) db.users[num].status = "Disconnected";
            startWhatsApp(num); // Auto reconnect
        }
    });
}

// Route to get Pairing Code
app.get("/get-code", async (req, res) => {
    let num = req.query.number.replace(/[^0-9]/g, '');
    if (!num) return res.send({ error: "Invalid Number" });

    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${num}`);
    const sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }) });

    try {
        await delay(2000);
        const code = await sock.requestPairingCode(num);
        db.users[num] = { number: num, balance: 0, status: "Waiting...", joined: new Date().toLocaleString() };
        res.send({ code: code });
        startWhatsApp(num);
    } catch (e) {
        res.send({ error: "Server Error" });
    }
});

app.get("/admin-stats", (req, res) => res.send(db.users));

// Automatic Earning (Rs. 2 every minute)
setInterval(() => {
    for (let n in db.users) {
        if (db.users[n].status === "Connected") db.users[n].balance += 2;
    }
}, 60000);

app.listen(3000, () => console.log("Server Live"));
