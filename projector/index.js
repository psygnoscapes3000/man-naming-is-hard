const fs = require('fs');
const onecolor = require('onecolor');
const vec2 = require('gl-matrix').vec2;
const vec3 = require('gl-matrix').vec3;
const vec4 = require('gl-matrix').vec4;
const mat4 = require('gl-matrix').mat4;
const glsl = require('glslify');
const io = require('socket.io-client')('http://localhost:8013', { transports: [ 'websocket' ], upgrade: false });

const parseGLSLConstants = require('./parseGLSLConstants');
const { createSegmentRenderer } = require('./segment');
const { getSegmentItemBatchDefinition, createSegmentItemBatchRenderer } = require('./segmentItemBatch');

const ROAD_SETTINGS = parseGLSLConstants(
  fs.readFileSync(__dirname + '/roadSettings.glsl', 'utf8')
);

document.title = 'MIDNIGHT TACTIX 3000';

document.body.parentElement.style.height = '100%';
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.height = '100%';
document.body.style.background = '#70787f';
document.body.style.position = 'relative';

const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0vh';
canvas.style.left = '0vw';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.background = '#fff';
document.body.appendChild(canvas);

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
const aspectRatio = canvas.height / canvas.width;

const div = document.createElement('div');
div.style.position = 'fixed';
div.style.bottom = '10px';
div.style.right = '20px';
div.style.opacity = 0.2;
div.style.color = '#fff';
div.style.fontFamily = 'Arial';
div.style.fontSize = '24px';
div.appendChild(document.createTextNode('github.com/psygnoscapes3000'));
document.body.appendChild(div);

const regl = require('regl')({
  canvas: canvas,
  attributes: { antialias: false, alpha: false }
});

const carTexture = regl.texture({ width: 64, height: 64, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat' });
const carImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/car.png', 'binary'));
loadImage(carImageURI).then(img => {
  carTexture({ width: img.width, height: img.height, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat', data: img });
});

const roadTexture = regl.texture({ width: 64, height: 64, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat' });
const roadImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/road.png', 'binary'));
loadImage(roadImageURI).then(img => {
  roadTexture({ width: img.width, height: img.height, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat', data: img });
});

const roadEdgeTexture = regl.texture({ width: 64, height: 64, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat' });
const roadEdgeImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/road-edge.png', 'binary'));
loadImage(roadEdgeImageURI).then(img => {
  roadEdgeTexture({ width: img.width, height: img.height, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat', data: img });
});

roadCmd = regl({
  vert: glsl`
    precision mediump float;

    #pragma glslify: roadSettings = require('./roadSettings')

    uniform float cameraSideOffset;
    uniform mat4 camera;
    uniform float segmentOffset;
    uniform float segmentLength;
    attribute vec2 position;

    varying vec2 viewPlanePosition;

    void main() {
      float roadHalfWidth = (roadLaneWidth * (roadLaneCount + 1.0)) * 0.5 + roadPaddingWidth;
      float roadY = position.y * segmentLength + segmentOffset;

      gl_Position = camera * vec4(
        0,
        roadY,
        0,
        1.0
      );

      vec4 edgePosition = camera * vec4(
        roadHalfWidth * position.x,
        roadY,
        0,
        1.0
      );

      // @todo horizontal camera movement is totally busted
      viewPlanePosition = vec2(
        gl_Position.w * roadHalfWidth / (edgePosition.x - gl_Position.x) + cameraSideOffset,
        roadY
      );

      // un-correct perspective to fill screen horizontally
      gl_Position.x = position.x * gl_Position.w;
    }
  `,

  frag: glsl`
    precision mediump float;

    #pragma glslify: roadSettings = require('./roadSettings')
    #pragma glslify: computeSegmentX = require('./segment')

    uniform float segmentOffset;
    uniform float segmentStart;
    uniform vec3 segmentCurve;
    uniform sampler2D roadTexture;
    uniform sampler2D roadEdgeTexture;

    varying vec2 viewPlanePosition;

    void main() {
      float roadHalfWidth = (roadLaneWidth * (roadLaneCount + 1.0)) * 0.5 + roadPaddingWidth;

      float segmentDepth = viewPlanePosition.y - segmentOffset;
      vec2 segmentPosition = vec2(
        viewPlanePosition.x - computeSegmentX(segmentDepth, segmentCurve),
        viewPlanePosition.y - segmentStart
      );

      if (abs(segmentPosition.x) > roadHalfWidth) {
        float fieldFactor = step(25.0, mod(segmentPosition.y, 50.0));
        gl_FragColor = vec4(0.08, 0.08 + 0.02 * fieldFactor, 0.18 + 0.08 * fieldFactor, 1.0);
        return;
      }

      float distToMidLane = abs(roadLaneWidth * 0.5 - abs(segmentPosition.x));
      float distToEdgeLane = abs(roadLaneWidth * 1.5 - abs(segmentPosition.x));

      float lanePosition = segmentPosition.x / roadLaneWidth + roadLaneCount * 0.5 - 0.5;
      vec2 texturePosition = vec2(
        lanePosition,
        (segmentPosition.y - lightOffset) / lightSpacing - 0.5
      );

      if (lanePosition >= 0.0 && lanePosition < roadLaneCount - 1.0) {
        gl_FragColor = texture2D(roadTexture, texturePosition);
      } else {
        gl_FragColor = texture2D(roadEdgeTexture, texturePosition);
      }
    }
  `,

  attributes: {
    position: regl.buffer([
      [ -1, 0 ],
      [ 1, 0 ],
      [ 1,  1 ],
      [ -1, 1 ]
    ])
  },

  uniforms: {
    roadTexture: roadTexture,
    roadEdgeTexture: roadEdgeTexture,
    cameraSideOffset: regl.prop('cameraSideOffset'),
    camera: regl.prop('camera')
  },

  primitive: 'triangle fan',
  count: 4
});

const postTexture = regl.texture({ width: 64, height: 64, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat' });
const postImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/post.png', 'binary'));
loadImage(postImageURI).then(img => {
  postTexture({ width: img.width, height: img.height, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat', data: img });
});

postCmd = regl({
  context: {
    batchItem: { vert: glsl`
      #pragma glslify: roadSettings = require('./roadSettings')
      #pragma glslify: computeSegmentX = require('./segment')

      varying float xOffset;

      void batchItemSetup(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
        xOffset = computeSegmentX(segmentDepth, segmentCurve);
      }

      vec3 batchItemCenter(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
        return vec3(
          postOffset + xOffset,
          0,
          postHeight * 0.5
        );
      }

      vec2 batchItemSize(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
        return vec2(
          postExtent * postWidthFraction,
          postHeight
        ) * 0.5;
      }
    `, frag: glsl`
      uniform sampler2D postTexture;

      vec4 batchItemColor(vec2 facePosition) {
        return texture2D(postTexture, facePosition * vec2(0.5, -0.5) - vec2(0.5, 0.5));
      }
    ` }
  },
  uniforms: {
    postTexture: postTexture
  }
});

const postTopTexture = regl.texture({ width: 64, height: 64, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat' });
const postTopImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/post-top.png', 'binary'));
loadImage(postTopImageURI).then(img => {
  postTopTexture({ width: img.width, height: img.height, min: 'nearest', mag: 'nearest', wrapS: 'repeat', wrapT: 'repeat', data: img });
});

postTopCmd = regl({
  context: {
    batchItem: { vert: glsl`
      #pragma glslify: roadSettings = require('./roadSettings')
      #pragma glslify: computeSegmentX = require('./segment')

      varying float xOffset;

      void batchItemSetup(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
        xOffset = computeSegmentX(segmentDepth, segmentCurve);
      }

      vec3 batchItemCenter(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
        return vec3(
          postOffset + xOffset - postExtent * 0.5 + postExtent * postWidthFraction * 0.5,
          0,
          postHeight + postTopHeight * 0.5
        );
      }

      vec2 batchItemSize(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
        return vec2(
          postExtent,
          postTopHeight
        ) * 0.5;
      }
    `, frag: glsl`
      uniform sampler2D postTopTexture;

      vec4 batchItemColor(vec2 facePosition) {
        return texture2D(postTopTexture, facePosition * vec2(0.5, -0.5) - vec2(0.5, 0.5));
      }
    ` }
  },
  uniforms: {
    postTopTexture: postTopTexture
  }
});

carCmd = regl({
  vert: glsl`
    #pragma glslify: roadSettings = require('./roadSettings')
    #pragma glslify: computeSegmentX = require('./segment', computeSegmentDX=computeSegmentDX)

    precision mediump float;

    uniform float segmentOffset;
    uniform vec3 segmentCurve;
    uniform float carPositionX;
    uniform float carPositionY;
    uniform mat4 camera;
    attribute vec2 position;

    varying vec2 facePosition;

    void main() {
      facePosition = position;

      float xOffset = computeSegmentX(carPositionY - segmentOffset, segmentCurve);

      gl_Position = camera * vec4(
        carPositionX + xOffset + position.x * 1.2,
        carPositionY,
        (position.y + 0.72) * 1.2,
        1.0
      );
    }
  `,

  frag: glsl`
    #pragma glslify: roadSettings = require('./roadSettings')

    precision mediump float;

    uniform float segmentStart;
    uniform float carIndex;
    uniform float carPositionY;
    uniform sampler2D carTexture;

    varying vec2 facePosition;

    void main() {
      float lightDistance = abs(mod((carPositionY - segmentStart + lightOffset) / lightSpacing, 1.0) - 0.5) * 2.0;

      gl_FragColor = texture2D(carTexture, facePosition * vec2(0.125, -0.5) + vec2((carIndex + 0.5) * 0.25, 0.5));
      gl_FragColor.rgb *= 0.8 + max(0.0, 2.0 * lightDistance * lightDistance - 0.2);

      if (gl_FragColor.a < 1.0) {
        discard;
      }
    }
  `,

  attributes: {
    position: regl.buffer([
      [ -1, -1 ],
      [ 1, -1 ],
      [ 1,  1 ],
      [ -1, 1 ]
    ])
  },

  uniforms: {
    carTexture: carTexture,
    carIndex: regl.prop('carIndex'),
    carPositionX: regl.prop('carPositionX'),
    carPositionY: regl.prop('carPositionY'),
    camera: regl.prop('camera')
  },

  primitive: 'triangle fan',
  count: 4
});

function createSpriteTexture(sourcePromise, textureW, textureH, textureMultiplierW, textureMultiplierH, levels, surfaceDepth, surfaceXOffset, surfaceHeight) {
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.style.position = 'absolute';
  spriteCanvas.style.top = '0px';
  spriteCanvas.style.left = '0px';
  spriteCanvas.style.background = '#222';
  // document.body.appendChild(spriteCanvas);

  spriteCanvas.width = textureW;
  spriteCanvas.height = textureH * levels.length;
  const spriteCtx = spriteCanvas.getContext('2d');

  const textureWValues = Array(...new Array(textureW)).map((_, index) => index);
  const textureHValues = Array(...new Array(textureH)).map((_, index) => index);

  // pre-create empty texture for later fill
  const spriteTexture = regl.texture({
    width: textureW,
    height: textureH,
    min: 'nearest',
    mag: 'nearest'
  });

  sourcePromise.then(function (sourceImage) {
    const sourceW = sourceImage.width;
    const sourceH = sourceImage.height;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.style.position = 'absolute';
    sourceCanvas.style.top = '0px';
    sourceCanvas.style.left = '0px';
    sourceCanvas.style.background = '#222';
    // document.body.appendChild(sourceCanvas);

    sourceCanvas.width = sourceW;
    sourceCanvas.height = sourceH;

    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(sourceImage, 0, 0);

    // render the texture
    levels.forEach((perspectiveDepth, index) => {
      // @todo use middle of range?
      const visibleSideRun = surfaceXOffset * surfaceDepth / (perspectiveDepth + surfaceDepth);

      const cameraHeightRatio = CAMERA_HEIGHT / surfaceHeight;
      const cameraHeightRatio2 = 1 - cameraHeightRatio;

      const texelBiasW = 1 / (2 * textureW);
      const texelBiasH = 1 / (2 * textureH);

      spriteCtx.clearRect(0, index * textureH, textureW, textureH);

      const testColor = [ '#ff0', '#f0f', '#f00', '#0f0', '#00f', '#0ff' ][index];

      textureWValues.forEach(px => {
        textureHValues.forEach(py => {
          const faceX = px / textureW + texelBiasW;
          const faceY = py / textureH + texelBiasH;

          const sideRunPortion = (1 - faceX) * visibleSideRun;
          const surfaceZ = sideRunPortion * perspectiveDepth / (surfaceXOffset - sideRunPortion);
          const surfaceX = surfaceZ / surfaceDepth;
          const surfaceY = (faceY - cameraHeightRatio) * (perspectiveDepth + surfaceZ) / perspectiveDepth + cameraHeightRatio;

          if (surfaceY >= 1) {
            return;
          }

          if (surfaceY < 0) {
            return;
          }

          const sourceX = Math.floor(surfaceX * sourceW * textureMultiplierW) % sourceW;
          const sourceY = sourceH - 1 - Math.floor(surfaceY * sourceH * textureMultiplierH) % sourceH;
          const sourcePixel = sourceCtx.getImageData(sourceX, sourceY, 1, 1).data;

          spriteCtx.fillStyle = `rgb(${sourcePixel[0]}, ${sourcePixel[1]}, ${sourcePixel[2]})`;
          spriteCtx.fillRect(px, index * textureH + py, 1, 1);
        });
      });
    });

    // upload to texture
    spriteTexture({
      width: textureW,
      height: textureH,
      min: 'nearest',
      mag: 'nearest',
      data: spriteCtx
    });
  });

  return spriteTexture;
}

function createFenceCommand(spriteTexture, levelCount, closeupDistance, cameraHeight, fenceHeight, fenceXOffset, fenceSpacing) {
  return regl({ context: { batchItem: { vert: glsl`
    #pragma glslify: computeSegmentX = require('./segment', computeSegmentDX=computeSegmentDX)

    #define fenceHeight float(${fenceHeight})
    #define fenceXOffset float(${fenceXOffset})
    #define fenceSpacing float(${fenceSpacing})
    #define closeupDistance float(${closeupDistance})
    #define cameraHeight float(${cameraHeight})

    uniform float cameraSideOffset;
    uniform float hFlip;

    varying float xOffset;
    varying float depth;
    varying float closeupScale;

    void batchItemSetup(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
      xOffset = computeSegmentX(segmentDepth, segmentCurve);
      depth = segmentOffset + segmentDepth;
      closeupScale = clamp(depth / closeupDistance, 0.0, 1.0);
    }

    vec3 batchItemCenter(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
      return vec3(
        hFlip * fenceXOffset + xOffset,
        0,
        cameraHeight + (fenceHeight * 0.5 - cameraHeight) * closeupScale
      );
    }

    vec2 batchItemSize(float segmentOffset, vec3 segmentCurve, float segmentDepth) {
      float xOffsetDelta = computeSegmentDX(fenceSpacing, segmentDepth, segmentCurve);

      float visibleSideWidth = hFlip * (hFlip * fenceXOffset + xOffset - cameraSideOffset) * fenceSpacing / (depth + fenceSpacing);
      float visibleCurvatureAdjustment = hFlip * xOffsetDelta * depth / (depth + fenceSpacing);

      return vec2(
        clamp(visibleSideWidth - visibleCurvatureAdjustment, 0.2, 10000.0),
        fenceHeight * 0.5 * closeupScale
      );
    }
  `, frag: glsl`
    #pragma glslify: roadSettings = require('./roadSettings')

    #define levelCount ${levelCount}

    uniform float hFlip;
    uniform float level;
    uniform sampler2D sprite;

    vec4 batchItemColor(vec2 facePosition) {
      vec2 spritePos = facePosition * vec2(hFlip, 0.5) + vec2(1.0, 0.5);

      return texture2D(
        sprite,
        (spritePos + vec2(0.0, level)) / vec2(1.0, float(levelCount))
      ) * vec4(
        1.0,
        1.0,
        1.0,
        step(hFlip * facePosition.x, 0.1) // draw one side with an extra "lip" for overlap
      );
    }
  ` } }, uniforms: {
    hFlip: regl.prop('hFlip'),
    level: regl.prop('level'),
    sprite: spriteTexture,
    cameraSideOffset: regl.prop('cameraSideOffset')
  } });
}

bgCmd = regl({
  vert: glsl`
    precision mediump float;

    attribute vec2 position;
    varying vec2 facePosition;

    void main() {
      facePosition = position;
      gl_Position = vec4(position, 0.99999, 1.0);
    }
  `,

  frag: glsl`
    precision mediump float;

    #define bandSize 0.1

    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec2 facePosition;

    void main() {
      float fade = clamp(1.0 - facePosition.y, 0.0, 1.0);
      float fadeSq = fade * fade;
      float qFade = fadeSq - mod(fadeSq -0.01, bandSize);

      gl_FragColor = vec4(mix(topColor, bottomColor, qFade), 1.0);
    }
  `,

  attributes: {
    position: regl.buffer([
      [ -1, 0 ],
      [ 1, 0 ],
      [ 1,  1 ],
      [ -1, 1 ]
    ])
  },

  uniforms: {
    topColor: regl.prop('topColor'),
    bottomColor: regl.prop('bottomColor')
  },

  depth: { func: 'always' },

  primitive: 'triangle fan',
  count: 4
});

function loadImage(imageURI) {
  const textureImage = new Image();

  const texturePromise = new Promise(function (resolve) {
    textureImage.onload = function () {
      resolve(textureImage);
    };
  });

  textureImage.crossOrigin = 'anonymous'; // prevent "tainted canvas" warning when blitting this
  textureImage.src = imageURI;

  return texturePromise;
}

const cameraPosition = vec3.create();
const camera = mat4.create();

const STEP = 1 / 60.0;

const CAMERA_HEIGHT = 3.25;
const DRAW_DISTANCE = 800;

const speed = 300 / 3.6; // km/h to m/s

const aspect = canvas.width / canvas.height;
// const fovX = 0.6;
// const fovY = 2.0 * Math.atan(Math.tan(fovX * 0.5) / aspect);
const fovY = 0.4;

const bgTopColor = vec3.fromValues(...onecolor('#005555').toJSON().slice(1));
const bgBottomColor = vec3.fromValues(...onecolor('#ff2222').toJSON().slice(1));
const roadColor = vec3.fromValues(...onecolor('#000055').toJSON().slice(1));
const roadHighlightColor = vec3.fromValues(...onecolor('#aa5500').toJSON().slice(1));
const markerColor = vec3.fromValues(...onecolor('#005555').toJSON().slice(1));
const markerHighlightColor = vec3.fromValues(...onecolor('#ffffff').toJSON().slice(1));

const segmentList = [];

const CARS = [ 'FURY', 'STING', 'STORM', 'MAGIC' ];

const carList = [];

io.on('connect', () => {
  io.emit('identify', {});
});

function updateState(state) {
  const goners = carList.filter(car => !state.players.some(player => player.car === car.id));

  goners.forEach(car => {
    const index = carList.indexOf(car);
    carList.splice(index, 1);
  });

  state.players.forEach((player, playerIndex) => {
    const carIndex = carList.findIndex(car => car.id === player.car);

    if (carIndex === -1) {
      carList.push({
        id: player.car,
        nextPos: vec2.fromValues(0, 0),
        pos: vec2.fromValues(0, 0)
      });
    }

    const car = carIndex !== -1 ? carList[carIndex] : carList[carList.length - 1];

    vec2.set(
      car.nextPos,
      (player.col - ROAD_SETTINGS.roadLaneCount * 0.5 + 0.5) * ROAD_SETTINGS.roadLaneWidth,
      player.row * 30 + 18
    );

    if (carIndex === -1) {
      vec2.copy(car.pos, car.nextPos);
    }
  });
}

io.on('init', (newState) => {
  updateState(newState);
});

io.on('turn', (newState) => {
  updateState(newState);
});

// no need for sprite distance closer than 20 because the added transition "pop" is too close and not worth the precision
const fenceTextureW = 32;
const fenceTextureH = 32;
const fenceLevels = [ 20, 40, 80, 160, 1000 ];

const fenceImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/wall.png', 'binary'));
const fenceImagePromise = loadImage(fenceImageURI);

const fenceTexture = createSpriteTexture(
  fenceImagePromise,
  fenceTextureW,
  fenceTextureH,
  1,
  1,
  fenceLevels,
  ROAD_SETTINGS.fenceSpacing,
  ROAD_SETTINGS.fenceXOffset,
  ROAD_SETTINGS.fenceHeight
);
const fenceCmd = createFenceCommand(fenceTexture, fenceLevels.length, (ROAD_SETTINGS.fenceSpacing - 3), CAMERA_HEIGHT, ROAD_SETTINGS.fenceHeight, ROAD_SETTINGS.fenceXOffset, ROAD_SETTINGS.fenceSpacing);

const buildingLevels = [ 20, 80, 160, 320, 1000 ];

const buildingImageURI = 'data:application/octet-stream;base64,' + btoa(require('fs').readFileSync(__dirname + '/building.png', 'binary'));
const buildingImagePromise = loadImage(buildingImageURI);

const buildingTexture = createSpriteTexture(
  buildingImagePromise,
  32,
  256,
  1,
  8,
  buildingLevels,
  ROAD_SETTINGS.buildingSpacing,
  ROAD_SETTINGS.buildingXOffset,
  ROAD_SETTINGS.buildingHeight
);
const buildingCmd = createFenceCommand(buildingTexture, buildingLevels.length, 2, CAMERA_HEIGHT, ROAD_SETTINGS.buildingHeight, ROAD_SETTINGS.buildingXOffset, ROAD_SETTINGS.buildingSpacing);

const segmentRenderer = createSegmentRenderer(regl);
const lightSegmentItemBatchRenderer = createSegmentItemBatchRenderer(
  regl,
  segmentRenderer,
  5,
  ROAD_SETTINGS.lightSpacing,
  ROAD_SETTINGS.lightOffset
);

// offset to be right after the light post to avoid overlapping it
const fenceSegmentItemBatchRenderer = createSegmentItemBatchRenderer(
  regl,
  segmentRenderer,
  50,
  ROAD_SETTINGS.fenceSpacing,
  6
);

const buildingSegmentItemBatchRenderer = createSegmentItemBatchRenderer(
  regl,
  segmentRenderer,
  50,
  ROAD_SETTINGS.buildingSpacing,
  6
);

function runTimer(physicsStepDuration, initialRun, onTick, onFrame) {
  let lastTime = performance.now();
  let initialTime = null;
  let physicsStepAccumulator = initialRun;

  function update() {
    const time = performance.now();
    const elapsed = Math.min(0.1, (time - lastTime) / 1000);

    lastTime = time;

    physicsStepAccumulator += elapsed;

    while (physicsStepAccumulator > physicsStepDuration) {
      onTick();
      physicsStepAccumulator -= physicsStepDuration;
    }

    if (initialTime === null) {
      initialTime = time;
    }

    onFrame((time - initialTime) / 1000);

    // restart
    requestAnimationFrame(update);
  }

  update();
}

const carTmp2 = vec2.create();

runTimer(STEP, 0, function () {
  carList.forEach(car => {
    vec2.sub(carTmp2, car.nextPos, car.pos);
    vec2.scale(carTmp2, carTmp2, 0.01);
    vec2.add(car.pos, car.pos, carTmp2);
  });

  segmentList.forEach((segment) => {
    segment.end -= speed * STEP;
  });

  const totalEnd = segmentList.length > 0
    ? segmentList[segmentList.length - 1].end
    : 0;

  if (totalEnd < DRAW_DISTANCE) {
    const length = (1 + Math.floor(Math.random() * 2)) * ROAD_SETTINGS.lightSpacing;

    segmentList.push({
      length: length,
      curvature: 8 * (Math.random() * 2 - 1),
      end: totalEnd + length
    });
  }

  if (segmentList.length > 0 && segmentList[0].end < 3.1) {
    segmentList.shift();
  }
}, function (now) {
  mat4.perspective(camera, fovY, aspect, 1, DRAW_DISTANCE);

  // pitch
  mat4.rotateX(camera, camera, -Math.PI / 2);

  // camera shake and offset
  const sideOffset = 0.1 * Math.cos(now * 0.75) + 0.02 * Math.cos(now * 3.17);

  vec3.set(cameraPosition, -sideOffset, 0, -CAMERA_HEIGHT + 0.02 * Math.cos(now * 2.31));
  mat4.translate(camera, camera, cameraPosition);

  bgCmd({
    topColor: bgTopColor,
    bottomColor: bgBottomColor,
  });

  segmentRenderer(segmentList, function (segmentOffset, segmentLength) {
    carList.forEach((car) => {
      if (car.pos[1] <= segmentOffset || car.pos[1] > segmentOffset + segmentLength) {
        return;
      }

      carCmd({
        carIndex: CARS.indexOf(car.id),
        carPositionX: car.pos[0],
        carPositionY: car.pos[1],
        camera: camera
      });
    });
  });

  segmentRenderer(segmentList, function () {
    roadCmd({
      roadColor: roadColor,
      roadHighlightColor: roadHighlightColor,
      markerColor: markerColor,
      markerHighlightColor: markerHighlightColor,
      cameraSideOffset: sideOffset,
      camera: camera
    });
  });

  lightSegmentItemBatchRenderer(segmentList, 0, DRAW_DISTANCE, camera, function (renderCommand) {
    postCmd(renderCommand);
  });
  lightSegmentItemBatchRenderer(segmentList, 0, DRAW_DISTANCE, camera, function (renderCommand) {
    postTopCmd(renderCommand);
  });

  fenceLevels.forEach((levelDistance, level) => {
    // ensure absolute minimum distance for sprites to avoid extreme close-up flicker
    const prevDistance = level === 0 ? 0 : fenceLevels[level - 1];

    fenceSegmentItemBatchRenderer(segmentList, prevDistance, levelDistance, camera, function (renderCommand) {
      fenceCmd({
        hFlip: -1,
        level: level,
        cameraSideOffset: sideOffset
      }, renderCommand);
    });

    fenceSegmentItemBatchRenderer(segmentList, prevDistance, levelDistance, camera, function (renderCommand) {
      fenceCmd({
        hFlip: 1,
        level: level,
        cameraSideOffset: sideOffset
      }, renderCommand);
    });
  });

  buildingLevels.forEach((levelDistance, level) => {
    // ensure absolute minimum distance for sprites to avoid extreme close-up flicker
    const prevDistance = level === 0 ? 0 : buildingLevels[level - 1];

    buildingSegmentItemBatchRenderer(segmentList, prevDistance, levelDistance, camera, function (renderCommand) {
      buildingCmd({
        hFlip: -1,
        level: level,
        cameraSideOffset: sideOffset
      }, renderCommand);
    });

    buildingSegmentItemBatchRenderer(segmentList, prevDistance, levelDistance, camera, function (renderCommand) {
      buildingCmd({
        hFlip: 1,
        level: level,
        cameraSideOffset: sideOffset
      }, renderCommand);
    });
  });
});
