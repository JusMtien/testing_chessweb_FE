// Biến toàn cục
let board = null; // Sẽ giữ đối tượng bàn cờ (chessboard.js)
const game = new Chess(); // Sẽ giữ logic cờ (chess.js)

let fullPgnHistory = []; // (MỚI) Lưu PGN đầy đủ
let moveHistory = []; // (MỚI) Lưu FEN của từng nước đi
let currentMoveIndex = -1; // (MỚI) Chỉ số của nước đi đang xem

// DOM Elements
const statusEl = document.getElementById('status');
const pgnContainer = document.getElementById('move-list-container');
const pgnTemplate = document.getElementById('pgn-template');

// (MỚI) Nút bấm điều khiển
const btnStart = document.getElementById('btnStart');
const btnBack = document.getElementById('btnBack');
const btnNext = document.getElementById('btnNext');
const btnEnd = document.getElementById('btnEnd');

// (MỚI) DOM Elements CỦA ADMIN
const adminPanel = document.getElementById('adminPanel');
const adminPassword = document.getElementById('adminPassword');
const adminPgnInput = document.getElementById('adminPgnInput');
const adminSendBtn = document.getElementById('adminSendBtn');


// --- CÀI ĐẶT SOCKET.IO ---

// (QUAN TRỌNG) Đổi URL này thành URL Render của bạn (BƯỚC 6)
// Hoặc giữ 'http://localhost:8080' nếu đang test BƯỚC 4
const BACKEND_URL = "https://testing-chessweb-fe.vercel.app/"; 
const socket = io(BACKEND_URL);

socket.on('connect', () => {
    console.log('Đã kết nối thành công với máy chủ Socket.IO');
    statusEl.textContent = 'Đã kết nối. Đang chờ dữ liệu...';
    statusEl.className = 'connected';
});

socket.on('disconnect', (reason) => {
    console.log('Bị ngắt kết nối:', reason);
    statusEl.textContent = 'Mất kết nối. Đang thử lại...';
    statusEl.className = 'error';
});

socket.on('connect_error', (error) => {
    console.error('Lỗi kết nối:', error.message);
    statusEl.textContent = `Lỗi kết nối: ${BACKEND_URL} không phản hồi.`;
    statusEl.className = 'error';
});

// 3. LẮNG NGHE SỰ KIỆN CHÍNH: 'pico_move'
// Đây là sự kiện mà Backend gửi khi nhận được PGN từ Pi
socket.on('pico_move', (data) => {
    console.log('Đã nhận được PGN/Move từ server:', data);
    handleNewPgn(data.pgn);
});

// (MỚI) Lắng nghe lỗi Admin
socket.on('admin_error', (data) => {
    console.error('Lỗi Admin:', data.message);
    alert(`LỖI ADMIN: ${data.message}`); // Dùng alert ở đây chấp nhận được
});


// --- (MỚI) LOGIC TUA LẠI VÁN CỜ ---

// Hàm này cập nhật bàn cờ và PGN đến 1 nước đi cụ thể
function navigateToMove(moveIndex) {
    if (moveIndex < 0 || moveIndex >= moveHistory.length) return;

    currentMoveIndex = moveIndex;
    
    // 1. Cập nhật vị trí bàn cờ
    const fen = moveHistory[currentMoveIndex];
    board.position(fen, true);

    // 2. Cập nhật highlight trong danh sách PGN
    highlightPgnMove(currentMoveIndex);

    // 3. Cập nhật trạng thái các nút bấm
    updateButtons();
}

// Cập nhật trạng thái (enable/disable) của các nút
function updateButtons() {
    // Nút Back/Start: Bị vô hiệu hóa nếu ở đầu ván
    btnStart.disabled = (currentMoveIndex <= 0);
    btnBack.disabled = (currentMoveIndex <= 0);

    // Nút Next/End: Bị vô hiệu hóa nếu ở cuối ván
    btnNext.disabled = (currentMoveIndex >= moveHistory.length - 1);
    btnEnd.disabled = (currentMoveIndex >= moveHistory.length - 1);
}

// Xử lý khi bấm nút
btnStart.onclick = () => navigateToMove(0);
btnBack.onclick = () => navigateToMove(currentMoveIndex - 1);
btnNext.onclick = () => navigateToMove(currentMoveIndex + 1);
btnEnd.onclick = () => navigateToMove(moveHistory.length - 1);


// --- CÀI ĐẶT BÀN CỜ VÀ PGN ---

// (MỚI) Highlight nước đi được chọn trong PGN list
function highlightPgnMove(moveIndex) {
    // Xóa tất cả highlight cũ
    document.querySelectorAll('.white-move, .black-move').forEach(el => {
        el.classList.remove('selected');
    });

    if (moveIndex > 0) { // Index 0 là 'start', không có nước đi
        // Tìm nước đi tương ứng
        const selectedEl = document.querySelector(`[data-move-index="${moveIndex}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
            
            // Tự động cuộn PGN đến nước đi được chọn
            selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}


// (MỚI) Cập nhật giao diện PGN (chia 2 cột)
function updatePgnDisplay() {
    pgnContainer.innerHTML = '';
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
            whiteMoveEl.dataset.moveIndex = moveIndex; // Thêm data-index
            
            pgnContainer.appendChild(pgnRow);
        } 
        else if (move.color === 'b') {
            const blackMoveEl = pgnRow.querySelector('.black-move');
            blackMoveEl.textContent = move.san;
            blackMoveEl.dataset.moveIndex = moveIndex; // Thêm data-index
            
            moveNumber++;
        }
        moveIndex++;
    }

    // (MỚI) Thêm sự kiện click cho TẤT CẢ các nước đi PGN
    pgnContainer.querySelectorAll('.white-move, .black-move').forEach(el => {
        if(el.textContent) { // Chỉ thêm nếu có nước đi
            el.onclick = (e) => {
                const index = parseInt(e.target.dataset.moveIndex);
                navigateToMove(index);
            };
        }
    });
}

// (MỚI) Hàm xử lý PGN nhận được (Đã viết lại hoàn toàn)
function handleNewPgn(pgnString) {
    // 1. Thử tải PGN vào logic cờ
    const success = game.load_pgn(pgnString);
    if (!success) {
        console.error('Lỗi: PGN không hợp lệ', pgnString);
        statusEl.textContent = `Lỗi: PGN nhận được không hợp lệ: ${pgnString}`;
        statusEl.className = 'error';
        return;
    }

    // 2. Tái tạo lại lịch sử FEN (quan trọng nhất)
    moveHistory = [];
    fullPgnHistory = [];
    const tempGame = new Chess(); // Tạo 1 game tạm
    
    moveHistory.push(tempGame.fen()); // Index 0: Vị trí 'start'
    fullPgnHistory.push("Ván mới");

    const moves = game.history(); // Lấy PGN đã được load
    for (const move of moves) {
        tempGame.move(move);
        moveHistory.push(tempGame.fen()); // Lưu FEN sau mỗi nước đi
        fullPgnHistory.push(tempGame.pgn({ max_width: 5 })); // Lưu PGN
    }

    // 3. Cập nhật lại toàn bộ bảng PGN (chia 2 cột)
    updatePgnDisplay();

    // 4. Quyết định xem nên nhảy đến đâu
    // Nếu chúng ta đang ở cuối (xem live), hoặc mới bắt đầu
    if (currentMoveIndex === -1 || currentMoveIndex === moveHistory.length - 2) {
        // Tự động nhảy đến nước đi mới nhất
        navigateToMove(moveHistory.length - 1);
    } else {
        // Người dùng đang "tua lại"
        // Chỉ cập nhật PGN, không thay đổi vị trí bàn cờ
        // Cập nhật lại nút bấm (vì ván cờ đã dài ra)
        updateButtons();
    }
    
    statusEl.textContent = `Đã nhận PGN. Tổng ${moves.length} nước đi.`;
    statusEl.className = 'connected';
}

// Hàm này chạy khi trang web được tải xong
function onDocumentLoad() {
    // 1. Cấu hình bàn cờ
    const config = {
        draggable: false, // Người xem không thể kéo thả
        position: 'start', // Vị trí ban đầu
        
        // **** DÒNG SỬA LỖI NẰM Ở ĐÂY ****
        // Link cũ (lỗi): '.../chesfpieces/...' (SAI)
        // Link mới (đã sửa):
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };

    // 2. Khởi tạo bàn cờ
    board = Chessboard('myBoard', config);
    
    // 3. Khởi tạo trạng thái ban đầu
    moveHistory = [game.fen()]; // Thêm vị trí 'start'
    currentMoveIndex = 0;
    updateButtons(); // Vô hiệu hóa tất cả nút khi mới bắt đầu

    // 4. Tự động thay đổi kích thước bàn cờ khi cửa sổ thay đổi
    $(window).resize(board.resize);

    // 5. (MỚI) KÍCH HOẠT BẢNG ADMIN
    // Nếu URL là: ...vercel.app/?admin=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        adminPanel.style.display = 'flex'; // Hiển thị bảng admin
        console.log('Chế độ Admin đã được kích hoạt');
    }

    // 6. (MỚI) Gắn sự kiện cho nút Gửi Admin
    adminSendBtn.onclick = () => {
        const pgn = adminPgnInput.value;
        const pass = adminPassword.value;

        if (!pgn || !pass) {
            alert('Vui lòng nhập Mật khẩu và PGN');
            return;
        }

        console.log('Admin đang gửi PGN sửa lỗi:', pgn);
        // Gửi PGN và mật khẩu lên server
        socket.emit('admin_fix_pgn', { 
            pgn: pgn, 
            password: pass 
        });
    };
}

// Chạy hàm onDocumentLoad khi trang web đã sẵn sàng
$(document).ready(onDocumentLoad);