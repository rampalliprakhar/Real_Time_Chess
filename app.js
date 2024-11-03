// app.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Chess } = require('chess.js');
const socket = require('socket.io');

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};

// Set up view engine and static files
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Handle socket connections
io.on("connection", (mainsocket) => {
    console.log("Connected");

    if (!players.white) {
        players.white = mainsocket.id;
        mainsocket.emit("currentPlayer", "w");
    } else if (!players.black) {
        players.black = mainsocket.id;
        mainsocket.emit("currentPlayer", "b");
    } else {
        mainsocket.emit("spectatorView");
    }

    mainsocket.on("disconnect", () => {
        if (mainsocket.id === players.white) {
            delete players.white;
        } else if (mainsocket.id === players.black) {
            delete players.black;
        }
    });

    mainsocket.on("move", (move) => {
        console.log(move);
        try {
            if ((chess.turn() === 'w' && mainsocket.id !== players.white) || 
                (chess.turn() === 'b' && mainsocket.id !== players.black)) return;

            const result = chess.move(move);
            if (result) {
                io.emit("move", move);
                io.emit("boardPosition", chess.fen());
                io.emit("currentTurn", chess.turn());

                if (chess.isGameOver()) {
                    const winner = chess.turn() === 'w' ? 'b' : 'w';
                    io.emit("playerWon", winner);
                }
            } else {
                console.log("Wrong move:", move);
                mainsocket.emit("wrongMove", move);
            }
        } catch (err) {
            console.log(err);
            mainsocket.emit("wrongMove", move);
        }
    });
});

// Serve the main page
app.get("/", (req, res) => {
    res.render("index", { title: "RealTime Chess" });
});

// Start the server
server.listen(port, () => {
    console.log(`Server Running on http://localhost:${port}`);
});