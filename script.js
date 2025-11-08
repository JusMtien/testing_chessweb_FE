// ------------------- BIẾN TOÀN CỤC -------------------
let board = null; // chessboard.js object
const game = new Chess(); // chess.js logic

let fullPgnHistory = [];
let moveHistory = [];
let currentMoveIndex = -1;

// DOM elements
let statusEl, pgnContainer, pgnTemplate, copyPgnBtn, fullPgnStringEl,
    btnStart, btnBack, btnNext, btnEnd,
    adminPanel, adminPassword, adminPgnInput, adminSendBtn, adminResetBtn;

// ------------------- SOCKET.IO -------------------
// (⚠️ THAY URL SAU BẰNG BACKEND CỦA BẠN)
const BACKEND_URL = "https://check-boardbe.onrender.com";
const socket = io(BACKEND_URL);

socket.on("connect", () => {
    console.log("✅ Kết nối Socket.IO thành công");
    if (statusEl) {
        statusEl.textContent = "Đã kết nối. Đang chờ Pi...";
        statusEl.className = "connected";
    }
});

socket.on("disconnect", (reason) => {
    console.log("⚠️ Mất kết nối:", reason);
    if (statusEl) {
        statusEl.textContent = "Mất kết nối. Đang thử lại...";
        statusEl.className = "error";
    }
});

socket.on("connect_error", (err) => {
    console.error("Lỗi kết nối:", err.message);
    if (statusEl) {
        statusEl.textContent = `Không thể kết nối tới ${BACKEND_URL}`;
        statusEl.className = "error";
    }
});

// Khi có PGN mới từ Raspberry Pi
socket.on("pico_move", (data) => {
    console.log("📩 Nhận PGN mới:", data.pgn);
    handleNewPgn(data.pgn);
});

// Khi admin gửi lỗi hoặc thông báo
socket.on("admin_error", (data) => {
    console.error("⚠️ Lỗi Admin:", data.message);
    alert(`LỖI ADMIN: ${data.message}`);
});

// Khi server reset ván
socket.on("game_reset", () => {
    console.log("♻️ RESET ván cờ!");
    resetGame();
});

// ------------------- HÀM CHÍNH -------------------
function resetGame() {
    game.reset();
    moveHistory = [game.fen()];
    fullPgnHistory = ["Ván mới"];
    currentMoveIndex = 0;
    updatePgnDisplay();
    navigateToMove(0);
    if (fullPgnStringEl) fullPgnStringEl.value = "";
    if (statusEl) {
        statusEl.textContent = "Sẵn sàng! Đang chờ ván mới từ Pi...";
        statusEl.className = "connected";
    }
}

function navigateToMove(index) {
    if (index < 0 || index >= moveHistory.length) return;
    currentMoveIndex = index;
    board.position(moveHistory[index], true);
    highlightPgnMove(index);
    updateButtons();
}

function updateButtons() {
    if (!btnStart) return;
    btnStart.disabled = btnBack.disabled = (currentMoveIndex <= 0);
    btnNext.disabled = btnEnd.disabled = (currentMoveIndex >= moveHistory.length - 1);
}

// Copy PGN vào clipboard
function copyPgnToClipboard() {
    const pgnString = fullPgnStringEl.value;
    if (!pgnString) return alert("Không có PGN để copy");
    fullPgnStringEl.select();
    document.execCommand("copy");
    copyPgnBtn.textContent = "Đã copy!";
    setTimeout(() => (copyPgnBtn.textContent = "Copy PGN"), 2000);
}

// Highlight nước đi đang xem
function highlightPgnMove(index) {
    document.querySelectorAll(".white-move, .black-move").forEach((el) =>
        el.classList.remove("selected")
    );
    const el = document.querySelector(`[data-move-index="${index}"]`);
    if (el) {
        el.classList.add("selected");
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

// Cập nhật danh sách PGN
function updatePgnDisplay() {
    if (!pgnContainer || !pgnTemplate) return;
    pgnContainer.innerHTML = "";
    const moves = game.history({ verbose: true });
    let moveNumber = 1;
    let moveIndex = 1;
    let row = null;

    for (const move of moves) {
        if (move.color === "w") {
            row = pgnTemplate.content.cloneNode(true).querySelector(".pgn-row");
            row.querySelector(".move-number").textContent = `${moveNumber}.`;
            const w = row.querySelector(".white-move");
            w.textContent = move.san;
            w.dataset.moveIndex = moveIndex;
            pgnContainer.appendChild(row);
        } else {
            const b = row.querySelector(".black-move");
            b.textContent = move.san;
            b.dataset.moveIndex = moveIndex;
            moveNumber++;
        }
        moveIndex++;
    }

    pgnContainer.querySelectorAll(".white-move, .black-move").forEach((el) => {
        el.onclick = (e) => navigateToMove(parseInt(e.target.dataset.moveIndex));
    });
}

// Khi có PGN mới từ server
function handleNewPgn(pgnString) {
    if (!pgnString) return resetGame();
    const ok = game.load_pgn(pgnString);
    if (!ok) {
        if (statusEl) {
            statusEl.textContent = "PGN không hợp lệ!";
            statusEl.className = "error";
        }
        return;
    }

    const tmp = new Chess();
    moveHistory = [tmp.fen()];
    const moves = game.history();
    for (const m of moves) {
        tmp.move(m);
        moveHistory.push(tmp.fen());
    }

    updatePgnDisplay();
    if (fullPgnStringEl)
        fullPgnStringEl.value = game.pgn({ newline_char: " " });
    navigateToMove(moveHistory.length - 1);
    if (statusEl) {
        statusEl.textContent = `Đã nhận ${moves.length} nước đi.`;
        statusEl.className = "connected";
    }
}

// ------------------- KHỞI TẠO KHI LOAD TRANG -------------------
function onDocumentLoad() {
    // Gán DOM
    statusEl = document.getElementById("status");
    pgnContainer = document.getElementById("move-list-container");
    pgnTemplate = document.getElementById("pgn-template");
    copyPgnBtn = document.getElementById("copyPgnBtn");
    fullPgnStringEl = document.getElementById("fullPgnString");
    btnStart = document.getElementById("btnStart");
    btnBack = document.getElementById("btnBack");
    btnNext = document.getElementById("btnNext");
    btnEnd = document.getElementById("btnEnd");
    adminPanel = document.getElementById("adminPanel");
    adminPassword = document.getElementById("adminPassword");
    adminPgnInput = document.getElementById("adminPgnInput");
    adminSendBtn = document.getElementById("adminSendBtn");
    adminResetBtn = document.getElementById("adminResetBtn");

    // Khởi tạo bàn cờ
    board = Chessboard("myBoard", {
        draggable: false,
        position: "start",
        pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
    });
    resetGame();
    $(window).resize(board.resize);

    // Nếu có ?admin=true thì bật bảng Admin
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") adminPanel.style.display = "flex";

    // Gắn sự kiện
    copyPgnBtn.onclick = copyPgnToClipboard;
    btnStart.onclick = () => navigateToMove(0);
    btnBack.onclick = () => navigateToMove(currentMoveIndex - 1);
    btnNext.onclick = () => navigateToMove(currentMoveIndex + 1);
    btnEnd.onclick = () => navigateToMove(moveHistory.length - 1);

    adminSendBtn.onclick = () => {
        const pgn = adminPgnInput.value;
        const pass = adminPassword.value;
        if (!pgn || !pass) return alert("Nhập mật khẩu & PGN!");
        socket.emit("admin_fix_pgn", { pgn, password: pass });
    };
    adminResetBtn.onclick = () => {
        const pass = adminPassword.value;
        if (!pass) return alert("Nhập mật khẩu!");
        if (confirm("Reset toàn bộ ván cờ cho mọi người?"))
            socket.emit("admin_reset_game", { password: pass });
    };
}

$(document).ready(onDocumentLoad);
