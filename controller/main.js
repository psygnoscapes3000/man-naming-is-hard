const socket = io({ transports: [ 'websocket' ], upgrade: false });

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

let state = {};

socket.on('connect', () => {
  console.log('connected');
  socket.emit('identify', { isPlayer: true });
});

let serverTimeDelta = null;
let targetServerTimeDelta = null;

socket.on('time', (time) => {
  targetServerTimeDelta = Date.now() - time;
});

socket.on('action_ack', (action) => {
  console.log('action ack');
  state.action = action;
});

socket.on('car', (car) => {
  console.log('my car is', car);
  state.car = car;
});

socket.on('max_players_reached', () => {
  console.error('No space on server');
  state.error = 'No space on server';
});

socket.on('turn', () => {
  state.action = null;
});

function emitAction(action) {
  console.log('action', action);
  socket.emit('action', action);
}

const arcadeButtons = new Image();
arcadeButtons.src = 'arcade-buttons.png';

window.onload = () => {
  const fullscreen = document.getElementById('fullscreen');
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

  if (screenfull.enabled) {
    fullscreen.addEventListener('click', () => {
      fullscreen.parentNode.removeChild(fullscreen);
      screenfull.request(surface);
    });
  }

  const hammertime = new Hammer(surface, {});

  const GUTTER = 8;
  const BUTTON_WIDTH = 41;
  const BUTTON_HEIGHT = 42;
  const BUTTON_SPACING = 10;
  const ACTIVE_BUTTON_OFFSET = BUTTON_WIDTH + 5;
  const NAME_SIZE = 32;

  const buttons = [];

  buttons.push({
    action: 'left',
    x: () => GUTTER,
    y: () => (MAX_HEIGHT - BUTTON_HEIGHT) / 2
  });
  buttons.push({
    action: 'right',
    x: () => GUTTER + BUTTON_WIDTH + BUTTON_SPACING,
    y: () => (MAX_HEIGHT - BUTTON_HEIGHT) / 2
  });
  buttons.push({
    action: 'up',
    x: () => surface.width - GUTTER - BUTTON_WIDTH,
    y: () => (MAX_HEIGHT - BUTTON_SPACING) / 2 - BUTTON_HEIGHT
  });
  buttons.push({
    action: 'down',
    x: () => surface.width - GUTTER - BUTTON_WIDTH,
    y: () => (MAX_HEIGHT + BUTTON_SPACING) / 2
  });

  hammertime.on('tap', (evt) => {
    const normX = evt.center.x / surface.clientHeight * MAX_HEIGHT;
    const normY = evt.center.y / surface.clientHeight * MAX_HEIGHT;

    buttons.some((button) => {
      if (normX >= button.x() && normX < button.x() + BUTTON_WIDTH && normY >= button.y() && normY < button.y() + BUTTON_HEIGHT) {
        emitAction(button.action);
        return true;
      }
    });
  });

  function paint() {
    requestAnimationFrame(paint);

    ctx.fillStyle = '#333333';
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

    ctx.fillStyle = `hsl(${120 * ratio}, 100%, 50%)`;
    ctx.beginPath();
    ctx.moveTo(surface.width / 2, MAX_HEIGHT / 2);
    ctx.arc(surface.width / 2, MAX_HEIGHT / 2, MAX_HEIGHT / 8, 0, Math.PI * 2 * ratio);
    ctx.fill();
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(surface.width / 2, MAX_HEIGHT / 2, MAX_HEIGHT / 10, 0, Math.PI * 2);
    ctx.fill();

    buttons.forEach((button) => {
      ctx.drawImage(
        arcadeButtons,
        button.action === state.action ? ACTIVE_BUTTON_OFFSET : 0, 0,
        BUTTON_WIDTH, BUTTON_HEIGHT,
        button.x(), button.y(),
        BUTTON_WIDTH, BUTTON_HEIGHT
      );
    });

    if (state.car) {
      const car = CARS[state.car];

      ctx.font = `${NAME_SIZE}px VT323, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = car.highlightColor;
      ctx.fillText(car.name, surface.width / 2, NAME_SIZE);
    }
  }

  requestAnimationFrame(paint);
};
