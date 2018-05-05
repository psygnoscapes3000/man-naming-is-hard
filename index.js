const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(8013);

app.use('/', express.static('.'));

let players = [];

class Player {
  constructor(socket) {
    this.socket = socket;
    this.state = 'NEW';
    this.nextAction = null;
    this.row = null;
    this.col = null;
  }
}

const ROWS = 4;
const COLS = 3;

function isOccupied(col, row) {
  return players.some((player) => player.row === row && player.col === col);
}

// Find an empty slot to place the player and return true if found
function placePlayer(player) {
  player.row = Math.floor(Math.random() * ROWS);
  player.col = Math.floor(Math.random() * COLS);

  return !isOccupied(player.col, player.row);
}

io.on('connection', (socket) => {
  console.log('connected');

  socket.on('identify', (identity) => {
    if (identity.isPlayer) {
      if (players.length === ROWS * COLS) {
        console.log('max players');
        return;
      }

      const player = new Player(socket);

      while (!placePlayer(player));

      players.push(player);

      console.log('players', players.length);

      socket.on('disconnect', () => {
        console.log('player disconnected');
        players = players.filter((player) => player.socket !== socket);
        console.log('players', players.length);
      });

      socket.on('action', (action) => {
        console.log('action', action);
        socket.emit('action_ack', action);
        player.nextAction = action;
      });
    } else {
      console.log('projector connected');
    }
  });
});

function tick() {
  const time = Date.now();

  io.emit('time', time);

  const seconds = Math.floor(time / 1000);

  if (seconds % 5 === 0) {
    console.log('new turn');
    io.emit('turn', {
      players: players.map((player) => ({
        ...player,
        socket: undefined
      }))
    });

    players.forEach((player) => {
      player.nextAction = null;
      player.state = 'PLAYING';
    });
  }
}

setInterval(tick, 1000);
