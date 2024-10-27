const path = require('path');

const express = require('express');

const app = express();
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

    mainsocket.on("disconnected", function(){
        if(mainsocket.id == players.white){
            delete players.white;
        }
        else if(mainsocket.id == players.black){
            delete players.black;
        }
    });

    mainsocket.on("move", (move)=>{
        console.log(move);
        try{
            if(chess.turn() == 'w' && !mainsocket.id == players.white) return;
            if(chess.turn() == 'b' && !mainsocket.id == players.black) return;

            const result = chess.move(move);
            if(result){
                presentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardPosition", chess.fen());
            }
            else{
                console.log("Wrong move:", move);
                socket.emit("wrongMove", move);
            }
        }
        catch(err){
            console.log(err);
            socket.emit("Wrong move: ", move);
            socket.em
        }
    });
});

app.get("/", (req, res) => {
    res.render("index", {title: "RealTime Chess"});
})

server.listen(3000, function() {
    console.log("Server Running");
});