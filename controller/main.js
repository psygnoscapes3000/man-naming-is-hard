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

function connect() {
  socket = io({ transports: [ 'websocket' ], upgrade: false });

  socket.on('connect', () => {
    console.log('connected');
    socket.emit('identify', { isPlayer: true });
  });

  socket.on('time', (time) => {
    targetServerTimeDelta = Date.now() - time;
  });

  socket.on('car', (car) => {
    const carInfo = CARS[car];

    const name = document.getElementById('name');
    name.style.color = carInfo.highlightColor;
    name.innerHTML = carInfo.name;

    document.getElementById('car').style.display = 'block';
    document.getElementById('car').className = car.toLowerCase();
  });

  socket.on('max_players_reached', () => {
    document.getElementById('car').style.display = 'none';

    const name = document.getElementById('name');
    name.style.color = '#666';
    name.innerHTML = 'Game full';
  });
}

function disconnect() {
  socket.close();
  // @todo exit raf
}

function emitAction(action) {
  console.log('action', action);
  socket.emit('action', action);
}

window.onload = () => {
  const preamble = document.getElementById('preamble');
  const join = document.getElementById('join');
  const quit = document.getElementById('quit');
  const surface = document.getElementById('surface');
  const ctx = surface.getContext('2d');

  const MAX_HEIGHT = 160;

  function resize() {
    surface.width = MAX_HEIGHT / surface.clientHeight * surface.clientWidth;
    surface.height = MAX_HEIGHT;

    ctx.imageSmoothingEnabled = false;
  }

  window.addEventListener('resize', resize);

  resize();

  join.addEventListener('click', () => {
    preamble.style.display = 'none';

    if (screenfull.enabled) {
      screenfull.request();
    }

    connect();
  });

  quit.addEventListener('click', () => {
    preamble.style.display = 'block';

    if (screenfull.enabled) {
      screenfull.exit();
    }

    disconnect();
  });

  // const hammertime = new Hammer(surface, {});

  // hammertime.on('tap', (evt) => {
  // });

  [ 'left', 'right', 'up', 'down' ].forEach((action) => {
    const button = document.getElementById(action);
    button.addEventListener('click', () => {
      emitAction(action);
    });
  });

  function paint() {
    requestAnimationFrame(paint);

    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, surface.width, MAX_HEIGHT);

    const ROUND_SECONDS = 3;

    if (serverTimeDelta === null) {
      serverTimeDelta = targetServerTimeDelta;
    } else {
      serverTimeDelta += (targetServerTimeDelta - serverTimeDelta) * 0.2;
    }

    const serverTime = Date.now() - serverTimeDelta;
    const serverSeconds = serverTime / 1000;
    const ratio = 1 - serverSeconds % ROUND_SECONDS / ROUND_SECONDS;

    const GUTTER = 8;
    const DONUT_R = MAX_HEIGHT / 15;
    const DONUT_THICKNESS = DONUT_R - MAX_HEIGHT / 17;
    const DONUT_X = GUTTER + DONUT_R;
    const DONUT_Y = MAX_HEIGHT - GUTTER - DONUT_R;

    ctx.fillStyle = `hsl(${120 * ratio}, 100%, 50%)`;
    ctx.beginPath();
    ctx.moveTo(DONUT_X, DONUT_Y);
    ctx.arc(DONUT_X, DONUT_Y, DONUT_R, 0, Math.PI * 2 * ratio);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(DONUT_X, DONUT_Y, DONUT_R - DONUT_THICKNESS, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(paint);
};
