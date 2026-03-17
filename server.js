const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let isQuestionActive = false; // 控制現在是否可以投票
let timeLeft = 15; // 每題 15 秒
let timer;

// 設定題目與正確答案
let currentQuestion = {
    title: "請問奇洋與彥翎的婚宴辦在哪一間飯店？",
    options: { A: "君悅酒店", B: "W Hotel", C: "君品酒店", D: "萬豪酒店" },
    answer: "C" // 正確答案
};

io.on('connection', (socket) => {
    // 玩家加入
    socket.on('joinGame', (username) => {
        players[socket.id] = { name: username, score: 0, hasVoted: false };
        io.emit('updatePlayers', Object.keys(players).length);
        socket.emit('loadQuestion', currentQuestion);
    });

    // 任何人都可以點擊「開始遊戲」觸發計時
    socket.on('startGame', () => {
        if (isQuestionActive) return;
        
        isQuestionActive = true;
        timeLeft = 15;
        
        // 重置所有人的投票狀態
        for (let id in players) players[id].hasVoted = false;
        
        io.emit('gameStarted'); // 通知前端遊戲開始

        // 開始倒數計時
        timer = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(timer);
                isQuestionActive = false;
                
                // 時間到，計算排名並廣播結果
                let ranking = Object.values(players)
                    .sort((a, b) => b.score - a.score) // 分數高的在前面
                    .slice(0, 5); // 只取前 5 名
                
                io.emit('showResults', { answer: currentQuestion.answer, ranking: ranking });
            }
        }, 1000);
    });

    // 處理投票與計分
    socket.on('submitVote', (option) => {
        let player = players[socket.id];
        if (player && isQuestionActive && !player.hasVoted) {
            player.hasVoted = true;
            
            // 如果答對了，根據剩餘時間給分 (越快分數越高)
            if (option === currentQuestion.answer) {
                let timeBonus = timeLeft * 10; // 每剩1秒多10分
                player.score += (100 + timeBonus); // 基礎分 100 + 速度加成
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', Object.keys(players).length);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器已啟動，監聽 Port: ${PORT}`);
});
