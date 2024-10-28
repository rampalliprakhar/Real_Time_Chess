const path = require('path');

const express = require('express');

const app = express();
const port = 3000;
const http = require('http');
const {Chess} = require('chess.js');
const socket = require('socket.io');
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {}
let presentPlayer = "w";


app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", function(mainsocket) {
    console.log("Connected");

    if(!players.white){
        players.white = mainsocket.id;
        mainsocket.emit("currentPlayer", "w");
    } 
    else if(!players.black){
        players.black = mainsocket.id;
        mainsocket.emit("currentPlayer", "b");
    }
    else{
        mainsocket.emit("spectatorView");
    }

    mainsocket.on("disconnect", function(){ // Changed from "disconnected" to "disconnect"
        if(mainsocket.id == players.white){
            delete players.white;
        }
        else if(mainsocket.id == players.black){
            delete players.black;
        }
    });

    mainsocket.on("move", (move) => {
        console.log(move);
        try {
            // Corrected player turn checks
            if ((chess.turn() == 'w' && mainsocket.id !== players.white) || 
                (chess.turn() == 'b' && mainsocket.id !== players.black)) return;
    
            const result = chess.move(move);
            if (result) {
                presentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardPosition", chess.fen());
    
                // Emit the current turn after a move
                io.emit("currentTurn", chess.turn()); // Emit the current turn
    
                // Check for game over or player elimination
                if (chess.isGameOver()) {
                    const winner = chess.turn() === 'w' ? 'b' : 'w'; // Determine the winner
                    io.emit("playerWon", winner); // Emit the winner to all clients
                }
            } else {
                console.log("Wrong move:", move);
                mainsocket.emit("wrongMove", move); // Corrected to mainsocket
            }
        } catch (err) {
            console.log(err);
            mainsocket.emit("wrongMove", move); // Corrected to mainsocket
        }
    });
});

app.get("/", (req, res) => {
    res.render("index", {title: "RealTime Chess"});
})

server.listen(port, function() {
    console.log(`Server Running on http://localhost:${port}`);
});