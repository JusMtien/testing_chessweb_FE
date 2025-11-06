// Biến toàn cục
let board = null; // Sẽ giữ đối tượng bàn cờ (chessboard.js)
const game = new Chess(); // Sẽ giữ logic cờ (chess.js)

let fullPgnHistory = []; // Lưu PGN đầy đủ
let moveHistory = []; // Lưu FEN của từng nước đi
let currentMoveIndex = -1; // Chỉ số của nước đi đang xem

// (QUAN TRỌNG) Di dời các biến DOM vào bên trong onDocumentLoad
// Lý do: Đảm bảo các element #id đã tồn tại trước khi gán
let statusEl, pgnContainer, pgnTemplate, copyPgnBtn, fullPgnStringEl,
    btnStart, btnBack, btnNext, btnEnd,
    adminPanel, adminPassword, adminPgnInput, adminSendBtn, adminResetBtn;


// --- CÀI ĐẶT SOCKET.IO ---

// (QUAN TRỌNG) Đổi URL này thành URL Render của bạn
const BACKEND_URL = "https://check-boardbe.onrender.com"; 
const socket = io(BACKEND_URL);

socket.on('connect', () => {
    console.log('Đã kết nối thành công với máy chủ Socket.IO');
    if (statusEl) { // Kiểm tra xem statusEl đã được gán chưa
        statusEl.textContent = 'Đã kết nối. Đang chờ dữ liệu...';
        statusEl.className = 'connected';
    }
});

socket.on('disconnect', (reason) => {
    console.log('Bị ngắt kết nối:', reason);
    if (statusEl) {
        statusEl.textContent = 'Mất kết nối. Đang thử lại...';
        statusEl.className = 'error';
    }
});

socket.on('connect_error', (error) => {
    console.error('Lỗi kết nối:', error.message);
    if (statusEl) {
        statusEl.textContent = `Lỗi kết nối: ${BACKEND_URL} không phản hồi.`;
        statusEl.className = 'error';
    }
});

// LẮNG NGHE SỰ KIỆN CHÍNH: 'pico_move'
socket.on('pico_move', (data) => {
    console.log('Đã nhận được PGN/Move từ server:', data);
    handleNewPgn(data.pgn);
});

// Lắng nghe lỗi Admin
socket.on('admin_error', (data) => {
    console.error('Lỗi Admin:', data.message);
    alert(`LỖI ADMIN: ${data.message}`);
});

// LẮNG NGHE SỰ KIỆN RESET TỪ SERVER
socket.on('game_reset', () => {
    console.log("Đã nhận lệnh RESET từ server!");
    resetGame();
});


// --- LOGIC TUA LẠI VÁN CỜ ---

// Hàm reset game (dùng cho client)
function resetGame() {
    game.reset(); // Xóa logic cờ
    moveHistory = [game.fen()]; // Chỉ giữ vị trí 'start'
    fullPgnHistory = ["Ván mới"];
    currentMoveIndex = 0;
    
    updatePgnDisplay(); // Xóa PGN
    navigateToMove(0); // Hiển thị bàn cờ 'start'
    
    if (fullPgnStringEl) {
        fullPgnStringEl.value = ""; // Xóa ô PGN string
    }
    
    if (statusEl) {
        statusEl.textContent = "Ván cờ đã được Reset. Đang chờ ván mới...";
        statusEl.className = 'connected';
    }
}

// Hàm này cập nhật bàn cờ và PGN đến 1 nước đi cụ thể
function navigateToMove(moveIndex) {
    if (moveIndex < 0 || moveIndex >= moveHistory.length) return;
    currentMoveIndex = moveIndex;
    
    const fen = moveHistory[currentMoveIndex];
    if (board) {
        board.position(fen, true);
    }

    highlightPgnMove(currentMoveIndex);
    updateButtons();
}

// Cập nhật trạng thái (enable/disable) của các nút
function updateButtons() {
    if (!btnStart) return; // Kiểm tra nếu các nút chưa được gán
    btnStart.disabled = (currentMoveIndex <= 0);
    btnBack.disabled = (currentMoveIndex <= 0);
    btnNext.disabled = (currentMoveIndex >= moveHistory.length - 1);
    btnEnd.disabled = (currentMoveIndex >= moveHistory.length - 1);
}

// Xử lý khi bấm nút (Sẽ gán trong onDocumentLoad)


// --- CÀI ĐẶT BÀN CỜ VÀ PGN ---

// HÀM COPY PGN VÀO CLIPBOARD (Đơn giản hơn)
function copyPgnToClipboard() {
    // Lấy PGN từ ô textarea
    const pgnString = fullPgnStringEl.value;
    if (!pgnString) {
        console.log('Không có PGN để copy');
        return;
    }

    // Chọn text trong ô
    fullPgnStringEl.select();
    fullPgnStringEl.setSelectionRange(0, 99999); // Dành cho mobile

    try {
        document.execCommand('copy'); // Lệnh copy
        
        // Feedback
        const originalText = copyPgnBtn.textContent;
        copyPgnBtn.textContent = 'Đã copy!';
        copyPgnBtn.classList.add('copied');
        
        setTimeout(() => {
            copyPgnBtn.textContent = originalText; // Trả lại text cũ
            copyPgnBtn.classList.remove('copied');
        }, 2000); // Reset sau 2 giây

    } catch (err) {
        console.error('Lỗi khi copy PGN:', err);
        alert('Lỗi! Không thể tự động copy.');
    }
}


// Highlight nước đi được chọn trong PGN list
function highlightPgnMove(moveIndex) {
    document.querySelectorAll('.white-move, .black-move').forEach(el => {
        el.classList.remove('selected');
    });

    if (moveIndex > 0) { // Index 0 là 'start'
        const selectedEl = document.querySelector(`[data-move-index="${moveIndex}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
            selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// Cập nhật giao diện PGN (chia 2 cột)
function updatePgnDisplay() {
    if (!pgnContainer || !pgnTemplate) return; // Kiểm tra

    pgnContainer.innerHTML = ''; // Xóa PGN cũ
    const moves = game.history({ verbose: true }); // Lấy lịch sử từ logic
    
    let moveNumber = 1;
    let pgnRow = null;
    let moveIndex = 1; // Bắt đầu từ 1 (0 là vị trí 'start')

    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        if (move.color === 'w') {
            pgnRow = pgnTemplate.content.cloneNode(true).querySelector('.pgn-row');
            pgnRow.querySelector('.move-number').textContent = `${moveNumber}.`;
            const whiteMoveEl = pgnRow.querySelector('.white-move');
            whiteMoveEl.textContent = move.san;
            whiteMoveEl.dataset.moveIndex = moveIndex;
            pgnContainer.appendChild(pgnRow);
        } 
        else if (move.color === 'b') {
            const blackMoveEl = pgnRow.querySelector('.black-move');
            blackMoveEl.textContent = move.san;
            blackMoveEl.dataset.moveIndex = moveIndex;
            moveNumber++;
        }
        moveIndex++;
    }

    // Thêm sự kiện click cho TẤT CẢ các nước đi PGN
    pgnContainer.querySelectorAll('.white-move, .black-move').forEach(el => {
        if(el.textContent) { // Chỉ thêm nếu có nước đi
            el.onclick = (e) => {
                const index = parseInt(e.target.dataset.moveIndex);
                navigateToMove(index);
            };
        }
    });
}

// Hàm xử lý PGN nhận được
function handleNewPgn(pgnString) {
    // 1. Thử tải PGN vào logic cờ
    const success = game.load_pgn(pgnString);
    if (!success) {
        console.error('Lỗi: PGN không hợp lệ', pgnString);
        if (statusEl) {
            statusEl.textContent = `Lỗi: PGN nhận được không hợp lệ: ${pgnString}`;
            statusEl.className = 'error';
        }
        return;
    }

    // 2. Tái tạo lại lịch sử FEN
    moveHistory = [];
    fullPgnHistory = [];
    const tempGame = new Chess();
    
    moveHistory.push(tempGame.fen()); // Index 0: Vị trí 'start'
    fullPgnHistory.push("Ván mới");

    const moves = game.history(); 
    for (const move of moves) {
        tempGame.move(move);
        moveHistory.push(tempGame.fen());
        fullPgnHistory.push(tempGame.pgn({ max_width: 5 }));
    }

    // 3. Cập nhật lại toàn bộ bảng PGN (chia 2 cột)
    updatePgnDisplay();

    // 4. Cập nhật ô PGN String
    if (fullPgnStringEl) {
        fullPgnStringEl.value = game.pgn({ newline_char: ' ' });
    }

    // 5. Quyết định xem nên nhảy đến đâu
    if (currentMoveIndex === -1 || currentMoveIndex === moveHistory.length - 2) {
        navigateToMove(moveHistory.length - 1);
    } else {
        updateButtons();
    }
    
    if (statusEl) {
        statusEl.textContent = `Đã nhận PGN. Tổng ${moves.length} nước đi.`;
        statusEl.className = 'connected';
    }
}

// Hàm này chạy khi trang web được tải xong
function onDocumentLoad() {
    
    // (QUAN TRỌNG) Gán tất cả các biến DOM ở đây
    statusEl = document.getElementById('status');
    pgnContainer = document.getElementById('move-list-container');
    pgnTemplate = document.getElementById('pgn-template');
    copyPgnBtn = document.getElementById('copyPgnBtn');
    fullPgnStringEl = document.getElementById('fullPgnString');
    
    btnStart = document.getElementById('btnStart');
    btnBack = document.getElementById('btnBack');
    btnNext = document.getElementById('btnNext');
    btnEnd = document.getElementById('btnEnd');
    
    adminPanel = document.getElementById('adminPanel');
    adminPassword = document.getElementById('adminPassword');
    adminPgnInput = document.getElementById('adminPgnInput');
    adminSendBtn = document.getElementById('adminSendBtn');
    adminResetBtn = document.getElementById('adminResetBtn');

    // Cập nhật trạng thái (nếu socket kết nối trước khi DOM load)
    if (socket.connected) {
        statusEl.textContent = 'Đã kết nối. Đang chờ dữ liệu...';
        statusEl.className = 'connected';
    } else if (statusEl) { // Kiểm tra statusEl có tồn tại không
        statusEl.textContent = `Lỗi kết nối: ${BACKEND_URL} không phản hồi.`;
        statusEl.className = 'error';
    }

    // 1. Cấu hình bàn cờ
    const config = {
        draggable: false, 
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };

    // 2. Khởi tạo bàn cờ
    board = Chessboard('myBoard', config);
    
    // 3. Khởi tạo trạng thái ban đầu
    resetGame(); // Dùng hàm reset mới
    
    // 4. Tự động thay đổi kích thước bàn cờ khi cửa sổ thay đổi
    $(window).resize(board.resize);

    // 5. KÍCH HOẠT BẢNG ADMIN
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        adminPanel.style.display = 'flex'; // Hiển thị bảng admin
        console.log('Chế độ Admin đã được kích hoạt');
    }

    // 6. Gắn sự kiện cho nút Gửi Admin
    adminSendBtn.onclick = () => {
        const pgn = adminPgnInput.value;
        const pass = adminPassword.value;
        if (!pgn || !pass) {
            alert('Vui lòng nhập Mật khẩu và PGN');
            return;
        }
        console.log('Admin đang gửi PGN sửa lỗi:', pgn);
        socket.emit('admin_fix_pgn', { pgn: pgn, password: pass });
    };

    // 7. GẮN SỰ KIỆN CHO NÚT RESET
    adminResetBtn.onclick = () => {
        const pass = adminPassword.value;
        if (!pass) {
            alert('Vui lòng nhập Mật khẩu');
            return;
        }
        if (confirm("Bạn có chắc muốn Reset toàn bộ ván cờ về ban đầu cho TẤT CẢ mọi người xem?")) {
            console.log('Admin đang gửi lệnh Reset Game');
            socket.emit('admin_reset_game', { password: pass });
        }
    };
    
    // 8. GẮN SỰ KIỆN CHO NÚT COPY PGN
    copyPgnBtn.onclick = copyPgnToClipboard;
    
    // 9. Gắn sự kiện cho các nút tua
    btnStart.onclick = () => navigateToMove(0);
    btnBack.onclick = () => navigateToMove(currentMoveIndex - 1);
    btnNext.onclick = () => navigateToMove(currentMoveIndex + 1);
    btnEnd.onclick = () => navigateToMove(moveHistory.length - 1);
}

// Chạy hàm onDocumentLoad khi trang web đã sẵn sàng
$(document).ready(onDocumentLoad);