/* global Camera, cube, triangle, getWebGLContext, initShaders, Matrix4 */

var VERTEX_SHADER = `
precision mediump float;
attribute vec3 a_Position;
attribute vec3 a_Color;
attribute vec2 a_UV;
varying vec3 v_Color;
varying vec2 v_UV;
uniform mat4 u_ModelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
void main() {
  v_Color = a_Color;
  v_UV = a_UV;
  gl_Position = u_projectionMatrix * u_viewMatrix * u_ModelMatrix *
    vec4(a_Position, 1.0);
}
`;

var FRAGMENT_SHADER = `
precision mediump float;
varying vec3 v_Color;
varying vec2 v_UV;
uniform float u_RenderMode;
uniform sampler2D u_Sampler0;
uniform sampler2D u_Sampler1;
void main() {
  if (u_RenderMode < 0.5) {
    gl_FragColor = vec4(v_Color, 1.0);
  } else if (u_RenderMode < 1.5) {
    vec4 t = texture2D(u_Sampler0, v_UV);
    gl_FragColor = t * vec4(v_Color, 1.0);
  } else {
    vec4 t = texture2D(u_Sampler1, v_UV);
    gl_FragColor = t * vec4(v_Color, 1.0);
  }
}
`;

var gl;
var camera;
var canvas;

var u_RenderModeLoc;
var u_Sampler0Loc;
var u_Sampler1Loc;
var u_ModelMatrixLoc;
var u_viewMatrixLoc;
var u_projectionMatrixLoc;

var texture0;
var texture1;

var vertexBuffer;
var FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;
var STRIDE = 8 * FLOAT_SIZE;

var keysDown = Object.create(null);

var blocks = new Map();
var collectibles = [];

var cubeTemplate;
var groundMesh;
var skyMesh;

var keysFound = 0;
var totalKeys = 3;
var gameWon = false;

var collectGeom;
var groundMarker;

var RENDER_COLOR = 0.0;
var RENDER_TEX0 = 1.0;
var RENDER_TEX1 = 2.0;

function packKey(ix, iy, iz) {
  return ix + ',' + iy + ',' + iz;
}

function parseKey(k) {
  var p = k.split(',');
  return [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)];
}

function makeCanvasTexture(glContext, drawCallback) {
  var c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  var ctx = c.getContext('2d');
  drawCallback(ctx, 256, 256);
  var tex = glContext.createTexture();
  glContext.activeTexture(glContext.TEXTURE0);
  glContext.bindTexture(glContext.TEXTURE_2D, tex);
  glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA,
    glContext.UNSIGNED_BYTE, c);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR_MIPMAP_LINEAR);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.REPEAT);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.REPEAT);
  glContext.generateMipmap(glContext.TEXTURE_2D);
  return tex;
}

function loadImageTexture(glContext, url, onReady) {
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function () {
    var tex = glContext.createTexture();
    glContext.bindTexture(glContext.TEXTURE_2D, tex);
    glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, 1);
    glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGB, glContext.RGB,
      glContext.UNSIGNED_BYTE, img);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR_MIPMAP_LINEAR);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.REPEAT);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.REPEAT);
    glContext.generateMipmap(glContext.TEXTURE_2D);
    onReady(tex);
  };
  img.onerror = function () {
    onReady(null);
  };
  img.src = url;
}

function bindTextures() {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture0);
  gl.uniform1i(u_Sampler0Loc, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture1);
  gl.uniform1i(u_Sampler1Loc, 1);
}

function drawGeometry(geom, renderMode) {
  geom.modelMatrix.setIdentity();
  geom.modelMatrix.multiply(geom.translationMatrix);
  geom.modelMatrix.multiply(geom.rotationMatrix);
  geom.modelMatrix.multiply(geom.scaleMatrix);

  gl.uniform1f(u_RenderModeLoc, renderMode);

  gl.uniformMatrix4fv(u_ModelMatrixLoc, false, geom.modelMatrix.elements);

  gl.bufferData(gl.ARRAY_BUFFER, geom.vertices, gl.STATIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, geom.vertices.length / 8);
}

function setTransforms(geom, tx, ty, tz, sx, sy, sz, rotYDeg) {
  geom.translationMatrix.setTranslate(tx, ty, tz);
  geom.rotationMatrix.setRotate(rotYDeg || 0, 0, 1, 0);
  geom.scaleMatrix.setScale(sx, sy, sz);
}

function rayGridInteract(removeMode) {
  var origin = camera.eye.elements;
  var dir = camera.forwardDir();
  var ox = origin[0];
  var oy = origin[1];
  var oz = origin[2];
  var dx = dir[0];
  var dy = dir[1];
  var dz = dir[2];

  var step = 0.045;
  var maxDist = 9;
  var prevCell = null;
  var t = step;

  while (t < maxDist) {
    var x = ox + dx * t;
    var y = oy + dy * t;
    var z = oz + dz * t;
    var ix = Math.round(x);
    var iy = Math.round(y);
    var iz = Math.round(z);
    var key = packKey(ix, iy, iz);

    if (blocks.has(key)) {
      if (removeMode) {
        blocks.delete(key);
        return true;
      }
      if (prevCell) {
        var pk = packKey(prevCell.ix, prevCell.iy, prevCell.iz);
        if (!blocks.has(pk)) {
          var px = camera.eye.elements[0];
          var pz = camera.eye.elements[2];
          if (Math.abs(px - prevCell.ix) + Math.abs(pz - prevCell.iz) < 0.65 &&
              Math.abs(camera.eye.elements[1] - prevCell.iy) < 1.25) {
            return false;
          }
          blocks.set(pk, { tex: Math.random() > 0.5 ? 1 : 0 });
          return true;
        }
      }
      return false;
    }

    prevCell = { ix: ix, iy: iy, iz: iz };
    t += step;
  }

  return false;
}

function collidesPlayer(px, py, pz) {
  var gx = Math.round(px);
  var gz = Math.round(pz);
  for (var ox = -2; ox <= 2; ox++) {
    for (var oz = -2; oz <= 2; oz++) {
      for (var oy = 0; oy <= 10; oy++) {
        var k = packKey(gx + ox, oy, gz + oz);
        if (!blocks.has(k)) continue;
        var ix = gx + ox;
        var iy = oy;
        var iz = gz + oz;
        var dx = Math.abs(px - ix);
        var dz = Math.abs(pz - iz);
        if (dx >= 0.82 || dz >= 0.82) continue;
        var y0 = iy - 0.5;
        var y1 = iy + 0.5;
        if (y1 > 0.05 && y0 < py + 1.55) {
          return true;
        }
      }
    }
  }
  return false;
}

function tryMove(dx, dz) {
  var e = camera.eye.elements;
  var nx = e[0] + dx;
  var nz = e[2] + dz;
  if (!collidesPlayer(nx, e[1], e[2])) {
    e[0] = nx;
  }
  if (!collidesPlayer(e[0], e[1], nz)) {
    e[2] = nz;
  }
}

function updateHUD() {
  var el = document.getElementById('hud');
  if (!el) return;
  var lines = [
    'Story: The Prism Gate trapped three keys in the ruins. Touch all three bright prism shards, then stand on the central gold marker.',
    '',
    'Move: WASD or arrow keys   Sprint: hold Shift',
    'Turn: Q / E (rotate)   Look: mouse after click (pointer lock)',
    'Blocks: F place ahead   G remove aim target',
    '',
    'Prism keys collected: ' + keysFound + ' / ' + totalKeys +
      (gameWon ? '   Gate open. Stand on the gold dais to seal the ruins.' : ''),
  ];
  el.textContent = lines.join('\n');
}

function checkCollectibles() {
  var ex = camera.eye.elements[0];
  var ey = camera.eye.elements[1];
  var ez = camera.eye.elements[2];
  for (var i = collectibles.length - 1; i >= 0; i--) {
    var c = collectibles[i];
    var ddx = ex - c.x;
    var ddy = ey - c.y;
    var ddz = ez - c.z;
    var dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
    if (dist < 1.35) {
      collectibles.splice(i, 1);
      keysFound++;
      if (keysFound >= totalKeys) {
        gameWon = true;
      }
      updateHUD();
    }
  }
}

function seedWorld() {
  blocks.clear();
  collectibles.length = 0;

  var r = 14;
  for (var x = -r; x <= r; x++) {
    for (var z = -r; z <= r; z++) {
      var edge = Math.abs(x) === r || Math.abs(z) === r;
      if (edge) {
        for (var y = 0; y <= 5; y++) {
          blocks.set(packKey(x, y, z), { tex: z % 2 });
        }
      }
    }
  }

  var pillars = [[-8, -8], [8, -8], [-8, 8], [8, 8], [-10, 2], [10, -3]];
  for (var p = 0; p < pillars.length; p++) {
    var bx = pillars[p][0];
    var bz = pillars[p][1];
    for (var h = 0; h <= 9; h++) {
      blocks.set(packKey(bx, h, bz), { tex: h % 2 });
    }
  }

  for (var i = -6; i <= 6; i++) {
    blocks.set(packKey(i, 1, 0), { tex: i % 2 });
    if (Math.abs(i) % 2 === 0) {
      blocks.set(packKey(i, 2, 0), { tex: 1 });
    }
  }

  blocks.set(packKey(-5, 0, -10), { tex: 0 });
  blocks.set(packKey(-5, 1, -10), { tex: 1 });
  blocks.set(packKey(6, 0, 8), { tex: 1 });
  blocks.set(packKey(6, 1, 8), { tex: 0 });
  blocks.set(packKey(-11, 3, 5), { tex: 1 });

  collectibles.push({ x: -9, y: 2.2, z: -9, phase: 0 });
  collectibles.push({ x: 11, y: 4.2, z: -5, phase: 1.3 });
  collectibles.push({ x: -4, y: 3.2, z: 11, phase: 2.1 });

  keysFound = 0;
  gameWon = false;
  updateHUD();
}

function handleResize() {
  if (!canvas || !gl) return;
  var dpr = window.devicePixelRatio || 1;
  var w = Math.floor(window.innerWidth * dpr);
  var h = Math.floor(window.innerHeight * dpr);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  gl.viewport(0, 0, w, h);
  if (camera) {
    camera.setAspect(w / h);
  }
}

function processInput(dt) {
  var sprint = keysDown['ShiftLeft'] || keysDown['ShiftRight'];
  var speed = (sprint ? 0.26 : 0.14) * dt * 60;

  var ff = camera.forwardFlat();
  var rr = camera.rightFlat();

  var mx = 0;
  var mz = 0;

  if (keysDown['KeyW'] || keysDown['ArrowUp']) {
    mx += ff[0] * speed;
    mz += ff[2] * speed;
  }
  if (keysDown['KeyS'] || keysDown['ArrowDown']) {
    mx -= ff[0] * speed;
    mz -= ff[2] * speed;
  }
  if (keysDown['KeyA'] || keysDown['ArrowLeft']) {
    mx -= rr[0] * speed;
    mz -= rr[2] * speed;
  }
  if (keysDown['KeyD'] || keysDown['ArrowRight']) {
    mx += rr[0] * speed;
    mz += rr[2] * speed;
  }

  if (mx !== 0 || mz !== 0) {
    tryMove(mx, mz);
    camera.updateView();
  }

  var rotSpeed = 1.8 * dt * 60;
  if (keysDown['KeyQ']) {
    camera.addYaw(-rotSpeed);
    camera.updateView();
  }
  if (keysDown['KeyE']) {
    camera.addYaw(rotSpeed);
    camera.updateView();
  }
}

var lastFrameMs = 0;

function animate(now) {
  requestAnimationFrame(animate);

  var t = now !== undefined ? now : performance.now();
  var dt = lastFrameMs ? Math.min((t - lastFrameMs) / 1000, 0.05) : 0.016;
  lastFrameMs = t;

  processInput(dt);
  checkCollectibles();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_viewMatrixLoc, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_projectionMatrixLoc, false, camera.projectionMatrix.elements);

  bindTextures();

  var ex = camera.eye.elements[0];
  var ey = camera.eye.elements[1];
  var ez = camera.eye.elements[2];

  gl.depthMask(false);
  gl.disable(gl.CULL_FACE);
  setTransforms(skyMesh, ex, ey, ez, 110, 110, 110, 0);
  drawGeometry(skyMesh, RENDER_TEX1);
  gl.depthMask(true);
  gl.enable(gl.CULL_FACE);

  setTransforms(groundMesh, 0, -0.14, 0, 36, 0.18, 36, 0);
  drawGeometry(groundMesh, RENDER_TEX0);

  blocks.forEach(function (meta, key) {
    var parts = parseKey(key);
    var ix = parts[0];
    var iy = parts[1];
    var iz = parts[2];
    var slot = meta && meta.tex === 1 ? RENDER_TEX1 : RENDER_TEX0;
    setTransforms(cubeTemplate, ix, iy, iz, 0.5, 0.5, 0.5, 0);
    drawGeometry(cubeTemplate, slot);
  });

  var pulse = Math.sin(t * 0.004);
  for (var ci = 0; ci < collectibles.length; ci++) {
    var col = collectibles[ci];
    var bob = Math.sin(t * 0.003 + col.phase) * 0.08;
    var tri = collectGeom;
    tri.translationMatrix.setTranslate(col.x, col.y + bob, col.z);
    tri.rotationMatrix.setRotate(t * 0.08 + col.phase * 40, 0, 1, 0);
    tri.scaleMatrix.setScale(0.55, 0.55, 0.55);

    var k = 0.55 + pulse * 0.25;
    tri.vertices = makeTriangleVerts(k, 0.15 + pulse * 0.35, 0.95);

    tri.modelMatrix.setIdentity();
    tri.modelMatrix.multiply(tri.translationMatrix);
    tri.modelMatrix.multiply(tri.rotationMatrix);
    tri.modelMatrix.multiply(tri.scaleMatrix);

    gl.uniform1f(u_RenderModeLoc, RENDER_COLOR);
    gl.uniformMatrix4fv(u_ModelMatrixLoc, false, tri.modelMatrix.elements);
    gl.bufferData(gl.ARRAY_BUFFER, tri.vertices, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, tri.vertices.length / 8);
  }

  if (keysFound >= totalKeys) {
    setTransforms(groundMarker, 0, 0.35, 0, 2.2, 0.08, 2.2, (t * 0.05) % 360);
    drawGeometry(groundMarker, RENDER_COLOR);
  }
}

function makeTriangleVerts(r, g, b) {
  return new Float32Array([
    -0.5, -0.5, 0.0, r, g, b, 0.0, 0.0,
    0.5, -0.5, 0.0, r * 0.9, g * 0.85, b, 1.0, 0.0,
    0.0, 0.6, 0.0, r, g * 1.1, b * 1.05, 0.5, 1.0,
  ]);
}

function coloredFlatCubeVerts(r, g, b) {
  var w = 1.0;
  return new Float32Array([
    1.0, -1.0, 1.0, r, g, b, 0, 0,
    1.0, -1.0, -1.0, r * 0.85, g * 0.9, b * 0.85, 0, 0,
    1.0, 1.0, -1.0, r, g, b, 0, 0,
    1.0, -1.0, 1.0, r, g, b, 0, 0,
    1.0, 1.0, -1.0, r, g, b, 0, 0,
    1.0, 1.0, 1.0, r * 0.95, g * 0.95, b, 0, 0,
    -1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, -1.0, 1.0, r, g, b, 0, 0,
    -1.0, 1.0, 1.0, r, g, b, 0, 0,
    -1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, 1.0, 1.0, r, g, b, 0, 0,
    -1.0, 1.0, -1.0, r, g, b, 0, 0,
    1.0, -1.0, 1.0, r, g, b, 0, 0,
    -1.0, -1.0, 1.0, r, g, b, 0, 0,
    -1.0, 1.0, 1.0, r, g, b, 0, 0,
    1.0, -1.0, 1.0, r, g, b, 0, 0,
    -1.0, 1.0, 1.0, r, g, b, 0, 0,
    1.0, 1.0, 1.0, r, g, b, 0, 0,
    1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, 1.0, -1.0, r, g, b, 0, 0,
    1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, 1.0, -1.0, r, g, b, 0, 0,
    1.0, 1.0, -1.0, r, g, b, 0, 0,
    1.0, 1.0, -1.0, r, g, b, 0, 0,
    -1.0, 1.0, -1.0, r, g, b, 0, 0,
    -1.0, 1.0, 1.0, r, g, b, 0, 0,
    1.0, 1.0, -1.0, r, g, b, 0, 0,
    -1.0, 1.0, 1.0, r, g, b, 0, 0,
    1.0, 1.0, 1.0, r, g, b, 0, 0,
    1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, -1.0, 1.0, r, g, b, 0, 0,
    1.0, -1.0, -1.0, r, g, b, 0, 0,
    -1.0, -1.0, 1.0, r, g, b, 0, 0,
    1.0, -1.0, 1.0, r, g, b, 0, 0,
  ]);
}

function setupGeometryTemplates() {
  cubeTemplate = new cube();
  groundMesh = new cube();
  skyMesh = new cube();

  collectGeom = new triangle();
  collectGeom.vertices = makeTriangleVerts(0.35, 0.95, 1.0);

  groundMarker = new cube();
  groundMarker.vertices = coloredFlatCubeVerts(1.0, 0.85, 0.2);
  setTransforms(groundMarker, 0, 0.35, 0, 2.2, 0.08, 2.2, 0);
}

function startTexturesThenLoop() {
  texture0 = makeCanvasTexture(gl, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3d6b3d');
    g.addColorStop(0.45, '#5a8f5a');
    g.addColorStop(1, '#2d4a2d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(40,60,40,0.35)';
    ctx.lineWidth = 2;
    var step = 32;
    for (var x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (var y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });

  texture1 = makeCanvasTexture(gl, function (ctx, w, h) {
    ctx.fillStyle = '#87a8d8';
    ctx.fillRect(0, 0, w, h);
    var g = ctx.createRadialGradient(w * 0.35, h * 0.25, 10, w * 0.5, h * 0.5, w * 0.65);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.35, 'rgba(160,190,230,0.15)');
    g.addColorStop(1, 'rgba(70,100,150,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (var i = 0; i < 80; i++) {
      var sx = Math.random() * w;
      var sy = Math.random() * h;
      var sr = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  var texBase = (typeof window.ASSET_ROOT === 'string') ? window.ASSET_ROOT : 'world-project/';
  loadImageTexture(gl, texBase + 'textures/block.jpg', function (loaded) {
    if (loaded) {
      texture0 = loaded;
    }
  });

  bindTextures();
  lastFrameMs = 0;
  requestAnimationFrame(animate);
}

function main() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas);
  if (!gl) {
    return;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.02, 0.03, 0.06, 1.0);

  handleResize();
  window.addEventListener('resize', handleResize);

  camera = new Camera(canvas.width / canvas.height, 0.1, 600);

  setupGeometryTemplates();
  seedWorld();

  if (!initShaders(gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
    return;
  }

  u_RenderModeLoc = gl.getUniformLocation(gl.program, 'u_RenderMode');
  u_Sampler0Loc = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1Loc = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_ModelMatrixLoc = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_viewMatrixLoc = gl.getUniformLocation(gl.program, 'u_viewMatrix');
  u_projectionMatrixLoc = gl.getUniformLocation(gl.program, 'u_projectionMatrix');

  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

  var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(a_Position);

  var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, STRIDE, 3 * FLOAT_SIZE);
  gl.enableVertexAttribArray(a_Color);

  var a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, STRIDE, 6 * FLOAT_SIZE);
  gl.enableVertexAttribArray(a_UV);

  window.addEventListener('keydown', function (e) {
    keysDown[e.code] = true;
    if (e.code === 'KeyF') {
      rayGridInteract(false);
      e.preventDefault();
    }
    if (e.code === 'KeyG') {
      rayGridInteract(true);
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', function (e) {
    keysDown[e.code] = false;
  });

  canvas.addEventListener('click', function () {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (document.pointerLockElement === canvas) {
      camera.addYaw(e.movementX * 0.18);
      camera.addPitch(-e.movementY * 0.18);
      camera.updateView();
    }
  });

  updateHUD();
  startTexturesThenLoop();
}

window.addEventListener('load', main);
