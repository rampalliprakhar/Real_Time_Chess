const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const statusElement = document.getElementById("status");
const eliminationStatusElement = document.getElementById("eliminationStatus");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let availableMoves = [];

// Initialize the chessboard
const initBoard = () => {
    renderBoard();
    setupSocketListeners();
};

// Render the chessboard
const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ""; // Clear the board before rendering

    board.forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
            const squareElement = createSquareElement(rowIndex, colIndex, square);
            boardElement.appendChild(squareElement);
        });
    });

    updateBoardOrientation();
};

// Create a square element
const createSquareElement = (rowIndex, colIndex, square) => {
    const squareElement = document.createElement("div");
    squareElement.classList.add("square", (rowIndex + colIndex) % 2 === 0 ? "light" : "dark");
    squareElement.dataset.row = rowIndex;
    squareElement.dataset.column = colIndex;

    if (square) {
        const pieceElement = createPieceElement(square);
        squareElement.appendChild(pieceElement);
    }

    // Set up drag-and-drop event listeners for desktop
    squareElement.addEventListener("dragover", (e) => e.preventDefault());
    squareElement.addEventListener("drop", (e) => handleDrop(e, rowIndex, colIndex));

    // Set up touch event listeners for mobile
    squareElement.addEventListener("touchstart", (e) => handleTouchStart(e, { row: rowIndex, col: colIndex }));
    squareElement.addEventListener("touchend", (e) => handleTouchEnd(e, rowIndex, colIndex));

    // Ensure the square object is passed correctly to handleDragStart
    squareElement.addEventListener("dragstart", (e) => handleDragStart(e, { row: rowIndex, col: colIndex })); // Pass the row and col

    return squareElement;
};

// Create a piece element
const createPieceElement = (square) => {
    const pieceElement = document.createElement("div");
    pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
    pieceElement.innerText = getPieceUnicode(square);
    pieceElement.draggable = playerRole === square.color;

    // Set up touch event listeners for mobile tapping
    pieceElement.addEventListener("touchstart", (e) => handlePieceTap(e, square));

    return pieceElement;
};

// Handle the start of a drag event
const handleDragStart = (e, square) => {
    if (e.target.draggable && square) { // Check if 'square' is defined
        draggedPiece = e.target;
        sourceSquare = { row: square.row, col: square.col }; // Use the passed row and col
        e.dataTransfer.setData("text/plain", "");
        highlightAvailableMoves();
    }
};

// Handle the move logic
const handleMove = (source, target) => {
    if (!source || !target) return; // Check if source and target are defined
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q', // Assuming promotion to queen
    };

    // Validate the move
    const moveResult = chess.move(move);
    const statusMessageElement = document.getElementById("statusMessage"); // Get the status message element

    if (moveResult) {
        socket.emit("move", move);
        if (statusMessageElement) {
            statusMessageElement.innerText = ""; // Clear any previous messages
        }
    } else {
        if (statusMessageElement) {
            statusMessageElement.innerText = "Invalid move! Please try again."; // Update the UI with the invalid move message
        }
    }
};

// Handle the drop event
const handleDrop = (e, rowIndex, colIndex) => {
    e.preventDefault();
    if (draggedPiece) {
        const targetSquare = { row: rowIndex, col: colIndex };
        handleMove(sourceSquare, targetSquare); // Ensure sourceSquare is defined
    }
};

// Highlight available moves for the selected piece
const highlightAvailableMoves = () => {
    clearHighlights();
    const pieceSquare = `${String.fromCharCode(97 + sourceSquare.col)}${8 - sourceSquare.row}`;
    const moves = chess.moves({ square: pieceSquare, verbose: true });
    availableMoves = moves.map(move => move.to);

    availableMoves.forEach(move => {
        const [col, row] = move.split('');
        const squareElement = boardElement.querySelector(`[data-column="${col.charCodeAt(0) - 97}"][data-row="${8 - parseInt(row)}"]`);
        if (squareElement) {
            squareElement.classList.add("highlight");
            // Add touch event listener to highlighted squares
            squareElement.addEventListener("touchstart", (e) => handleTouchEnd(e));
        }
    });
};

// Clear highlights from all squares
const clearHighlights = () => {
    const highlightedSquares = boardElement.querySelectorAll(".highlight");
    highlightedSquares.forEach(square => {
        square.classList.remove("highlight");
        // Remove touch event listener from highlighted squares
        square.removeEventListener("touchstart", (e) => handleTouchEnd(e));
    });
    availableMoves = [];
};

// Clear the drag state
const clearDrag = () => {
    if (draggedPiece) {
        draggedPiece.style.position = ''; // Reset position
        draggedPiece.style.left = ''; // Reset left
        draggedPiece.style.top = ''; // Reset top
    }
    draggedPiece = null;
    sourceSquare = null;
    clearHighlights();
};

// Get the Unicode representation of a piece
const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔",
        P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚",
    };
    return unicodePieces[piece.type] || "";
};

// Update the board orientation based on the player role
const updateBoardOrientation = () => {
    boardElement.classList.toggle("flipped", playerRole === "b");
};

// Check for game over
const checkGameOver = () => {
    if (chess.in_checkmate()) {
        alert("Checkmate! Game over.");
    } else if (chess.in_stalemate()) {
        alert("Stalemate! Game over.");
    }
};

// Handle touch start event
const handleTouchStart = (e, square) => {
    e.preventDefault(); // Prevent default touch behavior (scrolling)
    sourceSquare = { row: square.row, col: square.col }; // Use the passed row and col
    highlightAvailableMoves(); // Highlight available moves
};

// Handle touch end event for moving the piece
const handleTouchEnd = (e) => {
    e.preventDefault(); // Prevent default touch behavior (scrolling)
    const targetSquare = getTargetSquare(e.changedTouches[0]); // Get the target square based on touch position
    if (targetSquare) {
        handleMove(sourceSquare, targetSquare); // Move the piece
    }
    clearDrag(); // Clear the drag state
};

// Get the target square based on touch position
const getTargetSquare = (touch) => {
    const squareElements = document.querySelectorAll('.square');
    for (let squareElement of squareElements) {
        const rect = squareElement.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            return { row: squareElement.dataset.row, col: squareElement.dataset.column };
        }
    }
    return null; // No target square found
};

// Prevent scrolling on touchmove
document.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling while dragging
}, { passive: false });

// Setup socket event listeners
const setupSocketListeners = () => {
    // Notify players of the current player
    socket.on("currentPlayer", (role) => {
        playerRole = role;
        statusElement.innerText = `Current Turn: ${role === 'w' ? 'White' : 'Black'}`;
        renderBoard();
    });

    // Notify player of current turns
    socket.on("currentTurn", (turn) => {
        statusElement.innerText = `Current Turn: ${turn === 'w' ? 'White' : 'Black'}`;
    });

    // Update socket listener for moves
    socket.on("move", (move) => {
        chess.move(move);
        renderBoard();
        checkGameOver();
    });

    // Updates the board position
    socket.on("boardPosition", (fen) => {
        chess.load(fen);
        renderBoard();
    });

    // Updates elimination of players
    socket.on("playerEliminated", (player) => {
        eliminationStatusElement.innerText = `${player === 'w' ? 'White' : 'Black'} has been eliminated!`;
    });

    // Handles player disconnection
    socket.on("playerDisconnected", (player) => {
        alert(`${player} has disconnected`);
    });

    socket.on("reconnect", () => {
        alert("You have reconnected to the game.");
    });
};

// Initialize the board on page load
initBoard();