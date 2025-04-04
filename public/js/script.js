const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const statusElement = document.getElementById("status");
const eliminationStatusElement = document.getElementById("eliminationStatus");

class ChessGame {
    constructor() {
        this.game = new Chess();
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        this.timers = {
            w: new GameTimer(300, 'white-time'),
            b: new GameTimer(300, 'black-time')
        };
        this.playerRole = null;
        this.draggedPiece = null;
        this.sourceSquare = null;
        this.availableMoves = [];
    }

    start() {
        this.renderBoard();
        this.setupSocketListeners();
        this.timers.w.start();
    }

    renderBoard() {
        const board = this.game.board();
        // Clear the board before rendering
        boardElement.innerHTML = ""; 

        board.forEach((row, rowIndex) => {
            row.forEach((square, colIndex) => {
                const squareElement = this.createSquareElement(rowIndex, colIndex, square);
                boardElement.appendChild(squareElement);
            });
        });

        this.updateBoardOrientation();
    }

    checkGameOver() {
        if (this.game.in_checkmate()) {
            alert("Checkmate! Game over.");
        } else if (this.game.in_stalemate()) {
            alert("Stalemate! Game over.");
        }
    }

    createSquareElement(rowIndex, colIndex, square) {
        const squareElement = document.createElement("div");
        squareElement.classList.add("square", (rowIndex + colIndex) % 2 === 0 ? "light" : "dark");
        squareElement.dataset.row = rowIndex;
        squareElement.dataset.column = colIndex;

        if (square) {
            const pieceElement = this.createPieceElement(square);
            squareElement.appendChild(pieceElement);
        }

        squareElement.addEventListener("dragover", (e) => e.preventDefault());
        squareElement.addEventListener("drop", (e) => this.handleDrop(e, rowIndex, colIndex));
        squareElement.addEventListener("touchstart", (e) => this.handleTouchStart(e, { row: rowIndex, col: colIndex }));
        squareElement.addEventListener("touchend", (e) => this.handleTouchEnd(e, rowIndex, colIndex));
        squareElement.addEventListener("dragstart", (e) => this.handleDragStart(e, { row: rowIndex, col: colIndex }));

        return squareElement;
    }

    createPieceElement(square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
        pieceElement.innerText = this.getPieceUnicode(square);
        pieceElement.draggable = this.playerRole === square.color;

        pieceElement.dataset.row = square.row;
        pieceElement.dataset.col = square.col;

        pieceElement.addEventListener("touchstart", (e) => {
            if (this.playerRole === square.color) {
                this.handlePieceTap(e, {
                    row: parseInt(pieceElement.closest('.square').dataset.row),
                    col: parseInt(pieceElement.closest('.square').dataset.column)
                });
            }
        });

        return pieceElement;
    }

    handleMove(source, target) {
        if (!source || !target) return false;

        const piece = this.game.get(`${String.fromCharCode(97 + source.col)}${8 - source.row}`);
        if (!piece || piece.color !== this.playerRole) return false;

        const move = {
            from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
            to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
            promotion: 'q'
        };

        const result = this.game.move(move);
        if (result) {
            this.moveHistory.push(move);
            this.updateCapturedPieces(result);
            this.switchTimer();
            this.updateMoveHistory();
            socket.emit('move', move);
            this.renderBoard();
            return true;
        }

        return false;
    }

    updateCapturedPieces(moveResult) {
        if (moveResult.captured) {
            const color = moveResult.color === 'w' ? 'b' : 'w';
            this.capturedPieces[color].push(moveResult.captured);
            this.renderCapturedPieces();
        }
    }

    updateMoveHistory() {
        const movesContainer = document.getElementById('moves-list');
        const moveNumber = Math.floor((this.moveHistory.length + 1) / 2);
        const move = this.moveHistory[this.moveHistory.length - 1];
        const moveElement = document.createElement('div');
        moveElement.textContent = `${moveNumber}. ${move}`;
        movesContainer.appendChild(moveElement);
        movesContainer.scrollTop = movesContainer.scrollHeight;
    }

    switchTimer() {
        const currentColor = this.game.turn();
        this.timers[currentColor === 'w' ? 'b' : 'w'].stop();
        this.timers[currentColor].start();
    }

    renderCapturedPieces() {
        ['w', 'b'].forEach(color => {
            const container = document.getElementById(`${color === 'w' ? 'white' : 'black'}-captured`);
            container.innerHTML = this.capturedPieces[color]
                .map(piece => this.getPieceUnicode({ type: piece, color }))
                .join(' ');
        });
    }

    setupSocketListeners() {
        socket.on("updatePlayers", (players) => {
            document.getElementById("white-player").textContent = players.white.name;
            document.getElementById("black-player").textContent = players.black.name;
        });

        socket.on("currentPlayer", (role) => {
            this.playerRole = role;
            statusElement.innerText = `Current Turn: ${role === 'w' ? 'White' : 'Black'}`;
            this.renderBoard();
        });

        socket.on("move", (move) => {
            this.game.move(move);
            this.renderBoard();
            this.checkGameOver();
        });

        socket.on("boardPosition", (fen) => {
            this.game.load(fen);
            this.renderBoard();
        });

        socket.on("playerWon", (winner) => {
            alert(`${winner === 'w' ? 'White' : 'Black'} wins!`);
        });

        socket.on("drawOffer", (player) => {
            if (confirm(`${player} offers a draw. Accept?`)) {
                socket.emit("drawAccepted");
            } else {
                socket.emit("drawDeclined");
            }
        });
        
        socket.on("gameEnd", (result) => {
            let message = "";
            if (result.type === "resign") {
                message = `${result.player} resigned. ${result.winner} wins!`;
            } else if (result.type === "draw") {
                message = "Game ended in a draw!";
            }
            alert(message);
        });
    }

    getPieceUnicode(piece) {
        const unicodePieces = {
            p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔",
            P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚"
        };
        return unicodePieces[piece.type] || "";
    }

    clearDrag() {
        if (this.draggedPiece) {
            this.draggedPiece.style.position = '';
            this.draggedPiece.style.left = '';
            this.draggedPiece.style.top = '';
        }
        this.draggedPiece = null;
        this.sourceSquare = null;
        this.clearHighlights();
    }

    clearHighlights() {
        const highlightedSquares = boardElement.querySelectorAll(".highlight");
        highlightedSquares.forEach(square => {
            square.classList.remove("highlight");
        });
        this.availableMoves = [];
    }

    highlightAvailableMoves() {
        this.clearHighlights();
        
        if (!this.sourceSquare) return;
        
        const pieceSquare = `${String.fromCharCode(97 + this.sourceSquare.col)}${8 - this.sourceSquare.row}`;
        const moves = this.game.moves({ square: pieceSquare, verbose: true });
        this.availableMoves = moves.map(move => move.to);
    
        this.availableMoves.forEach(move => {
            const [col, row] = move.split('');
            const squareElement = boardElement.querySelector(
                `[data-column="${col.charCodeAt(0) - 97}"][data-row="${8 - parseInt(row)}"]`
            );
            if (squareElement) {
                squareElement.classList.add("highlight");
            }
        });
    }

    updateBoardOrientation() {
        boardElement.classList.toggle("flipped", this.playerRole === "b");
    }

    handleDrop(e, rowIndex, colIndex) {
        e.preventDefault();
        if (this.draggedPiece) {
            const targetSquare = { row: rowIndex, col: colIndex };
            this.handleMove(this.sourceSquare, targetSquare);
        }
    }

    handlePieceTap(e, square) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!square) return;
        
        this.sourceSquare = { row: square.row, col: square.col };
        this.highlightAvailableMoves();
    }

    handleDragStart(e, square) {
        if (e.target.draggable && square) {
            this.draggedPiece = e.target;
            this.sourceSquare = { row: square.row, col: square.col };
            e.dataTransfer.setData("text/plain", "");
            this.highlightAvailableMoves();
        }
    }

    handleTouchStart(e, square) {
        const pieceElement = e.target.closest('.piece');
        if (!pieceElement) return;
        
        const piece = this.game.get(`${String.fromCharCode(97 + square.col)}${8 - square.row}`);
        if (!piece || piece.color !== this.playerRole) return;
        
        // Tracking the initial touch position
        const touch = e.touches[0];
        pieceElement.style.position = 'absolute';
        pieceElement.style.zIndex = 1000;
        
        // Storing initial positions
        this.touchOffset = {
            x: touch.clientX - pieceElement.offsetLeft,
            y: touch.clientY - pieceElement.offsetTop
        };
        
        this.draggedPiece = pieceElement;
        this.sourceSquare = square;
        this.highlightAvailableMoves();
        
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
    }
    
    handleTouchMove(e) {
        if (!this.draggedPiece) return;
        
        const touch = e.touches[0];
        this.draggedPiece.style.left = `${touch.clientX - this.touchOffset.x}px`;
        this.draggedPiece.style.top = `${touch.clientY - this.touchOffset.y}px`;
    }

    handleTouchEnd(e, rowIndex, colIndex) {
        if (!this.sourceSquare) return;
        
        const targetSquare = { row: rowIndex, col: colIndex };
        const targetNotation = `${String.fromCharCode(97 + targetSquare.col)}${8 - targetSquare.row}`;
        
        if (this.availableMoves.includes(targetNotation)) {
            this.handleMove(this.sourceSquare, targetSquare);
        }
        
        this.clearDrag();
    }
}

class GameTimer {
    constructor(seconds, displayId) {
        this.initialTime = seconds;
        this.remainingTime = seconds;
        this.displayId = displayId;
        this.interval = null;
    }

    start() {
        if (this.interval) return;
        
        this.interval = setInterval(() => {
            this.remainingTime--;
            this.updateDisplay();
            
            if (this.remainingTime <= 0) {
                this.stop();
                this.timeUp();
            }
        }, 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        document.getElementById(this.displayId).textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    timeUp() {
        socket.emit('timeUp');
    }
}

// Initialize and start the game
const game = new ChessGame();
game.start();

// Initialize UI elements
document.getElementById('resign-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to resign?')) {
        socket.emit('resign');
    }
});

document.getElementById('draw-btn').addEventListener('click', () => {
    socket.emit('drawOffer');
});