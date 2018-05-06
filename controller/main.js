const CARS = {
  FURY: {
    name: 'Fury',
    color: '#ee0022',
    highlightColor: '#ee4444'
  },
  STING: {
    name: 'Sting',
    color: '#eecc00',
    highlightColor: '#eeee44'
  },
  STORM: {
    name: 'Storm',
    color: '#00eecc',
    highlightColor: '#44eeee'
  },
  MAGIC: {
    name: 'Magic',
    color: '#6600ee',
    highlightColor: '#9944ee'
  }
};

let socket = null;
let serverTimeDelta = null;
let targetServerTimeDelta = null;
let roundRatio = null;
let prevRoundRatio = null;
let isPlaying = false;

function connect() {
  socket = io({ transports: [ 'websocket' ], upgrade: false });

  socket.on('connect', () => {
    socket.emit('identify', { isPlayer: true });
  });

  socket.on('disconnect', () => {
    isPlaying = false;
  });

  socket.on('time', (time) => {
    targetServerTimeDelta = Date.now() - time;
  });

  socket.on('join', (player) => {
    document.getElementById('game').style.display = 'block';
    document.getElementById('game-full').style.display = 'none';

    const carInfo = CARS[player.car];

    const name = document.getElementById('name');
    name.style.color = carInfo.highlightColor;
    name.innerHTML = carInfo.name;
    document.getElementById('car').className = player.car.toLowerCase();

    isPlaying = true;
  });

  socket.on('game-full', () => {
    document.getElementById('game').style.display = 'none';
    document.getElementById('game-full').style.display = 'block';
    isPlaying = false;
  });
}

function disconnect() {
  socket.close();
}

function emitAction(action) {
  socket.emit('action', action);
}

window.onload = () => {
  const preamble = document.getElementById('preamble');

  function join() {
    preamble.style.display = 'none';

    if (screenfull.enabled) {
      screenfull.request();
    }

    connect();
  }

  function quit() {
    preamble.style.display = 'block';

    if (screenfull.enabled) {
      screenfull.exit();
    }

    disconnect();
  }

  document.getElementById('join').addEventListener('click', join);
  document.getElementById('back').addEventListener('click', quit);
  document.getElementById('quit').addEventListener('click', quit);

  // const hammertime = new Hammer(roundTimer, {});

  // hammertime.on('tap', (evt) => {
  // });

  [ 'left', 'right', 'up', 'down' ].forEach((action) => {
    const button = document.getElementById(action);
    button.addEventListener('click', () => {
      emitAction(action);
    });
  });

  const ROUND_SECONDS = 3;

  setInterval(() => {
    if (serverTimeDelta === null) {
      serverTimeDelta = targetServerTimeDelta;
    } else {
      serverTimeDelta += (targetServerTimeDelta - serverTimeDelta) * 0.2;
    }

    const serverTime = Date.now() - serverTimeDelta;
    const serverSeconds = serverTime / 1000;
    roundRatio = 1 - serverSeconds % ROUND_SECONDS / ROUND_SECONDS;

    if (prevRoundRatio !== null) {
      if (roundRatio > prevRoundRatio) {
        if (isPlaying && window.navigator.vibrate) {
          window.navigator.vibrate(50);
        }
      }
    }

    prevRoundRatio = roundRatio;
  }, 1000 / 60);

  const roundTimer = document.getElementById('round-timer');

  function paint() {
    requestAnimationFrame(paint);

    roundTimer.width = roundTimer.clientWidth / 5;
    roundTimer.height = roundTimer.clientHeight / 5;
    const ctx = roundTimer.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, roundTimer.width, roundTimer.height);

    const DONUT_R = roundTimer.width / 2;
    const DONUT_THICKNESS = DONUT_R - roundTimer.width / 3;
    const DONUT_X = DONUT_R;
    const DONUT_Y = DONUT_R;

    ctx.fillStyle = `hsl(${120 * roundRatio}, 100%, 50%)`;
    ctx.beginPath();
    ctx.moveTo(DONUT_X, DONUT_Y);
    ctx.arc(DONUT_X, DONUT_Y, DONUT_R, 0, Math.PI * 2 * roundRatio);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(DONUT_X, DONUT_Y, DONUT_R - DONUT_THICKNESS, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(paint);
};
