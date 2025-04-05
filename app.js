// app.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Chess } = require('chess.js');
const socket = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socket(server, {
    cors: {
        origin: "https://real-time-chess.onrender.com",
        methods: ["GET", "POST"]
    },
    secure: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

const chess = new Chess();
let players = {
    white: { id: null, name: "White Player" },
    black: { id: null, name: "Black Player" }
};

// Set up view engine and static files
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Tracking disconnected players and allowing reconnections for 30 seconds
const reconnectionTimeout = 30000;

// Handle socket connections
io.on("connection", (mainsocket) => {
    console.log("A user connected: ",  mainsocket.id);

    if (!players.white.id) {
        players.white.id = mainsocket.id;
        players.white.name = `Player ${Math.floor(Math.random() * 1000)}`;
        mainsocket.emit("currentPlayer", "w");
        io.emit("updatePlayers", players);
    } else if (!players.black.id) {
        players.black.id = mainsocket.id;
        players.black.name = `Player ${Math.floor(Math.random() * 1000)}`;
        mainsocket.emit("currentPlayer", "b");
        io.emit("updatePlayers", players);
    } else {
        mainsocket.emit("spectatorView");
    }

    mainsocket.on("disconnect", () => {
        if (mainsocket.id === players.white.id) {
            setTimeout(() => {
                if (!players.white.id) delete players.white;
                io.emit("updatePlayers", players);                
            }, reconnectionTimeout)
        } else if (mainsocket.id === players.black.id) {
            setTimeout(() => {
                if (!players.black.id) delete players.black;
                io.emit("updatePlayers", players);                
            }, reconnectionTimeout)
        }
        console.log("A user disconnected: ", mainsocket.id);
    });

    mainsocket.on("move", (move) => {
        console.log('Received move from client', move);
        if (!isValidGameState(chess, move)) {
            mainsocket.emit("invalidGameState");
            return;
        }
        try {
            if ((chess.turn() === 'w' && mainsocket.id !== players.white.id) || 
                (chess.turn() === 'b' && mainsocket.id !== players.black.id)) return;

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
            mainsocket.broadcast.emit("wrongMove", move);
        }
    });

    mainsocket.on("resign", () => {
        const player = mainsocket.id === players.white.id ? "White" : "Black";
        const winner = player === "White" ? "Black" : "White";
        io.emit("gameEnd", { type: "resign", player, winner });
    });
    
    mainsocket.on("drawOffer", () => {
        const player = mainsocket.id === players.white.id ? "White" : "Black";
        io.emit("drawOffer", player);
    });
    
    mainsocket.on("drawAccepted", () => {
        io.emit("gameEnd", { type: "draw" });
    });
});

// Serve the main page
app.get("/", (req, res) => {
    res.render("index", { title: "RealTime Chess" });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});