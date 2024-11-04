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

    // Add row and col to the piece element's dataset
    pieceElement.dataset.row = square.row;
    pieceElement.dataset.col = square.col;

    // Set up touch event listeners for mobile tapping
    pieceElement.addEventListener("touchstart", (e) => {
        if (playerRole === square.color) {  // Only allow if it's the player's turn
            handlePieceTap(e, { row: parseInt(pieceElement.closest('.square').dataset.row), 
                              col: parseInt(pieceElement.closest('.square').dataset.column) });
        }
    });

    return pieceElement;
};

// Handle piece tap event
const handlePieceTap = (e, square) => {
    e.preventDefault(); // Prevent default touch behavior
    e.stopPropagation(); // Stop event from bubbling to parent elements
    
    if (!square) return;
    
    sourceSquare = { row: square.row, col: square.col };
    console.log('Piece tapped:', sourceSquare); // Debug log
    highlightAvailableMoves();
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

const handleMove = (source, target) => {
    if (!source || !target) {
        console.log('Invalid move: missing source or target'); // Debug log
        return;
    }

    // Check if it's the player's turn
    const piece = chess.get(`${String.fromCharCode(97 + source.col)}${8 - source.row}`);
    if (!piece || piece.color !== playerRole) {
        console.log('Invalid move: not your turn or piece'); // Debug log
        return;
    }

    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q',
    };

    console.log('Attempting move:', move); // Debug log

    const moveResult = chess.move(move);
    if (moveResult) {
        socket.emit("move", move);
        renderBoard();
    } else {
        console.log('Invalid move:', move); // Debug log
        const statusMessageElement = document.getElementById("statusMessage");
        if (statusMessageElement) {
            statusMessageElement.innerText = "Invalid move! Please try again.";
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

const highlightAvailableMoves = () => {
    clearHighlights();
    
    if (!sourceSquare) return;
    
    const pieceSquare = `${String.fromCharCode(97 + sourceSquare.col)}${8 - sourceSquare.row}`;
    console.log('Highlighting moves for square:', pieceSquare); // Debug log
    
    const moves = chess.moves({ square: pieceSquare, verbose: true });
    availableMoves = moves.map(move => move.to);
    
    console.log('Available moves:', availableMoves); // Debug log

    availableMoves.forEach(move => {
        const [col, row] = move.split('');
        const squareElement = boardElement.querySelector(
            `[data-column="${col.charCodeAt(0) - 97}"][data-row="${8 - parseInt(row)}"]`
        );
        if (squareElement) {
            squareElement.classList.add("highlight");
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
    e.preventDefault();
    e.stopPropagation();
    
    // Only proceed if we're touching a piece
    const pieceElement = e.target.closest('.piece');
    if (!pieceElement) return;
    
    sourceSquare = { row: parseInt(square.row), col: parseInt(square.col) };
    console.log('Touch start:', sourceSquare); // Debug log
    highlightAvailableMoves();
};

// Handle touch end event
const handleTouchEnd = (e, rowIndex, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!sourceSquare) return;
    
    const targetSquare = { row: parseInt(rowIndex), col: parseInt(colIndex) };
    console.log('Touch end:', targetSquare); // Debug log
    
    if (availableMoves.includes(`${String.fromCharCode(97 + targetSquare.col)}${8 - targetSquare.row}`)) {
        handleMove(sourceSquare, targetSquare);
    }
    
    clearDrag();
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

// Add at the start of your file
const DEBUG = true;
const log = (...args) => {
    if (DEBUG) console.log(...args);
};

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