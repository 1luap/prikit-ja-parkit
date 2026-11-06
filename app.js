'use strict';
// Kiikarinäkymä 120 asteen satamaan. Kulmat asteina: x = suunta (0 = lahden keskikohta), y = korkeus horisontista.

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const $ = (id) => document.getElementById(id);

// Laivat: x = suunta, d = vesiraja horisontin alapuolella (isompi = lähempänä), w = leveys asteina
const SHIPS = [
  { src: 'img/laiva-1.png', x: -40, d: 1.0, w: 9.0, ph: 0.0 },
  { src: 'img/laiva-2.png', x: -15, d: 0.6, w: 8.0, ph: 1.7 },
  { src: 'img/laiva-3.png', x: 17, d: 0.85, w: 8.6, ph: 3.1 },
  { src: 'img/laiva-4.png', x: 41, d: 1.3, w: 10.0, ph: 4.4 },
];
const IMG_W = 1070, IMG_H = 820, WL = 780 / 820, ANCHOR = 515 / 1070;

const WORLD_MIN = -62, WORLD_MAX = 62;
const FOV_MIN = 5, FOV_MAX = 40;

const view = { h: 0, p: 0, fov: 24 };
const manual = { h: 0, p: 0 };
const gyro = { on: false, uh: 0, last: null, pitch: 0, cal: null };
let dpr = 1, W = 0, H = 0;

// ---------- satunnaisuus ja maisema ----------
function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const HILLS = [];
for (let x = -100; x <= 100; x += 0.25) {
  const h = 0.9 + 0.45 * Math.sin(x * 0.11 + 0.4) + 0.3 * Math.sin(x * 0.37 + 1.3) + 0.12 * Math.sin(x * 1.7 + 2.1);
  HILLS.push([x, Math.max(0.15, h)]);
}

// Brownsea-henkinen saari lahden keskellä
const ISLAND = [];
for (let x = -7; x <= 15; x += 0.2) {
  const t = (x + 7) / 22;
  const h = 1.15 * Math.pow(Math.sin(Math.PI * t), 0.6) + 0.08 * Math.sin(x * 2.3);
  ISLAND.push([x, Math.max(0, h)]);
}
const TREES = [];
for (let i = 0; i < 70; i++) {
  const x = -6 + 20 * hash(i, 7);
  const base = islandH(x);
  if (base > 0.25) TREES.push([x, base, 0.25 + 0.3 * hash(i, 9)]);
}
function islandH(x) {
  if (x < -7 || x > 15) return 0;
  const t = (x + 7) / 22;
  return 1.15 * Math.pow(Math.sin(Math.PI * t), 0.6) + 0.08 * Math.sin(x * 2.3);
}

// Lahden reunojen niemet
const LEFT_LAND = [[-110, 9], [-75, 7], [-62, 4.5], [-55, 2.2], [-50, 0.6], [-47.5, 0], [-50, -1.5], [-57, -4], [-66, -9], [-80, -30], [-110, -30]];
const RIGHT_LAND = [[110, 8], [76, 6.5], [64, 3.8], [57, 1.8], [52, 0.5], [50, 0], [53, -1.6], [60, -4.5], [70, -10], [82, -30], [110, -30]];

// ---------- kuvat ----------
let loaded = 0;
SHIPS.forEach((s) => {
  s.img = new Image();
  s.img.onload = () => { loaded++; };
  s.img.src = s.src;
});

// ---------- koko ----------
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  W = Math.round(innerWidth * dpr);
  H = Math.round(innerHeight * dpr);
  cv.width = W; cv.height = H;
}
addEventListener('resize', resize);
resize();

function layout() {
  // kaksi limittäistä kiikariympyrää
  const k = W < H ? 0.3 : 0.45;
  const r = Math.min(H * 0.47, W / (2 + 2 * k) * 0.99);
  return { r, off: r * k, cx: W / 2, cy: H / 2 };
}

// ---------- piirto ----------
function draw(t) {
  const L = layout();
  const scale = (2 * L.r) / view.fov;
  const X = (x) => L.cx + (x - view.h) * scale;
  const Y = (y) => L.cy - (y - view.p) * scale;
  const left = view.h - (W / 2) / scale - 1, right = view.h + (W / 2) / scale + 1;

  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // taivas
  const yh = Y(0);
  let g = ctx.createLinearGradient(0, Y(30), 0, yh);
  g.addColorStop(0, '#5f82a8');
  g.addColorStop(0.75, '#a9bfd0');
  g.addColorStop(1, '#dde4e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Math.max(0, yh + 1));

  // pilvet
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 26; i++) {
    const cx = -90 + 180 * hash(i, 1) + t * 0.02;
    const cy = 4 + 16 * hash(i, 2);
    const cw = 3 + 6 * hash(i, 3);
    if (cx + cw < left || cx - cw > right) continue;
    ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      const ex = X(cx + (j - 1.5) * cw * 0.35), ey = Y(cy + 0.25 * hash(i, j + 10));
      ctx.moveTo(ex + cw * 0.4 * scale, ey);
      ctx.ellipse(ex, ey, cw * 0.4 * scale, cw * 0.14 * scale, 0, 0, Math.PI * 2);
    }
    ctx.fill('nonzero');
  }

  // vesi
  g = ctx.createLinearGradient(0, yh, 0, Y(-18));
  g.addColorStop(0, '#8ea6b1');
  g.addColorStop(0.15, '#5e7d8c');
  g.addColorStop(1, '#23394a');
  ctx.fillStyle = g;
  ctx.fillRect(0, yh, W, H - yh);

  // kaukaiset kukkulat
  ctx.fillStyle = '#8a9aa3';
  ctx.beginPath();
  ctx.moveTo(X(HILLS[0][0]), yh);
  for (const [x, h] of HILLS) if (x > left - 1 && x < right + 1) ctx.lineTo(X(x), Y(h));
  ctx.lineTo(X(right + 1), yh);
  ctx.lineTo(X(left - 1), yh);
  ctx.closePath();
  ctx.fill();

  // saari
  ctx.fillStyle = '#4b6550';
  ctx.beginPath();
  ctx.moveTo(X(-7), Y(0));
  for (const [x, h] of ISLAND) ctx.lineTo(X(x), Y(h));
  ctx.lineTo(X(15), Y(0));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#34503c';
  for (const [x, b, s] of TREES) {
    ctx.beginPath();
    ctx.moveTo(X(x - s * 0.35), Y(b - 0.05));
    ctx.lineTo(X(x), Y(b + s));
    ctx.lineTo(X(x + s * 0.35), Y(b - 0.05));
    ctx.fill();
  }
  // linna
  const cx0 = -2.4, cb = islandH(-2.4) - 0.12;
  ctx.fillStyle = '#cdbfa6';
  ctx.fillRect(X(cx0), Y(cb + 0.55), 0.9 * scale, 0.55 * scale);
  ctx.fillRect(X(cx0 + 0.15), Y(cb + 0.85), 0.28 * scale, 0.3 * scale);
  for (let i = 0; i < 4; i++) ctx.fillRect(X(cx0 + 0.04 + i * 0.24), Y(cb + 0.64), 0.12 * scale, 0.09 * scale);
  ctx.fillStyle = '#5c5246';
  for (let i = 0; i < 3; i++) ctx.fillRect(X(cx0 + 0.47 + i * 0.13), Y(cb + 0.35), 0.05 * scale, 0.09 * scale);

  // aallot
  ctx.lineCap = 'round';
  for (let k = 0; k < 34; k++) {
    const y = -0.12 * Math.pow(1.17, k);
    if (y < -22) break;
    const len = 0.05 + 0.09 * -y;
    const step = len * 2.6;
    const i0 = Math.floor(left / step) - 1, i1 = Math.ceil(right / step) + 1;
    ctx.lineWidth = Math.max(1, (0.01 + 0.012 * -y) * scale);
    for (let i = i0; i <= i1; i++) {
      const hsh = hash(i, k + 100);
      const x = i * step + hsh * step + Math.sin(t * 0.7 + i * 1.3 + k) * len * 0.25;
      const yy = y * (1 + 0.15 * (hash(i, k + 200) - 0.5));
      ctx.strokeStyle = hsh > 0.55 ? 'rgba(235,242,245,0.22)' : 'rgba(18,36,48,0.28)';
      ctx.beginPath();
      ctx.moveTo(X(x), Y(yy));
      ctx.lineTo(X(x + len), Y(yy));
      ctx.stroke();
    }
  }

  // niemet
  for (const land of [LEFT_LAND, RIGHT_LAND]) {
    ctx.fillStyle = '#3f5636';
    ctx.beginPath();
    land.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#2f4429';
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (49 + 40 * hash(i, 21));
    const b = landTop(side, x);
    if (b === null) continue;
    const s = 0.6 + 0.9 * hash(i, 22);
    ctx.beginPath();
    ctx.moveTo(X(x - s * 0.3), Y(b - 0.1));
    ctx.lineTo(X(x), Y(b + s));
    ctx.lineTo(X(x + s * 0.3), Y(b - 0.1));
    ctx.fill();
  }

  // laivat, kaukaisin ensin
  const ships = SHIPS.slice().sort((a, b) => a.d - b.d);
  for (const s of ships) {
    if (!s.img.complete || !s.img.naturalWidth) continue;
    const wpx = s.w * scale;
    const hpx = s.w * (IMG_H / IMG_W) * scale;
    const ax = X(s.x);
    if (ax + wpx < 0 || ax - wpx > W) continue;
    const bob = Math.sin(t * 0.9 + s.ph) * 0.03;
    const rot = Math.sin(t * 0.55 + s.ph) * 0.007;
    const ay = Y(-s.d + bob);
    // varjo veteen
    ctx.fillStyle = 'rgba(10,25,35,0.25)';
    ctx.beginPath();
    ctx.ellipse(ax, ay + 0.05 * scale, wpx * 0.4, 0.12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rot);
    ctx.drawImage(s.img, -ANCHOR * wpx, -WL * hpx, wpx, hpx);
    ctx.restore();
    // vesiraja peittoon
    ctx.fillStyle = 'rgba(70,100,115,0.85)';
    ctx.fillRect(ax - wpx * 0.36, ay + 0.015 * scale, wpx * 0.72, 0.05 * scale);
  }

  // kiikarimaski
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(L.cx - L.off, L.cy, L.r, 0, Math.PI * 2);
  ctx.arc(L.cx + L.off, L.cy, L.r, 0, Math.PI * 2);
  ctx.fill('nonzero');
  ctx.globalCompositeOperation = 'source-atop';
  const vc = vignette(L);
  if (vc) ctx.drawImage(vc, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // suuntapalkki
  const bw = Math.min(W * 0.6, 320 * dpr), bx = (W - bw) / 2;
  const by = Math.max(L.cy + L.r + 18 * dpr, H - 90 * dpr);
  if (by < H - 60 * dpr) {
    const span = WORLD_MAX - WORLD_MIN;
    ctx.fillStyle = 'rgba(244,239,226,0.18)';
    ctx.fillRect(bx, by, bw, 4 * dpr);
    const half = (L.off + L.r) / scale;
    const a = Math.max(WORLD_MIN, view.h - half), b = Math.min(WORLD_MAX, view.h + half);
    ctx.fillStyle = 'rgba(244,239,226,0.7)';
    ctx.fillRect(bx + (a - WORLD_MIN) / span * bw, by - 3 * dpr, (b - a) / span * bw, 10 * dpr);
  }
}

let vcache = null;
function vignette(L) {
  const key = W + 'x' + H;
  if (vcache && vcache.key === key) return vcache.c;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const v = c.getContext('2d');
  if (typeof v.filter !== 'string') { vcache = { key, c: null }; return null; }
  v.fillStyle = 'rgba(0,0,0,0.65)';
  v.fillRect(0, 0, W, H);
  v.globalCompositeOperation = 'destination-out';
  v.filter = 'blur(' + Math.round(L.r * 0.16) + 'px)';
  v.fillStyle = '#000';
  v.beginPath();
  v.arc(L.cx - L.off, L.cy, L.r * 0.86, 0, Math.PI * 2);
  v.arc(L.cx + L.off, L.cy, L.r * 0.86, 0, Math.PI * 2);
  v.fill('nonzero');
  vcache = { key, c };
  return c;
}

function landTop(side, x) {
  const land = side < 0 ? LEFT_LAND : RIGHT_LAND;
  for (let i = 0; i < 5; i++) {
    const [x0, y0] = land[i], [x1, y1] = land[i + 1];
    if ((x - x0) * (x - x1) <= 0) return y0 + (y1 - y0) * ((x - x0) / ((x1 - x0) || 1));
  }
  return null;
}

// ---------- ohjaus ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function targetView() {
  let h = manual.h, p = manual.p;
  if (gyro.on && gyro.cal !== null) {
    h += gyro.uh - gyro.cal;
    p += gyro.pitch;
  }
  return { h: clamp(h, WORLD_MIN, WORLD_MAX), p: clamp(p, -14, 20) };
}

function frame(ms) {
  const t = ms / 1000;
  const tv = targetView();
  const k = gyro.on ? 0.3 : 1;
  view.h += (tv.h - view.h) * k;
  view.p += (tv.p - view.p) * k;
  draw(t);
  requestAnimationFrame(frame);
}

function onOrient(e) {
  if (e.alpha === null || e.beta === null || e.gamma === null) return;
  const r = Math.PI / 180;
  const sX = Math.sin(e.beta * r), cX = Math.cos(e.beta * r);
  const sY = Math.sin(e.gamma * r), cY = Math.cos(e.gamma * r);
  const sZ = Math.sin(e.alpha * r), cZ = Math.cos(e.alpha * r);
  // laitteen z-akseli maailmankoordinaatistossa; takakamera katsoo suuntaan -z
  const m13 = cY * sZ * sX + cZ * sY;
  const m23 = sZ * sY - cZ * cY * sX;
  const m33 = cX * cY;
  const heading = Math.atan2(-m13, -m23) / r;
  const pitch = Math.asin(clamp(-m33, -1, 1)) / r;
  if (gyro.last === null) gyro.uh = heading;
  else gyro.uh += ((heading - gyro.last + 540) % 360) - 180;
  gyro.last = heading;
  gyro.pitch = pitch;
  if (gyro.cal === null) gyro.cal = gyro.uh - view.h + manual.h;
  if (!gyro.on) {
    gyro.on = true;
    $('mode').textContent = 'Käänny katsoaksesi ympärillesi';
  }
}

function recenter() {
  manual.h = 0; manual.p = 0;
  if (gyro.on) gyro.cal = gyro.uh;
}

function zoom(f) { view.fov = clamp(view.fov * f, FOV_MIN, FOV_MAX); }

// kosketus ja hiiri
const pts = new Map();
let pinch0 = 0;
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) pinch0 = pdist(); });
cv.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  const [px, py] = pts.get(e.pointerId);
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 1) {
    const sc = (2 * layout().r / dpr) / view.fov;
    manual.h -= (e.clientX - px) / sc;
    manual.p += (e.clientY - py) / sc;
    if (!gyro.on) { manual.h = clamp(manual.h, WORLD_MIN, WORLD_MAX); manual.p = clamp(manual.p, -14, 20); }
  } else if (pts.size === 2) {
    const d = pdist();
    if (pinch0 > 0) zoom(pinch0 / d);
    pinch0 = d;
  }
});
const up = (e) => { pts.delete(e.pointerId); pinch0 = pts.size === 2 ? pdist() : 0; };
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
function pdist() { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }
cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015)); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

$('zin').onclick = () => zoom(1 / 1.4);
$('zout').onclick = () => zoom(1.4);
$('center').onclick = recenter;

$('go').onclick = async () => {
  $('start').classList.add('hidden');
  $('ui').classList.remove('hidden');
  $('mode').textContent = 'Siirrä näkymää vetämällä';
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') return;
    }
    addEventListener('deviceorientation', onOrient);
  } catch (err) { /* vetotila jää käyttöön */ }
  try { if (document.documentElement.requestFullscreen && matchMedia('(pointer: coarse)').matches) await document.documentElement.requestFullscreen(); } catch (err) { /* ei haittaa */ }
};

requestAnimationFrame(frame);
