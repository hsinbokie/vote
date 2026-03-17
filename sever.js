// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 設定靜態檔案資料夾 (用來放 HTML/CSS/JS)
app.use(express.static('public'));

// 遊戲狀態 (記憶體暫存)
let players = {};
let votes = { A: 0, B: 0, C: 0, D: 0 };
let currentQuestion = {
    title: "請問台灣最高的山是哪一座？",
    options: { A: "陽明山", B: "阿里山", C: "玉山", D: "雪山" }
};

io.on('connection', (socket) => {
    console.log('有使用者連線:', socket.id);

    // 處理使用者登入/加入遊戲
    socket.on('joinGame', (username) => {
        players[socket.id] = { name: username, hasVoted: false };
        console.log(`${username} 加入了遊戲`);
        
        // 傳送當前題目給該玩家
        socket.emit('loadQuestion', currentQuestion);
        // 廣播給所有人更新玩家人數
        io.emit('updatePlayers', Object.keys(players).length);
    });

    // 處理投票
    socket.on('submitVote', (option) => {
        if (players[socket.id] && !players[socket.id].hasVoted) {
            votes[option]++;
            players[socket.id].hasVoted = true;
            console.log(`${players[socket.id].name} 投給了 ${option}`);
            
            // 即時廣播最新票數給所有人
            io.emit('updateResults', votes);
        }
    });

    // 處理斷線
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`${players[socket.id].name} 離開了遊戲`);
            delete players[socket.id];
            io.emit('updatePlayers', Object.keys(players).length);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`伺服器已啟動，監聽 Port: ${PORT}`);
});