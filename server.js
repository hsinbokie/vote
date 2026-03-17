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
// === 替換全新的出題與毫秒計分邏輯 ===
    let questionStartTime = 0;
    const TIME_LIMIT = 5000; // 5秒 = 5000毫秒

    socket.on('nextQuestion', () => {
        if (isQuestionActive) return; 

        if (currentQuestionIndex < questions.length) {
            let q = questions[currentQuestionIndex];
            
            isQuestionActive = true;
            for (let id in players) players[id].hasVoted = false;

            // 記錄這題開始的精準毫秒時間
            questionStartTime = Date.now(); 
            
            // 發送題目給大螢幕，並通知手機端「遊戲開始」
            io.emit('loadQuestion', { title: q.title, options: q.options });

            // 後端精準等待 5 秒後，自動結算這題並關閉作答
            setTimeout(() => {
                isQuestionActive = false;
                
                let ranking = Object.values(players)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5); 
                
                // 廣播結果，讓大螢幕切換到「排名頁面」
                io.emit('showResults', { answer: q.answer, ranking: ranking });
                currentQuestionIndex++; // 準備好下一題的進度
            }, TIME_LIMIT);
        } else {
            io.emit('gameOver'); 
        }
    });

    socket.on('submitVote', (option) => {
        let player = players[socket.id];
        let q = questions[currentQuestionIndex];
        
        if (player && isQuestionActive && !player.hasVoted) {
            player.hasVoted = true;
            if (option === q.answer) {
                // 計算玩家花了多少毫秒才作答
                let timeTaken = Date.now() - questionStartTime; 
                // 剩餘的時間直接變成加分 (最高 5000 分)
                let timeBonus = Math.max(0, TIME_LIMIT - timeTaken); 
                
                // 基礎分 1000 + 速度毫秒加分
                player.score += (1000 + timeBonus); 
            }
        }
    });
    // ============================
// === 新增：主持人重置遊戲 ===
    socket.on('resetGame', () => {
        // 1. 題目回到第一題
        currentQuestionIndex = 0;
        // 2. 停止目前的計時器（如果有在跑的話）
        isQuestionActive = false;
        clearInterval(timer); 
        
        // 3. 把所有線上玩家的分數和投票狀態歸零
        for (let id in players) {
            players[id].score = 0;
            players[id].hasVoted = false;
        }
        
        // 4. 廣播給所有人：遊戲已經重置！
        io.emit('gameReset');
    });
    // ============================
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', Object.keys(players).length);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器啟動: ${PORT}`);
});
