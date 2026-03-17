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
// === 替換成這個全新的出題與計時邏輯 ===
    socket.on('nextQuestion', () => {
        // 如果還在倒數中，避免主持人不小心連按
        if (isQuestionActive) return; 

        if (currentQuestionIndex < questions.length) {
            let q = questions[currentQuestionIndex];
            
            // 進入答題狀態，設定為 5 秒
            isQuestionActive = true;
            timeLeft = 5; 
            for (let id in players) players[id].hasVoted = false;

            // 同時發送題目給大螢幕，並通知所有人「遊戲開始」
            io.emit('loadQuestion', { title: q.title, options: q.options });
            io.emit('gameStarted'); 

            // 啟動 5 秒倒數計時器
            timer = setInterval(() => {
                timeLeft--;
                io.emit('timerUpdate', timeLeft);

                if (timeLeft <= 0) {
                    clearInterval(timer);
                    isQuestionActive = false;
                    
                    // 時間到，計算排名並廣播結果
                    let ranking = Object.values(players)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 5); 
                    
                    io.emit('showResults', { answer: q.answer, ranking: ranking });
                    currentQuestionIndex++; // 準備進入下一題
                }
            }, 1000);
        } else {
            io.emit('gameOver'); // 題目沒了
        }
    });
    // ============================
  
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
