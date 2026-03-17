const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let isQuestionActive = false;
let timeLeft = 15;
let timer;

// 題庫設計 (可以無限往下加)
let questions = [
    { title: "請問奇洋與彥翎的婚宴辦在哪一間飯店？", options: { A: "君悅酒店", B: "W Hotel", C: "君品酒店", D: "萬豪酒店" }, answer: "C" },
    { title: "新郎最喜歡吃哪一種食物？", options: { A: "火鍋", B: "拉麵", C: "牛排", D: "壽司" }, answer: "B" } // 請自行修改正確答案
];
let currentQuestionIndex = 0;

io.on('connection', (socket) => {
    // 玩家加入
    socket.on('joinGame', (username) => {
        players[socket.id] = { name: username, score: 0, hasVoted: false };
        io.emit('updatePlayers', Object.keys(players).length);
        socket.emit('waitingForHost'); // 告訴玩家等待主持人出題
    });

    // 主持人發送下一題
    socket.on('nextQuestion', () => {
        if (currentQuestionIndex < questions.length) {
            let q = questions[currentQuestionIndex];
            io.emit('loadQuestion', { title: q.title, options: q.options });
        } else {
            io.emit('gameOver'); // 題目沒了，遊戲結束
        }
    });

    // 主持人按下開始計時
    socket.on('startGame', () => {
        if (isQuestionActive || currentQuestionIndex >= questions.length) return;
        
        isQuestionActive = true;
        timeLeft = 15;
        for (let id in players) players[id].hasVoted = false;
        
        io.emit('gameStarted');

        timer = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(timer);
                isQuestionActive = false;
                
                let q = questions[currentQuestionIndex];
                let ranking = Object.values(players)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5); // 取前五名
                
                io.emit('showResults', { answer: q.answer, ranking: ranking });
                currentQuestionIndex++; // 準備進入下一題
            }
        }, 1000);
    });

    // 玩家投票
    socket.on('submitVote', (option) => {
        let player = players[socket.id];
        let q = questions[currentQuestionIndex];
        if (player && isQuestionActive && !player.hasVoted) {
            player.hasVoted = true;
            if (option === q.answer) {
                let timeBonus = timeLeft * 10;
                player.score += (100 + timeBonus);
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
    console.log(`伺服器啟動: ${PORT}`);
});
