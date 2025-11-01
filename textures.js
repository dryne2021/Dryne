const { mat4, vec3 } = glMatrix;

let gl;
let shaderProgram;
let cubeVertexBuffer;
let cubeTexCoordBuffer;
let cubeIndexBuffer;
let cubeTexture;

const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();

const camera = {
  yaw: Math.PI / 6,
  pitch: 0,
  distance: 6,
  minPitch: -Math.PI / 2 + 0.1,
  maxPitch: Math.PI / 2 - 0.1,
  minDistance: 2.5,
  maxDistance: 12,
  yawSpeed: 0.025,
  pitchSpeed: 0.02,
  zoomSpeed: 0.15,
};

const keys = {};
window.addEventListener("keydown", (event) => (keys[event.code] = true));
window.addEventListener("keyup", (event) => (keys[event.code] = false));

function initWebGL() {
  const canvas = document.getElementById("glCanvas");
  gl = canvas.getContext("webgl");

  if (!gl) {
    alert("WebGL not supported on this browser.");
    return;
  }

  resizeCanvas(canvas);
  window.addEventListener("resize", () => resizeCanvas(canvas));

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  mat4.perspective(
    projectionMatrix,
    Math.PI / 4,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );

  initCubeBuffers();
  initShaders();
  initTexture();

  requestAnimationFrame(mainLoop);
}

function resizeCanvas(canvas) {
  const displayWidth = window.innerWidth;
  const displayHeight = window.innerHeight;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      mat4.perspective(
        projectionMatrix,
        Math.PI / 4,
        canvas.width / canvas.height,
        0.1,
        100
      );
    }
  }
}

function initCubeBuffers() {
  const vertices = [
    // Front
    -1, -1, 1,
    1, -1, 1,
    1, 1, 1,
    -1, 1, 1,
    // Back
    -1, -1, -1,
    -1, 1, -1,
    1, 1, -1,
    1, -1, -1,
    // Top
    -1, 1, -1,
    -1, 1, 1,
    1, 1, 1,
    1, 1, -1,
    // Bottom
    -1, -1, -1,
    1, -1, -1,
    1, -1, 1,
    -1, -1, 1,
    // Right
    1, -1, -1,
    1, 1, -1,
    1, 1, 1,
    1, -1, 1,
    // Left
    -1, -1, -1,
    -1, -1, 1,
    -1, 1, 1,
    -1, 1, -1,
  ];

  const tileCols = 3;
  const tileRows = 2;

  const textures = {
    chain: [0, 0],
    tileWall: [1, 0],
    ivy: [2, 0],
    wood: [0, 1],
    pebble: [1, 1],
    cobble: [2, 1],
  };

  const uvMap = [];

  function tileUV(col, row) {
    const u0 = col / tileCols;
    const v0 = row / tileRows;
    const u1 = (col + 1) / tileCols;
    const v1 = (row + 1) / tileRows;
    return { u0, v0, u1, v1 };
  }

  function applyOrientation(tile, orientation) {
    const { u0, v0, u1, v1 } = tile;
    const lookup = {
      bl: [u0, v1],
      br: [u1, v1],
      tr: [u1, v0],
      tl: [u0, v0],
    };
    orientation.forEach((key) => {
      uvMap.push(...lookup[key]);
    });
  }

  applyOrientation(tileUV(...textures.chain), ["bl", "br", "tr", "tl"]);
  applyOrientation(tileUV(...textures.ivy), ["bl", "tl", "tr", "br"]);
  applyOrientation(tileUV(...textures.pebble), ["tl", "bl", "br", "tr"]);
  applyOrientation(tileUV(...textures.cobble), ["tr", "tl", "bl", "br"]);
  applyOrientation(tileUV(...textures.tileWall), ["bl", "tl", "tr", "br"]);
  applyOrientation(tileUV(...textures.wood), ["br", "bl", "tl", "tr"]);

  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ];

  cubeVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  cubeTexCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvMap), gl.STATIC_DRAW);

  cubeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

function initShaders() {
  const vsSource = `
    attribute vec3 aPosition;
    attribute vec2 aTexCoord;
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec2 vTexCoord;
    void main(void) {
      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      vTexCoord = aTexCoord;
    }
  `;

  const fsSource = `
    precision mediump float;
    varying vec2 vTexCoord;
    uniform sampler2D uSampler;
    void main(void) {
      gl_FragColor = texture2D(uSampler, vTexCoord);
    }
  `;

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error("Unable to initialize the shader program:", gl.getProgramInfoLog(shaderProgram));
    return;
  }

  gl.useProgram(shaderProgram);

  shaderProgram.aPosition = gl.getAttribLocation(shaderProgram, "aPosition");
  shaderProgram.aTexCoord = gl.getAttribLocation(shaderProgram, "aTexCoord");
  shaderProgram.uModelMatrix = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  shaderProgram.uViewMatrix = gl.getUniformLocation(shaderProgram, "uViewMatrix");
  shaderProgram.uProjectionMatrix = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
  shaderProgram.uSampler = gl.getUniformLocation(shaderProgram, "uSampler");
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("An error occurred compiling the shaders:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initTexture() {
  cubeTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, cubeTexture);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255])
  );

  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  image.onerror = () => {
    console.error("Failed to load texture_map.png. Ensure it is located next to textures.js.");
  };
  image.src = "texture_map.png";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function handleInput() {
  if (keys["ArrowLeft"]) {
    camera.yaw += camera.yawSpeed;
  }
  if (keys["ArrowRight"]) {
    camera.yaw -= camera.yawSpeed;
  }
  if (keys["ArrowUp"]) {
    camera.pitch = clamp(camera.pitch + camera.pitchSpeed, camera.minPitch, camera.maxPitch);
  }
  if (keys["ArrowDown"]) {
    camera.pitch = clamp(camera.pitch - camera.pitchSpeed, camera.minPitch, camera.maxPitch);
  }
  if (keys["KeyW"]) {
    camera.distance = clamp(camera.distance - camera.zoomSpeed, camera.minDistance, camera.maxDistance);
  }
  if (keys["KeyS"]) {
    camera.distance = clamp(camera.distance + camera.zoomSpeed, camera.minDistance, camera.maxDistance);
  }
  if (keys["Space"]) {
    camera.yaw = Math.PI / 6;
    camera.pitch = 0;
    camera.distance = 6;
  }
}

function updateViewMatrix() {
  const x = Math.cos(camera.pitch) * Math.sin(camera.yaw) * camera.distance;
  const y = Math.sin(camera.pitch) * camera.distance;
  const z = Math.cos(camera.pitch) * Math.cos(camera.yaw) * camera.distance;
  const eye = vec3.fromValues(x, y, z);
  mat4.lookAt(viewMatrix, eye, vec3.create(), [0, 1, 0]);
}

function mainLoop() {
  handleInput();
  updateViewMatrix();

  gl.clearColor(0.08, 0.08, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(shaderProgram);

  mat4.identity(modelMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.vertexAttribPointer(shaderProgram.aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shaderProgram.aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexCoordBuffer);
  gl.vertexAttribPointer(shaderProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shaderProgram.aTexCoord);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);

  gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, modelMatrix);
  gl.uniformMatrix4fv(shaderProgram.uViewMatrix, false, viewMatrix);
  gl.uniformMatrix4fv(shaderProgram.uProjectionMatrix, false, projectionMatrix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
  gl.uniform1i(shaderProgram.uSampler, 0);

  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

  requestAnimationFrame(mainLoop);
}

window.addEventListener("load", initWebGL);

