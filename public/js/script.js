const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const statusElement = document.getElementById("status"); // Element to display current turn
const eliminationStatusElement = document.getElementById("eliminationStatus"); // Element to display elimination status

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let availableMoves = []; // Array to hold available moves

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ""; // Clear the board before rendering
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowindex + squareindex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowindex;
            squareElement.dataset.column = squareindex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                        highlightAvailableMoves(square); // Highlight available moves
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece = null;
                    sourceSquare = null;
                    clearHighlights(); // Clear highlights on drag end
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.column),
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

const highlightAvailableMoves = (square) => {
    // Clear previous highlights
    clearHighlights();

    // Get the available moves for the selected piece
    const pieceSquare = `${String.fromCharCode(97 + sourceSquare.col)}${8 - sourceSquare.row}`; // Get the square of the piece being dragged
    const moves = chess.moves({ square: pieceSquare, verbose: true }); // Get available moves for the piece
    availableMoves = moves.map(move => move.to); // Store available moves

    // Highlight the squares for available moves
    availableMoves.forEach(move => {
        const [col, row] = move.split('');
        const squareElement = boardElement.querySelector(`[data-column="${col.charCodeAt(0) - 97}"][data-row="${8 - parseInt(row)}"]`);
        if (squareElement) {
            squareElement.classList.add("highlight"); // Add highlight class
        }
    });
};

const clearHighlights = () => {
    // Clear highlights from all squares
    const highlightedSquares = boardElement.querySelectorAll(".highlight");
    highlightedSquares.forEach(square => {
        square.classList.remove("highlight");
    });
    availableMoves = []; // Clear available moves
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q', // Assuming promotion to queen
    };
    socket.emit("move", move);
};

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♙",
        r: "♖",
        n: "♘",
        b: "♗",
        q: "♕",
        k: "♔",
        P: "♟",
        R: "♜",
        N: "♞",
        B: "♝",
        Q: "♛",
        K: "♚",
    };
    return unicodePieces[piece.type] || "";
};

socket.on("currentPlayer", function(role) {
    playerRole = role;
    statusElement.innerText = `Current Turn: ${role === 'w' ? 'White' : 'Black'}`; // Update status
    renderBoard();
});

// Listen for current turn updates
socket.on("currentTurn", function(turn) {
    statusElement.innerText = `Current Turn: ${turn === 'w' ? 'White' : 'Black'}`; // Update status
});

socket.on("move", function(move) {
    chess.move(move);
    renderBoard(); // Ensure the board is re-rendered after a move
});

socket.on("boardPosition", function(fen) {
    chess.load(fen);
    renderBoard(); // Ensure the board is re-rendered after loading a position
});

// Function to handle player elimination
socket.on("playerEliminated", function(player) {
    eliminationStatusElement.innerText = `${player === 'w' ? 'White' : 'Black'} has been eliminated!`;
});

renderBoard(); // Initial render