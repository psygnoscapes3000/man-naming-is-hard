const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const browserifyMiddleware = require('browserify-middleware');

io.set('transports', [ 'websocket' ]);

server.listen(8013);

const projectorFile = __dirname + '/projector/index.js';
app.get('/_projector/index.js', browserifyMiddleware([ { [projectorFile]: { run: true } }]));
app.use('/_projector', express.static(__dirname + '/projector'));
app.use('/', express.static(__dirname + '/controller'));

const CARS = [ 'FURY', 'STING', 'STORM', 'MAGIC' ];

let players = [];

class Player {
  constructor() {
    this.state = 'NEW'; // @todo take out if projector doesn't need this
    this.action = null;
    this.row = null;
    this.col = null;
    this.car = null;
  }
}

const ROWS = 4;
const COLS = 3;

function isOccupied(col, row) {
  return players.find((player) => player.row === row && player.col === col);
}

function isCarTaken(car) {
  return players.some((player) => player.car === car);
}

function movePlayer(player, cols, rows) {
  const newCol = player.col + cols;
  const newRow = player.row + rows;

  if (newCol < 0 || newCol > COLS - 1 || newRow < 0 || newRow > ROWS - 1) {
    return false;
  }

  const other = isOccupied(newCol, newRow);
  if (other) {
    if (rows > 0) {
      other.col = player.col;
      other.row = player.row;
      other.action = null; // prevent other player from moving
    } else {
      return false;
    }
  }

  player.col = newCol;
  player.row = newRow;

  return true;
}

// Find an empty slot to place the player and return true if found
function placePlayer(player) {
  player.row = Math.floor(Math.random() * ROWS);
  player.col = Math.floor(Math.random() * COLS);

  return !isOccupied(player.col, player.row);
}

// Find unassigned car and return if found
function assignCar(player) {
  player.car = CARS[Math.random() * CARS.length | 0];

  return !isCarTaken(player.car);
}

const npcList = [];

function addNpc() {
  const npc = new Player();

  while (!placePlayer(npc));
  while (!assignCar(npc));

  players.push(npc);

  npcList.push(npc);
}

function removeNpc() {
  if (!npcList.length) {
    return;
  }

  const npc = npcList.shift();

  players = players.filter((p) => p !== npc);
}

addNpc();
addNpc();

io.on('connection', (socket) => {
  console.log('connected');

  socket.on('identify', (identity) => {
    if (identity.isPlayer) {
      if (!(players.length < CARS.length)) {
        console.log('game full');
        socket.emit('game-full');
        return;
      }

      const player = new Player();

      while (!placePlayer(player));
      while (!assignCar(player));

      socket.emit('join', { car: player.car });

      players.push(player);

      console.log('players', players.length);

      if (players.length > CARS.length - 1) {
        removeNpc();
      }

      socket.on('disconnect', () => {
        console.log('player disconnected');
        players = players.filter((p) => p !== player);
        console.log('players', players.length);

        if (players.length < CARS.length - 1 && npcList.length < 2) {
          addNpc();
        }
      });

      socket.on('action', (action) => {
        console.log('action', action);
        player.action = action;
      });
    } else {
      console.log('projector connected');

      socket.emit('init', {
        players: players.map((player) => ({
          ...player
        }))
      });
    }
  });
});

function tick() {
  const time = Date.now();

  io.emit('time', time);

  const seconds = Math.floor(time / 1000);

  const ROUND_SECONDS = 3;

  if (seconds % ROUND_SECONDS === 0) {
    console.log('new turn');

    // randomize NPC movement
    const npcActions = [ 'left', 'right', 'up', 'down' ];
    npcList.forEach(npc => {
      npc.action = npcActions[Math.floor(Math.random() * npcActions.length)];
    });

    players.forEach((player) => {
      if (player.action) {
        switch (player.action) {
        case 'left':
          movePlayer(player, -1, 0);
          break;
        case 'right':
          movePlayer(player, 1, 0);
          break;
        case 'up':
          movePlayer(player, 0, 1);
          break;
        case 'down':
          movePlayer(player, 0, -1);
          break;
        }
      }

      player.action = null;
    });

    io.emit('turn', {
      players: players.map((player) => ({
        ...player,
        socket: undefined
      }))
    });

    players.forEach((player) => {
      player.state = 'PLAYING';
    });
  }
}

setInterval(tick, 1000);
