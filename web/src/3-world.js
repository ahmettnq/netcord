/* =====================================================================
   WORLD: miniature island clubs, made like a model-maker's diorama.
   Everything is generated from code (no downloaded assets): a lawn with
   painted paths and soft shade, a turf lip over a deep earth cliff with
   stones and hanging roots, smooth figurines, foliage built from lumpy
   spheres, timber bleachers and a little clubhouse. All static parts are
   merged into a few meshes, so a whole club is a handful of draw calls.
   Generation is seeded, so each club looks the same on every launch.
   Tall things stay on the far sides (-x, -z) so nothing hides the
   players from the camera, which sits on the +x/+z corner.
   ===================================================================== */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _t = new THREE.Vector3();
const _c = new THREE.Color();

/* ---------- seeded randomness and noise ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let WR = mulberry32(1);
const wr = (a, b) => a + WR() * (b - a);
const wpick = arr => arr[(WR() * arr.length) | 0];
function hash2(x, z, s = 0) { let h = Math.imul((x | 0) + s * 101, 374761393) ^ Math.imul((z | 0) - s * 37, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function hash3(x, y, z) { return hash2(x * 7 + y * 131, z * 13 - y * 17, y); }
function vnoise(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash2(xi, zi, s), hash2(xi + 1, zi, s), u), lerp(hash2(xi, zi + 1, s), hash2(xi + 1, zi + 1, s), u), v);
}
const fbm = (x, z, s = 0) => vnoise(x, z, s) * 0.6 + vnoise(x * 2.1 + 7, z * 2.1 + 3, s) * 0.3 + vnoise(x * 4.3 + 1, z * 4.3 + 9, s) * 0.1;
/* colour helpers on 0xRRGGBB ints */
function shade(c, k) { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; }
function mixc(a, b, t) { const r = lerp((a >> 16) & 255, (b >> 16) & 255, t) | 0, g = lerp((a >> 8) & 255, (b >> 8) & 255, t) | 0, bl = lerp(a & 255, b & 255, t) | 0; return (r << 16) | (g << 8) | bl; }
const jit = (c, a = 0.06) => shade(c, 1 + (WR() - 0.5) * 2 * a);

/* ---------- merged box builder (lines, net, fence) ---------- */
class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.stack = [new THREE.Matrix4()]; }
  get base() { return this.stack[this.stack.length - 1]; }
  add(geo, x, y, z, color, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, jitter = 0.03) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _t.set(x, y, z); _s.set(sx, sy, sz);
    _m4.compose(_t, _q, _s).premultiply(this.base);
    g.applyMatrix4(_m4);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    _c.set(color);
    for (let i = 0; i < P.length; i += 9) {
      const j = 1 + (WR() - 0.5) * jitter * 2;
      for (let k = 0; k < 3; k++) {
        this.pos.push(P[i + k * 3], P[i + k * 3 + 1], P[i + k * 3 + 2]);
        this.nor.push(N[i + k * 3], N[i + k * 3 + 1], N[i + k * 3 + 2]);
        this.col.push(_c.r * j, _c.g * j, _c.b * j);
      }
    }
    g.dispose(); return this;
  }
  /* any geometry, transformed, with a colour per vertex from fn(world xyz, world normal, local xyz) */
  addV(geo, m4, colorFn) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const L = g.attributes.position.array.slice();
    g.applyMatrix4(m4);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) {
      this.pos.push(P[i], P[i + 1], P[i + 2]); this.nor.push(N[i], N[i + 1], N[i + 2]);
      _c.set(colorFn(P[i], P[i + 1], P[i + 2], N[i], N[i + 1], N[i + 2], L[i], L[i + 1], L[i + 2])); this.col.push(_c.r, _c.g, _c.b);
    }
    g.dispose(); return this;
  }
  box(w, h, d, x, y, z, color, ry = 0, jitter) { return this.add(GEO.box, x, y, z, color, 0, ry, 0, w, h, d, jitter); }
  boxR(w, h, d, x, y, z, color, rx, ry, rz) { return this.add(GEO.box, x, y, z, color, rx, ry, rz, w, h, d); }
  mesh(material, shadows = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = shadows; m.receiveShadow = shadows; m.matrixAutoUpdate = false;
    return m;
  }
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), cyl8: new THREE.CylinderGeometry(1, 1, 1, 10),
  sph: new THREE.SphereGeometry(1, 16, 12), ico: new THREE.IcosahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 1, 14),
  cap: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  hoop: new THREE.TorusGeometry(1, 0.11, 6, 22), disc: new THREE.CircleGeometry(1, 20)
};

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw, repeat, nearest) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (nearest) t.magFilter = THREE.NearestFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(ctx, w, h, n, colors, size = 2) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = colors[(WR() * colors.length) | 0]; ctx.fillRect(WR() * w, WR() * h, size * WR() + 0.6, size * WR() + 0.6); }
}
const TEX = {
  clay: () => canvasTex(512, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c26a46'); g.addColorStop(1, '#b8623f');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 26000, ['rgba(255,214,170,.16)', 'rgba(120,45,18,.2)', 'rgba(170,70,30,.18)', 'rgba(230,140,90,.14)'], 2);
    // raked bands, the way a clay court looks after the evening brush
    for (let y = 0; y < h; y += 3) { x.fillStyle = `rgba(150,60,25,${0.02 + WR() * 0.04})`; x.fillRect(0, y, w, 1); }
    for (const yy of [h * 0.17, h * 0.83]) { const r = x.createRadialGradient(w / 2, yy, 10, w / 2, yy, 150); r.addColorStop(0, 'rgba(160,62,26,.32)'); r.addColorStop(1, 'rgba(160,62,26,0)'); x.fillStyle = r; x.fillRect(0, yy - 160, w, 320); }
  }),
  grassCourt: () => canvasTex(512, 1024, (x, w, h) => {
    x.fillStyle = '#6fa548'; x.fillRect(0, 0, w, h);
    const bands = 16;
    for (let i = 0; i < bands; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(30,60,10,.08)'; x.fillRect(0, (h / bands) * i, w, h / bands); }
    speckle(x, w, h, 22000, ['rgba(40,80,20,.18)', 'rgba(170,210,110,.16)', 'rgba(90,140,50,.2)'], 1.6);
    for (const yy of [h * 0.18, h * 0.82]) {
      const r = x.createRadialGradient(w / 2, yy, 6, w / 2, yy, 120); r.addColorStop(0, 'rgba(168,160,104,.42)'); r.addColorStop(0.6, 'rgba(150,150,96,.16)'); r.addColorStop(1, 'rgba(150,150,96,0)');
      x.fillStyle = r; x.save(); x.translate(w / 2, yy); x.scale(1.7, 0.55); x.translate(-w / 2, -yy); x.fillRect(0, yy - 130, w, 260); x.restore();
    }
  }),
  hardCourt: () => canvasTex(512, 1024, (x, w, h) => {
    x.fillStyle = '#4a8a5a'; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 9000, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.06)'], 1.4);
    const ix = w * (1 - 13.0 / 18.3) / 2, iy = h * (1 - 31.0 / 36.0) / 2;
    x.fillStyle = '#3b74b4'; x.fillRect(ix, iy, w - ix * 2, h - iy * 2);
    speckle(x, w, h, 9000, ['rgba(255,255,255,.04)', 'rgba(0,0,30,.06)'], 1.4);
  }),
  /* chunky cobbles for the path around the court */
  cobble: (base, dark, light) => canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = dark; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 9; col++) {
      const off = row % 2 ? 4 : 0, cx = col * 8 - off, cy = row * 8;
      x.fillStyle = WR() < 0.5 ? base : WR() < 0.5 ? light : base; x.fillRect(cx + 1, cy + 1, 6, 6);
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(cx + 1, cy + 1, 6, 1);
    }
  }, [1, 1], true),
  chain: () => canvasTex(64, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(40,52,46,1)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w / 2, 0); x.lineTo(w, h / 2); x.lineTo(w / 2, h); x.closePath(); x.stroke();
  }, [1, 1]),
  banner: (text, bg, fg, aspect = 16) => canvasTex(Math.min(4096, Math.round(aspect * 128)), 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    // faint weave of the mesh screen
    for (let i = 0; i < w; i += 4) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(i, 0, 1, h); }
    for (let j = 0; j < h; j += 4) { x.fillStyle = 'rgba(255,255,255,.03)'; x.fillRect(0, j, w, 1); }
    if (!text) return;
    x.fillStyle = fg; x.globalAlpha = 0.82; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '600 30px -apple-system, "Helvetica Neue", Arial, sans-serif';
    const t = text.toUpperCase().split('').join(String.fromCharCode(8202));
    const n = Math.max(1, Math.round(w / 128 / 4.8));          // a name every ~9 m
    for (let i = 0; i < n; i++) x.fillText(t, w * (i + 0.5) / n, h / 2 + 1);
  }),
  mark: () => canvasTex(64, 64, (x, w, h) => {
    const r = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(110,40,15,.85)'); r.addColorStop(0.55, 'rgba(120,45,18,.55)'); r.addColorStop(1, 'rgba(120,45,18,0)');
    x.fillStyle = r; x.fillRect(0, 0, w, h);
  }),
  blob: () => canvasTex(64, 64, (x, w, h) => {
    const r = x.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = r; x.fillRect(0, 0, w, h);
  }),
  glow: () => canvasTex(64, 64, (x, w, h) => {
    const r = x.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.25, 'rgba(255,220,150,.45)'); r.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = r; x.fillRect(0, 0, w, h);
  }),
  burst: () => canvasTex(128, 128, (x, w, h) => {
    const r = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,250,220,.9)'); r.addColorStop(0.42, 'rgba(255,240,180,.0)');
    r.addColorStop(0.62, 'rgba(255,255,255,.75)'); r.addColorStop(0.72, 'rgba(255,255,255,0)');
    x.fillStyle = r; x.fillRect(0, 0, w, h);
  }),
  ring: () => canvasTex(128, 128, (x, w, h) => {
    x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 8, 0, TAU); x.stroke();
  }),
  water: () => canvasTex(32, 128, (x, w, h) => {
    x.fillStyle = 'rgba(130,205,238,.8)'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { x.fillStyle = WR() < 0.6 ? 'rgba(255,255,255,.6)' : 'rgba(70,150,200,.5)'; x.fillRect((WR() * w) | 0, (WR() * h) | 0, 2 + ((WR() * 3) | 0), 6 + ((WR() * 18) | 0)); }
  }, [1, 1], true),
  netMesh: () => canvasTex(16, 16, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h);
  }, [1, 1]),
  cloud: () => canvasTex(256, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const puffs = [[0.5, 0.58, 0.3], [0.32, 0.64, 0.22], [0.68, 0.64, 0.22], [0.42, 0.46, 0.2], [0.6, 0.44, 0.18], [0.2, 0.72, 0.14], [0.8, 0.72, 0.14]];
    for (const [px, py, r] of puffs) { const g = x.createRadialGradient(px * w, py * h, 0, px * w, py * h, r * w); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.55, 'rgba(250,252,255,.6)'); g.addColorStop(1, 'rgba(240,246,250,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
    const s = x.createLinearGradient(0, h * 0.5, 0, h); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(150,170,190,.25)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = s; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
  }),
  soil: () => canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#d8cfc4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const r = 2 + WR() * 10; x.fillStyle = `rgba(${WR() < 0.5 ? '255,250,240' : '70,50,35'},${0.05 + WR() * 0.08})`; x.beginPath(); x.ellipse(WR() * w, WR() * h, r * 1.6, r, 0, 0, TAU); x.fill(); }
    // pebbles with a lit top and a dark underside
    for (let i = 0; i < 520; i++) {
      const px = WR() * w, py = WR() * h, r = 1.5 + Math.pow(WR(), 2) * 9, c = 150 + WR() * 90 | 0;
      x.fillStyle = 'rgba(40,28,18,.45)'; x.beginPath(); x.ellipse(px + 1, py + r * 0.5, r * 1.25, r * 0.85, 0, 0, TAU); x.fill();
      x.fillStyle = `rgb(${c},${c - 8},${c - 20})`; x.beginPath(); x.ellipse(px, py, r * 1.2, r * 0.8, WR(), 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(px - r * 0.3, py - r * 0.3, r * 0.5, r * 0.3, 0, 0, TAU); x.fill();
    }
    // fine roots and cracks
    x.lineCap = 'round';
    for (let i = 0; i < 70; i++) { let px = WR() * w, py = WR() * h; x.strokeStyle = `rgba(60,40,25,${0.25 + WR() * 0.3})`; x.lineWidth = 0.6 + WR() * 1.6; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (WR() - 0.5) * 30; py += 6 + WR() * 16; x.lineTo(px, py); } x.stroke(); }
  }, [1, 1]),
  pond: () => canvasTex(32, 32, (x, w, h) => {
    x.fillStyle = '#5fb1d6'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { x.fillStyle = WR() < 0.6 ? 'rgba(255,255,255,.35)' : 'rgba(40,120,170,.35)'; x.fillRect((WR() * w) | 0, (WR() * h) | 0, 3 + ((WR() * 4) | 0), 1); }
  }, [1, 1], true)
};

/* ---------- island (miniature diorama) ---------- */
const ISLAND = { x0: -16.6, x1: 12.6, z0: -25.0, z1: 20.4 };
const ISLAND_DEPTH = 17;
const PATH_IN = 0.35, PATH_OUT = 1.9;

/* 3D value noise for rock faces and foliage */
function vnoise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (a, b, c) => hash2(a * 7 + c * 1013 + s * 31, b * 131 - c * 17 + s * 7, c * 3 + s);
  const a0 = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v);
  const a1 = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v);
  return lerp(a0, a1, w);
}

/* Island outline: a rounded rectangle with a softly wobbling edge.
   Returns points (counter-clockwise seen from above) every ~step metres. */
function islandOutline(step = 0.35) {
  const { x0, x1, z0, z1 } = ISLAND, R = 4.2;
  const pts = [];
  const cx0 = x0 + R, cx1 = x1 - R, cz0 = z0 + R, cz1 = z1 - R;
  const seg = (ax, az, bx, bz) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step)); for (let i = 0; i < n; i++) pts.push([lerp(ax, bx, i / n), lerp(az, bz, i / n)]); };
  const arc = (cx, cz, a0, a1) => { const n = Math.max(2, Math.round(R * Math.abs(a1 - a0) / step)); for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } };
  // walk: +z edge (left to right), +x edge, -z edge, -x edge
  seg(cx0, z1, cx1, z1); arc(cx1, cz1, Math.PI / 2, 0);
  seg(x1, cz1, x1, cz0); arc(cx1, cz0, 0, -Math.PI / 2);
  seg(cx1, z0, cx0, z0); arc(cx0, cz0, -Math.PI / 2, -Math.PI);
  seg(x0, cz0, x0, cz1); arc(cx0, cz1, Math.PI, Math.PI / 2);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return pts.map(([x, z], i) => {
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1;
    const w = (fbm(x * 0.16, z * 0.16, 3) - 0.5) * 1.3 + (vnoise(x * 0.7, z * 0.7, 5) - 0.5) * 0.35;
    return [x + dx / d * w, z + dz / d * w];
  });
}
/* Signed distance into the island (positive inside), approximate. */
function islandEdge(x, z) {
  const { x0, x1, z0, z1 } = ISLAND, R = 4.2;
  const dx = Math.min(x - x0, x1 - x), dz = Math.min(z - z0, z1 - z);
  const d = dx < R && dz < R ? R - Math.hypot(R - dx, R - dz) : Math.min(dx, dz);
  return d + (fbm(x * 0.16, z * 0.16, 3) - 0.5) * 1.3;
}

/* ---------- lumpy shapes (foliage, rocks) ---------- */
const _lumpCache = new Map();
function lumpGeo(detail, amp, freq, seed) {
  const key = detail + ':' + amp + ':' + freq + ':' + seed;
  if (_lumpCache.has(key)) return _lumpCache.get(key);
  const g = new THREE.IcosahedronGeometry(1, detail);
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), l = Math.hypot(x, y, z) || 1;
    const nx = x / l, ny = y / l, nz = z / l;
    const r = 1 + amp * ((vnoise3(nx * freq + seed, ny * freq, nz * freq - seed, 3) - 0.5) * 2 + (vnoise3(nx * freq * 2.3, ny * freq * 2.3 + seed, nz * freq * 2.3, 9) - 0.5) * 0.7);
    P.setXYZ(i, nx * r, ny * r, nz * r); N.setXYZ(i, nx, ny, nz);
  }
  g.userData.lump = true;
  _lumpCache.set(key, g); return g;
}
const _M = new THREE.Matrix4();
function mtx(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { _e.set(rx, ry, rz); _q.setFromEuler(_e); _t.set(x, y, z); _s.set(sx, sy, sz); return _M.compose(_t, _q, _s); }

/* foliage colour: lit top, cool shaded underside, darker in the hollows */
function leafShade(base, light) {
  return (px, py, pz, nx, ny, nz, lx, ly, lz) => {
    const r = Math.hypot(lx, ly, lz);
    const hollow = clamp((r - 0.86) / 0.28, 0, 1);
    const k = 0.66 + 0.34 * clamp(ny * 0.5 + 0.5, 0, 1);
    const sun = clamp(-nx * 0.45 + ny * 0.55 + nz * 0.15, 0, 1);
    return mixc(shade(base, k * (0.74 + hollow * 0.36)), light, sun * hollow * 0.5);
  };
}

/* ---------- props built from smooth shapes ---------- */
function pCypress(B, x, z, h, pal) {
  B.addV(GEO.cyl8, mtx(x, 0.3, z, 0.09, 0.6, 0.09), () => 0x5a3c26);
  const w = h * 0.17 + wr(-0.05, 0.05);
  B.addV(lumpGeo(3, 0.09, 2.6, (x * 13 + z) % 7), mtx(x, h * 0.5 + 0.35, z, w, h * 0.5, w, wr(0, 6)), leafShade(pal[0], pal[1]));
  // a few lumps break the outline like real foliage
  for (let k = 0; k < 3; k++) { const yy = wr(0.3, 0.75) * h, a = wr(0, TAU), rr = w * 0.75; B.addV(lumpGeo(2, 0.12, 2.2, k + 2), mtx(x + Math.cos(a) * rr * 0.55, yy, z + Math.sin(a) * rr * 0.55, rr * 0.7, rr * 0.9, rr * 0.7), leafShade(pal[0], pal[1])); }
}
function pRoundTree(B, x, z, s, pal) {
  const h = 2.2 * s;
  B.addV(GEO.cyl8, mtx(x, h / 2, z, 0.16 * s, h, 0.16 * s), (px, py) => shade(0x6b4a2c, 0.75 + py / h * 0.3));
  B.addV(GEO.cyl8, mtx(x + 0.35 * s, h * 0.72, z, 0.07 * s, 0.9 * s, 0.07 * s, 0, 0, -0.8), () => 0x5e4026);
  const blobs = [[0, h + 0.8 * s, 0, 1.45], [0.9, h + 0.4 * s, 0.35, 1.0], [-0.8, h + 0.5 * s, -0.3, 1.05], [0.15, h + 1.55 * s, -0.25, 0.95], [-0.2, h + 0.3 * s, 0.85, 0.85]];
  blobs.forEach(([ox, oy, oz, rr], i) => B.addV(lumpGeo(2, 0.16, 1.8, i + 4), mtx(x + ox * s, oy, z + oz * s, rr * s, rr * s * 0.85, rr * s, wr(0, 6)), leafShade(pal[i % pal.length], 0xd8e8a0)));
}
function pBush(B, x, z, r, pal, flowers) {
  const n = 2 + ((WR() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const a = wr(0, TAU), d = k ? r * wr(0.35, 0.7) : 0, rr = r * (k ? wr(0.55, 0.8) : 1);
    B.addV(lumpGeo(2, 0.14, 2.4, k + 11), mtx(x + Math.cos(a) * d, rr * 0.62, z + Math.sin(a) * d, rr, rr * 0.82, rr, wr(0, 6)), leafShade(pal[k % pal.length], 0xc8e090));
  }
  if (flowers) for (let k = 0; k < Math.round(r * 14); k++) {
    const a = wr(0, TAU), u = wr(0.2, 0.95), rr = r * 0.95;
    const fx = x + Math.cos(a) * rr * u, fz = z + Math.sin(a) * rr * u, fy = r * 0.62 + Math.sqrt(1 - u * u) * r * 0.8;
    B.addV(GEO.ico, mtx(fx, fy, fz, 0.06, 0.06, 0.06), () => wpick(flowers));
  }
}
function pPalm(B, F, x, z, h) {
  const lean = wr(-0.7, 0.7), leanZ = wr(-0.5, 0.5);
  const pts = []; for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push(new THREE.Vector3(x + lean * u * u, u * h, z + leanZ * u * u)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  B.addV(new THREE.TubeGeometry(curve, 14, 0.13, 7, false), new THREE.Matrix4(), (px, py) => (Math.floor(py / 0.28) % 2) ? 0x8f6c46 : 0x7c5d3b);
  const top = pts[5];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + wr(-0.25, 0.25), L = wr(1.7, 2.3);
    const g = new THREE.PlaneGeometry(L, 0.55, 8, 2), P = g.attributes.position;
    for (let j = 0; j < P.count; j++) { const u = (P.getX(j) / L) + 0.5, v = P.getY(j); P.setXYZ(j, u * L, 0.35 * u * L - 0.45 * u * u * L, v * (1 - u * 0.7)); }
    g.computeVertexNormals();
    const m = new THREE.Matrix4().makeRotationY(-a).premultiply(new THREE.Matrix4().makeTranslation(top.x, top.y + 0.1, top.z));
    F.addV(g, m, (px, py, pz, nx, ny) => shade(i % 2 ? 0x3e8a3c : 0x4c9a45, 0.8 + Math.abs(ny) * 0.25));
  }
  B.addV(lumpGeo(1, 0.1, 2, 3), mtx(top.x, top.y, top.z, 0.26, 0.3, 0.26), () => 0x6b4a2a);
}
function pBench(B, x, z, ry, wood) {
  const L = 1.7, c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, w] of [[-0.12, 0.12], [0.03, 0.12], [0.18, 0.12]]) { const [px, pz] = at(lx, 0); B.addV(GEO.box, mtx(px, 0.45, pz, w, 0.04, L, ry), () => jit(wood, 0.05)); }
  for (const y of [0.62, 0.78]) { const [px, pz] = at(-0.22, 0); B.addV(GEO.box, mtx(px, y, pz, 0.04, 0.11, L, ry, 0, -0.12), () => jit(wood, 0.05)); }
  for (const lz of [-L / 2 + 0.12, L / 2 - 0.12]) for (const lx of [-0.18, 0.18]) { const [px, pz] = at(lx, lz); B.addV(GEO.box, mtx(px, 0.22, pz, 0.05, 0.45, 0.05, ry), () => 0x3a3a36); }
}
function pUmpireChair(B, x, z, wood, top) {
  const H = 1.8;
  for (const [ox, oz] of [[-0.32, -0.32], [-0.32, 0.32], [0.32, -0.32], [0.32, 0.32]]) B.addV(GEO.box, mtx(x + ox, H / 2, z + oz, 0.07, H, 0.07), () => wood);
  for (const y of [0.6, 1.2]) for (const oz of [-0.32, 0.32]) B.addV(GEO.box, mtx(x, y, z + oz, 0.7, 0.05, 0.05), () => wood);
  for (let i = 1; i <= 4; i++) B.addV(GEO.box, mtx(x + 0.36, i * 0.38, z, 0.06, 0.05, 0.62), () => wood);
  B.addV(GEO.box, mtx(x, H + 0.04, z, 0.8, 0.08, 0.8), () => wood);
  B.addV(GEO.box, mtx(x - 0.38, H + 0.38, z, 0.06, 0.6, 0.8), () => wood);
  for (const oz of [-0.38, 0.38]) B.addV(GEO.box, mtx(x, H + 0.32, z + oz, 0.8, 0.04, 0.06), () => wood);
  B.addV(GEO.cyl8, mtx(x - 0.3, H + 0.6, z + 0.3, 0.02, 1.2, 0.02), () => 0xd9d4c6);
  B.addV(GEO.cone, mtx(x - 0.1, H + 1.28, z + 0.1, 0.9, 0.22, 0.9), (px, py, pz, nx, ny) => shade(top, 0.85 + ny * 0.15));
}
/* a seated figurine (umpire, people on the clubhouse bench) */
function pSitter(B, x, y, z, ry, shirt, skin, legs) {
  const c = Math.cos(ry), s = Math.sin(ry), fx = s, fz = c;
  B.addV(GEO.sph, mtx(x, y + 0.3, z, 0.18, 0.25, 0.13, ry), () => shirt);
  B.addV(GEO.sph, mtx(x, y + 0.66, z, 0.13, 0.14, 0.13, ry), () => skin);
  B.addV(GEO.sph, mtx(x - fx * 0.02, y + 0.74, z - fz * 0.02, 0.135, 0.08, 0.135, ry), () => 0x3b2a1e);
  B.addV(GEO.sph, mtx(x + fx * 0.2, y + 0.05, z + fz * 0.2, 0.17, 0.08, 0.22, ry), () => legs);
  B.addV(GEO.sph, mtx(x + fx * 0.4, y - 0.2, z + fz * 0.4, 0.15, 0.22, 0.08, ry), () => legs);
}
function pLamp(B, G, x, z) {
  B.addV(GEO.cyl8, mtx(x, 1.3, z, 0.05, 2.6, 0.05), () => 0x23302a);
  B.addV(GEO.cone, mtx(x, 2.78, z, 0.24, 0.16, 0.24), () => 0x23302a);
  G.addV(GEO.sph, mtx(x, 2.62, z, 0.12, 0.12, 0.12), () => 0xfff0b8);
  return { x, y: 2.62, z };
}
function pFlowerBed(B, x, z, w, d, flowers) {
  B.addV(GEO.box, mtx(x, 0.08, z, w, 0.16, d), () => 0xb7a284);
  B.addV(GEO.box, mtx(x, 0.15, z, w - 0.16, 0.06, d - 0.16), () => 0x5a3e28);
  const n = Math.round(w * d * 7);
  for (let k = 0; k < n; k++) { const fx = x + wr(-w / 2 + 0.15, w / 2 - 0.15), fz = z + wr(-d / 2 + 0.15, d / 2 - 0.15); const g = WR() < 0.45; B.addV(g ? lumpGeo(1, 0.15, 2, 1) : GEO.ico, mtx(fx, 0.24, fz, g ? 0.13 : 0.07, g ? 0.1 : 0.07, g ? 0.13 : 0.07), () => g ? jit(0x5d9a3c, 0.1) : wpick(flowers)); }
}
function pHedge(B, x0, z0, x1, z1, h, col) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 0.7)), ry = Math.atan2(x1 - x0, z1 - z0);
  for (let k = 0; k <= n; k++) { const u = k / n; B.addV(lumpGeo(2, 0.13, 2.2, k % 5), mtx(lerp(x0, x1, u), h * 0.55, lerp(z0, z1, u), 0.5, h * 0.6, 0.5, ry + k), leafShade(col, 0xc8e090)); }
}

/* A small clubhouse like a model railway building: clapboard walls, a
   gabled shingle roof with a front gable, a striped awning, windows and
   a door. Faces +z (toward the court). Returns spots for spectators. */
function pClubhouse(B, G, cx, cz, o) {
  const W = o.w, D = o.d, H = 2.9, x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  // plinth and walls (horizontal clapboard: slightly darker lines)
  B.addV(GEO.box, mtx(cx, 0.12, cz, W + 0.3, 0.24, D + 0.3), () => o.base);
  B.addV(GEO.box, mtx(cx, 0.24 + H / 2, cz, W, H, D), (px, py) => shade(o.wall, (Math.floor((py - 0.24) / 0.22) % 2) ? 0.96 : 1.0));
  // corner boards
  for (const x of [x0, x1]) for (const z of [z0, z1]) B.addV(GEO.box, mtx(x, 0.24 + H / 2, z, 0.14, H, 0.14), () => o.trim);
  // windows on the front and the sides, door in the middle
  const win = (x, y, z, w, h, ry) => {
    B.addV(GEO.box, mtx(x, y, z, w + 0.14, h + 0.14, 0.06, ry), () => o.trim);
    G.addV(GEO.box, mtx(x + Math.sin(ry) * 0.035, y, z + Math.cos(ry) * 0.035, w, h, 0.03, ry), (px, py) => mixc(0x9ab8c8, 0xffe2a8, 0.5));
    B.addV(GEO.box, mtx(x + Math.sin(ry) * 0.05, y, z + Math.cos(ry) * 0.05, 0.04, h, 0.02, ry), () => o.trim);
    B.addV(GEO.box, mtx(x + Math.sin(ry) * 0.05, y, z + Math.cos(ry) * 0.05, w, 0.04, 0.02, ry), () => o.trim);
  };
  for (let x = x0 + 1.1; x < x1 - 0.8; x += 1.7) { if (Math.abs(x - cx) < 0.9) continue; win(x, 1.55, z1 + 0.02, 0.8, 1.0, 0); }
  win(x0 - 0.02, 1.55, cz, 0.8, 1.0, -Math.PI / 2); win(x1 + 0.02, 1.55, cz, 0.8, 1.0, Math.PI / 2);
  B.addV(GEO.box, mtx(cx, 1.25, z1 + 0.02, 0.95, 2.0, 0.06), () => o.trim);
  B.addV(GEO.box, mtx(cx, 1.22, z1 + 0.05, 0.8, 1.9, 0.04), () => o.door);
  // gable roof along x, shingles in rows
  const RH = 1.7, ov = 0.4, slope = Math.atan2(RH, D / 2 + ov), Ls = Math.hypot(D / 2 + ov, RH) + 0.1, yR = 0.24 + H;
  for (const sd of [-1, 1]) {
    const zc = cz + sd * (D / 2 + ov) / 2, yc = yR + RH / 2;
    B.addV(GEO.box, mtx(cx, yc, zc, W + ov * 2, 0.12, Ls, 0, sd * slope), (px, py, pz) => shade(o.roof, (Math.floor((py - yR) / 0.2) % 2) ? 0.92 : 1.02) * 1);
  }
  // gable ends
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -D / 2, 0, 0, D / 2, 0, RH, 0], 3)); tri.computeVertexNormals();
  for (const x of [x0, x1]) { const g = tri.clone(); if (x === x1) g.scale(-1, 1, 1); g.computeVertexNormals(); B.addV(g, mtx(x, yR, cz, 1, 1, 1), () => o.wall); const g2 = g.clone(); g2.scale(-1, 1, 1); g2.computeVertexNormals(); B.addV(g2, mtx(x, yR, cz, 1, 1, 1), () => o.wall); }
  B.addV(GEO.box, mtx(cx, yR + RH + 0.04, cz, W + ov * 2 + 0.05, 0.1, 0.16), () => shade(o.roof, 0.8));
  // front gable over the door
  const fw = 2.4, fh = 1.15, fz = z1 + 0.05;
  B.addV(GEO.box, mtx(cx, 2.35, fz + 0.02, 1.4, 0.32, 0.05), () => o.door); void fw; void fh;
  if (o.chimney) B.addV(GEO.box, mtx(x1 - 1.4, yR + RH * 0.7, cz - 0.8, 0.5, 1.4, 0.5), () => o.trim);
  // striped awning across the front
  const aw = W * 0.86, n = Math.round(aw / 0.3), ay = 2.62, ad = 1.2;
  for (let i = 0; i < n; i++) {
    const x = cx - aw / 2 + (i + 0.5) * aw / n;
    B.addV(GEO.box, mtx(x, ay - 0.22, z1 + ad / 2, aw / n + 0.005, 0.04, ad + 0.05, 0, -0.36), () => (i % 2) ? o.awning[0] : o.awning[1]);
    B.addV(GEO.box, mtx(x, ay - 0.53, z1 + ad + 0.04, aw / n + 0.005, 0.2, 0.03), () => (i % 2) ? o.awning[0] : o.awning[1]);
  }
  // benches and little tables on the terrace
  pBench(B, cx - W * 0.3, z1 + 1.9, 0, o.benchWood || 0x8a5a2e); pBench(B, cx + W * 0.3, z1 + 1.9, 0, o.benchWood || 0x8a5a2e);
  return [{ x: cx - W * 0.3 - 0.4, y: 0.45, z: z1 + 1.9, ry: 0 }, { x: cx + W * 0.3 + 0.3, y: 0.45, z: z1 + 1.9, ry: 0 }];
}

/* Wooden bleachers like the ones at a small club: open plank rows on a
   timber frame, with a back rail. Faces +x. Returns seats. */
function pBleachers(B, xFront, zA, zB, rows, st) {
  const seats = [], depth = 0.82, rise = 0.46, L = zB - zA, zc = (zA + zB) / 2;
  for (let r = 0; r < rows; r++) {
    const xb = xFront - r * depth, h = (r + 1) * rise;
    B.addV(GEO.box, mtx(xb - 0.24, h, zc, 0.42, 0.06, L), (px, py, pz) => jit(st.seat, 0.04));      // seat plank
    B.addV(GEO.box, mtx(xb - depth + 0.12, h - 0.25, zc, 0.3, 0.04, L), () => shade(st.seat, 0.86)); // foot board
    for (let z = zA + 0.2; z <= zB - 0.19; z += L / Math.round(L / 2.2)) B.addV(GEO.box, mtx(xb - 0.24, h / 2, z, 0.07, h, 0.07), () => st.frame);
    for (let z = zA + 0.6; z < zB - 0.3; z += 0.6) {
      const group = vnoise(z * 0.45, r * 2.3, 17);
      if (group + WR() * 0.3 > 0.92 - st.fill * 0.5) seats.push({ x: xb - 0.2, y: h + 0.03, z: z + wr(-0.05, 0.05), ry: Math.PI / 2 });
    }
  }
  const back = xFront - rows * depth + 0.1, top = rows * rise;
  // side frames (diagonal stringers) and the back rail
  for (const z of [zA, zB]) {
    B.addV(GEO.box, mtx((xFront + back) / 2, top / 2, z, 0.08, Math.hypot(rows * depth, top) + 0.1, 0.1, 0, 0, Math.atan2(rows * depth, top)), () => st.frame);
    B.addV(GEO.box, mtx(back, (top + 1.0) / 2, z, 0.08, top + 1.0, 0.08), () => st.frame);
  }
  for (const y of [top + 0.55, top + 1.0]) B.addV(GEO.box, mtx(back, y, zc, 0.06, 0.06, L), () => st.frame);
  return seats;
}

/* The court core: surface, lines, net, fence, umpire chair and benches. */
function buildCourtCore(group, B, G, style) {
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(COURT.RX * 2, COURT.RZ * 2), new THREE.MeshLambertMaterial({ map: style.courtTex }));
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0.012; surf.receiveShadow = true; group.add(surf);
  const RX = COURT.RX, RZ = COURT.RZ;
  // a slim painted curb where the court meets the lawn
  for (const z of [-RZ - 0.08, RZ + 0.08]) B.addV(GEO.box, mtx(0, 0.03, z, RX * 2 + 0.32, 0.06, 0.16), () => style.curb);
  for (const x of [-RX - 0.08, RX + 0.08]) B.addV(GEO.box, mtx(x, 0.03, 0, 0.16, 0.06, RZ * 2), () => style.curb);
  // lines
  const L = new Builder(); const lc = style.line, y = 0.018, lw = 0.07;
  const line = (w, d, x, z) => L.box(w, 0.004, d, x, y, z, lc, 0, 0.0);
  line(COURT.DW * 2 + lw, 0.11, 0, COURT.HL); line(COURT.DW * 2 + lw, 0.11, 0, -COURT.HL);
  for (const sx of [-1, 1]) { line(lw, COURT.HL * 2, sx * COURT.DW, 0); line(lw, COURT.HL * 2, sx * COURT.SW, 0); }
  line(COURT.SW * 2, lw, 0, COURT.SV); line(COURT.SW * 2, lw, 0, -COURT.SV);
  line(lw, COURT.SV * 2, 0, 0);
  line(lw, 0.3, 0, COURT.HL - 0.15); line(lw, 0.3, 0, -COURT.HL + 0.15);
  const lineMesh = L.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false); lineMesh.receiveShadow = true; group.add(lineMesh);
  // net: posts, mesh, cord and white tape
  for (const sx of [-1, 1]) { B.addV(GEO.cyl8, mtx(sx * COURT.NETW, (COURT.NETP + 0.08) / 2, 0, 0.05, COURT.NETP + 0.08, 0.05), () => 0x1d3a2a); B.addV(GEO.sph, mtx(sx * COURT.NETW, COURT.NETP + 0.09, 0, 0.06, 0.04, 0.06), () => 0xd9d4c6); }
  const ng = new THREE.PlaneGeometry(COURT.NETW * 2, 1, 40, 1), np = ng.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i), top = np.getY(i) > 0; np.setY(i, top ? netHeight(x) - 0.05 : 0.03); }
  np.needsUpdate = true; ng.computeVertexNormals();
  const net = new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ map: TEX.netMesh(), color: 0x2a332e, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 }));
  net.material.map.repeat.set(COURT.NETW * 2 / 0.09, 1 / 0.09);
  net.renderOrder = 1; group.add(net);
  for (let i = 0; i < 24; i++) {
    const xa = -COURT.NETW + (i / 24) * COURT.NETW * 2, xb = xa + COURT.NETW * 2 / 24, ya = netHeight(xa), yb = netHeight(xb);
    B.addV(GEO.box, mtx((xa + xb) / 2, (ya + yb) / 2 - 0.03, 0, xb - xa + 0.01, 0.065, 0.035, 0, 0, Math.atan2(yb - ya, xb - xa)), () => 0xf6f3ea);
  }
  B.addV(GEO.box, mtx(0, COURT.NETC / 2, 0, 0.05, COURT.NETC, 0.025), () => 0xf6f3ea);
  // fence: tall behind the far baseline and the stand side, low on the camera sides
  const FH = style.fenceH, post = style.post;
  const chain = TEX.chain();
  const chainMat = (len, h) => { const t = chain.clone(); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; t.repeat.set(len / 0.3, h / 0.3); return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, color: 0x3f5a48, opacity: 0.55, depthWrite: false }); };
  const run = (ax, az, bx, bz, h, gapFrom = null, gapTo = null) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 3)), ry = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) { const u = k / n, x = lerp(ax, bx, u), z = lerp(az, bz, u); const inGap = gapFrom != null && (ax === bx ? z : x) > gapFrom && (ax === bx ? z : x) < gapTo; if (!inGap) B.addV(GEO.cyl8, mtx(x, h / 2, z, 0.045, h, 0.045), () => post); }
    const seg = (s0, s1) => {
      const x0 = lerp(ax, bx, s0), z0 = lerp(az, bz, s0), x1 = lerp(ax, bx, s1), z1 = lerp(az, bz, s1), l = Math.hypot(x1 - x0, z1 - z0);
      if (l < 0.05) return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), chainMat(l, h)); m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.rotation.y = ry + Math.PI / 2; group.add(m);
      B.addV(GEO.box, mtx((x0 + x1) / 2, h, (z0 + z1) / 2, 0.05, 0.05, l, ry), () => post);
      B.addV(GEO.box, mtx((x0 + x1) / 2, 0.05, (z0 + z1) / 2, 0.04, 0.1, l, ry), () => post);
    };
    if (gapFrom == null) seg(0, 1);
    else { const a = ax === bx ? az : ax, b = ax === bx ? bz : bx; seg(0, (gapFrom - a) / (b - a)); seg((gapTo - a) / (b - a), 1); }
  };
  run(-RX, -RZ, RX, -RZ, FH);                          // far end
  run(-RX, -RZ, -RX, RZ, FH, -6.6, 6.6);               // stand side, open in the middle
  run(-RX, RZ, RX, RZ, 1.05);                          // near end, low
  run(RX, -RZ, RX, RZ, 1.05, -2.2, 2.2);               // near side, low with a gate
  // umpire chair and player benches on the stand side
  pUmpireChair(B, -COURT.NETW - 0.95, 0, style.wood, style.parasol);
  pSitter(B, -COURT.NETW - 0.95, 1.86, 0, Math.PI / 2, 0x24324a, 0xeec3a0, 0x2d3a4a);
  pBench(B, -COURT.NETW - 1.6, -2.7, Math.PI / 2, style.wood); pBench(B, -COURT.NETW - 1.6, 2.7, Math.PI / 2, style.wood);
}

/* Slim floodlight poles for dusk and night. */
function buildFloodlights(B, G, root, lights, halos) {
  for (const [x, z] of [[-10.6, -12.5], [-10.6, 12.5], [-7.5, -18.9], [7.5, -18.9]]) {
    const h = 9;
    B.addV(GEO.cyl8, mtx(x, h / 2, z, 0.08, h, 0.08), () => 0x2a3530);
    B.addV(GEO.box, mtx(x, h + 0.2, z, 0.9, 0.42, 0.9), () => 0x1d2620);
    B.addV(GEO.box, mtx(x, h - 0.02, z, 0.78, 0.04, 0.78), () => 0xfff4c8);
    const s = new THREE.SpotLight(0xfff1c8, 0, 50, 0.85, 0.6, 1.0);
    s.position.set(x, h, z); s.target.position.set(x * 0.1, 0, z * 0.25);
    root.add(s); root.add(s.target); lights.push(s);
    halos.push({ x, y: h - 0.2, z, s: 3.2 });
  }
}

/* The floating island: a lawn on top (with soft shade painted under
   everything that stands on it), a turf lip curling over the edge, and
   a deep earth cliff with rocks and hanging roots that narrows to a
   ragged point. */
function buildIsland(root, style, paint) {
  const out = islandOutline(0.34), N = out.length;
  const { x0, x1, z0, z1 } = ISLAND, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // lawn
  const shape = new THREE.Shape(out.map(([x, z]) => new THREE.Vector2(x, -z)));
  const tg = new THREE.ShapeGeometry(shape, 1); tg.rotateX(-Math.PI / 2);
  const uv = tg.attributes.uv, tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) uv.setXY(i, (tp.getX(i) - x0) / (x1 - x0), 1 - (tp.getZ(i) - z0) / (z1 - z0));
  const lawnTex = paint(); lawnTex.anisotropy = 8;
  const lawn = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ map: lawnTex })); lawn.receiveShadow = true; root.add(lawn);
  // outward normals of the outline
  const nrm = out.map((p, i) => { const a = out[(i - 1 + N) % N], b = out[(i + 1) % N]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz) || 1; return [nx / l, nz / l]; });
  // flip if pointing inward
  { const [px, pz] = out[0], [nx, nz] = nrm[0]; if ((px - cx) * nx + (pz - cz) * nz < 0) for (const n of nrm) { n[0] *= -1; n[1] *= -1; } }
  // turf lip: three rows hanging over the edge, ragged at the bottom
  { const pos = [], col = [], idx = [];
    for (let i = 0; i < N; i++) {
      const [px, pz] = out[i], [nx, nz] = nrm[i];
      const hang = 0.22 + vnoise(i * 0.35, 0, 8) * 0.35 + (hash2(i, 3, 2) < 0.2 ? 0.25 : 0);
      pos.push(px - nx * 0.5, 0.02, pz - nz * 0.5); pos.push(px + nx * 0.14, -0.04, pz + nz * 0.14); pos.push(px + nx * 0.16, -0.06 - hang, pz + nz * 0.16);
      const g = style.fringe;
      for (const c of [shade(g, 1.0), shade(g, 0.95), shade(g, 0.66)]) { _c.set(jit(c, 0.04)); col.push(_c.r, _c.g, _c.b); }
    }
    for (let i = 0; i < N; i++) { const a = i * 3, b = ((i + 1) % N) * 3; idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; root.add(m); }
  // cliff: rings from the rim down to a ragged keel
  const K = 30, pos = [], col = [], idx = [], ringPts = [], uvs = [];
  const perim = [0]; for (let i = 1; i < N; i++) perim.push(perim[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  const tipX = cx - 1.5, tipZ = cz + 2.0;
  for (let k = 0; k <= K; k++) {
    const t = k / K, y = -0.05 - Math.pow(t, 1.35) * ISLAND_DEPTH;
    // profile: a steep earth wall that bulges a little, then breaks into a long ragged taper
    const s = t < 0.6 ? 1 + Math.sin(t / 0.6 * Math.PI) * 0.025 - t * 0.07 : Math.max(0.04, 0.958 - Math.pow((t - 0.6) / 0.4, 1.25) * 0.93);
    const ccx = lerp(cx, tipX, t * t), ccz = lerp(cz, tipZ, t * t);
    const ring = [];
    for (let i = 0; i < N; i++) {
      const [px, pz] = out[i], [nx, nz] = nrm[i];
      let x = ccx + (px - cx) * s, z = ccz + (pz - cz) * s;
      const lump = (vnoise3(px * 0.28, y * 0.35, pz * 0.28, 4) - 0.5) * 1.6 * Math.min(1, t * 5 + 0.05)
        + (vnoise3(px * 1.1, y * 1.2, pz * 1.1, 6) - 0.5) * 0.5 * Math.min(1, t * 6 + 0.3);
      x += nx * lump * s; z += nz * lump * s;
      ring.push([x, y + (k === K ? -vnoise(i * 0.2, 0, 2) * 1.6 : 0), z, lump]);
      pos.push(x, ring[i][1], z); uvs.push(perim[i] / 5.0, -ring[i][1] / 5.0);
      // earth colour: strata, darker with depth and in the hollows
      const wob = (vnoise(px * 0.2, pz * 0.2, 11) - 0.5) * 1.1;
      const band = style.strata[clamp(Math.floor((-y + wob) / 2.0), 0, style.strata.length - 1)];
      const turf = -y < 0.42 + vnoise(i * 0.4, 1, 21) * 0.35;
      let c = turf ? shade(style.fringe, 0.92 - (-y) * 0.5) : -y < 1.0 ? style.topsoil : band;
      const dark = turf ? 1 : clamp(1.04 - t * 0.5 + lump * 0.25, 0.4, 1.12);
      c = shade(c, dark * (0.93 + hash2(i, k, 1) * 0.12));
      _c.set(c); col.push(_c.r, _c.g, _c.b);
    }
    ringPts.push(ring);
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) {
    const a = k * N + i, b = k * N + (i + 1) % N, c = (k + 1) * N + i, d = (k + 1) * N + (i + 1) % N;
    idx.push(a, c, b, b, c, d);
  }
  // close the bottom
  const tip = pos.length / 3; pos.push(tipX, -ISLAND_DEPTH - 1.5, tipZ); uvs.push(0, 3.3); _c.set(shade(style.strata[style.strata.length - 1], 0.5)); col.push(_c.r, _c.g, _c.b);
  for (let i = 0; i < N; i++) idx.push(K * N + i, tip, K * N + (i + 1) % N);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cg.setIndex(new THREE.Uint32BufferAttribute(idx, 1)); cg.computeVertexNormals();
  // make sure the faces point outward
  { const n = cg.attributes.normal; const [px, , pz] = ringPts[4][0]; const i = 4 * N; if ((n.getX(i) * (px - cx) + n.getZ(i) * (pz - cz)) < 0) { cg.index.array.reverse(); cg.computeVertexNormals(); } }
  const cliff = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.soil() })); cliff.castShadow = true; cliff.receiveShadow = true; root.add(cliff);
  return { ringPts, nrm, N, K, cx, cz };
}
/* stones set into the earth, roots hanging out of it */
function buildCliffDetail(B, isl, style) {
  const { ringPts, nrm, N, K } = isl;
  const rockC = style.rock;
  for (let r = 0; r < 300; r++) {
    const k = 1 + ((Math.pow(WR(), 0.8) * (K - 4)) | 0), i = (WR() * N) | 0, p = ringPts[k][i], [nx, nz] = nrm[i];
    const sz = (WR() < 0.15 ? wr(0.5, 0.95) : wr(0.12, 0.45)) * (1 - k / K * 0.45);
    B.addV(lumpGeo(1, 0.22, 1.6, r % 6), mtx(p[0] + nx * sz * 0.35, p[1], p[2] + nz * sz * 0.35, sz * wr(0.9, 1.5), sz * wr(0.6, 0.9), sz * wr(0.9, 1.4), wr(0, 6), wr(-0.4, 0.4)),
      (px, py, pz, ax, ay) => shade(jit(wpick(rockC), 0.06), 0.95 + clamp(ay, -0.4, 1) * 0.22 - k / K * 0.18));
  }
  const rootC = style.root;
  for (let r = 0; r < 42; r++) {
    const k = r < 12 ? K - ((WR() * 4) | 0) : 3 + ((WR() * (K - 6)) | 0), i = (WR() * N) | 0, p = ringPts[k][i], [nx, nz] = nrm[i];
    const L = r < 12 ? wr(1.8, 3.6) : wr(0.7, 2.0), pts = [new THREE.Vector3(p[0] - nx * 0.08, p[1], p[2] - nz * 0.08)];
    let x = p[0] + nx * 0.12, y = p[1] - 0.1, z = p[2] + nz * 0.12;
    for (let s = 1; s <= 4; s++) { x += nx * wr(0.0, 0.12) + wr(-0.18, 0.18); z += nz * wr(0.0, 0.12) + wr(-0.18, 0.18); y -= L / 4; pts.push(new THREE.Vector3(x, y, z)); }
    const rad = r < 12 ? wr(0.035, 0.07) : wr(0.02, 0.045);
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, rad, 5, false);
    B.addV(tg, new THREE.Matrix4(), () => jit(rootC, 0.1));
  }
}

/* Painted lawn: mottled turf, mowing stripes, gravel paths and patios,
   and soft shade under everything that stands on the grass. */
function lawnPainter(style, marks) {
  return () => {
    const { x0, x1, z0, z1 } = ISLAND, ppm = 28, W = Math.round((x1 - x0) * ppm), H = Math.round((z1 - z0) * ppm);
    return canvasTex(W, H, (x) => {
      const img = x.createImageData(W, H), d = img.data;
      const [g0, g1, g2] = style.lawn.map(c => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const wx = x0 + px / ppm, wz = z0 + py / ppm;
        const n = fbm(wx * 0.32, wz * 0.32, 2), f = vnoise(wx * 3.1, wz * 3.1, 4), stripe = (Math.floor((wx + 40) / 2.2) % 2) ? 1.03 : 0.98;
        const a = n < 0.5 ? g0 : g1, b = n < 0.5 ? g1 : g2, t = n < 0.5 ? n / 0.5 : (n - 0.5) / 0.5;
        const k = (0.88 + f * 0.16 + (hash2(px, py, 7) - 0.5) * 0.12 + (vnoise(wx * 9, wz * 9, 6) - 0.5) * 0.1) * stripe, o = (py * W + px) * 4;
        d[o] = (a[0] + (b[0] - a[0]) * t) * k; d[o + 1] = (a[1] + (b[1] - a[1]) * t) * k; d[o + 2] = (a[2] + (b[2] - a[2]) * t) * k; d[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      const X = wx => (wx - x0) * ppm, Z = wz => (wz - z0) * ppm;
      // paths and paving
      for (const p of marks.paths) {
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.strokeStyle = style.pathEdge; x.lineWidth = p.w * ppm + 6; x.beginPath(); p.pts.forEach(([a, b], i) => i ? x.lineTo(X(a), Z(b)) : x.moveTo(X(a), Z(b))); x.stroke();
        x.strokeStyle = style.path; x.lineWidth = p.w * ppm; x.stroke();
        for (let i = 0; i < p.w * 900; i++) { const s = p.pts[(WR() * (p.pts.length - 1)) | 0], e = p.pts[Math.min(p.pts.length - 1, p.pts.indexOf(s) + 1)], u = WR(); x.fillStyle = WR() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(60,40,20,.12)'; x.fillRect(X(lerp(s[0], e[0], u)) + (WR() - 0.5) * p.w * ppm * 0.8, Z(lerp(s[1], e[1], u)) + (WR() - 0.5) * p.w * ppm * 0.8, 2, 2); }
      }
      for (const r of marks.paving) {
        x.fillStyle = style.pathEdge; x.fillRect(X(r[0]) - 3, Z(r[1]) - 3, (r[2] - r[0]) * ppm + 6, (r[3] - r[1]) * ppm + 6);
        x.fillStyle = style.paving; x.fillRect(X(r[0]), Z(r[1]), (r[2] - r[0]) * ppm, (r[3] - r[1]) * ppm);
        x.strokeStyle = 'rgba(80,70,60,.25)'; x.lineWidth = 1;
        for (let a = r[0]; a < r[2]; a += 0.5) { x.beginPath(); x.moveTo(X(a), Z(r[1])); x.lineTo(X(a), Z(r[3])); x.stroke(); }
        for (let b = r[1]; b < r[3]; b += 0.5) { x.beginPath(); x.moveTo(X(r[0]), Z(b)); x.lineTo(X(r[2]), Z(b)); x.stroke(); }
      }
      // soft contact shade
      for (const [sx, sz, rx, rz, a] of marks.shade) {
        x.save(); x.translate(X(sx), Z(sz)); x.scale(1, rz / rx);
        const r = x.createRadialGradient(0, 0, 0, 0, 0, rx * ppm); r.addColorStop(0, `rgba(20,35,10,${a})`); r.addColorStop(1, 'rgba(20,35,10,0)');
        x.fillStyle = r; x.beginPath(); x.arc(0, 0, rx * ppm, 0, TAU); x.fill(); x.restore();
      }
      // a darker band of turf just inside the rim
      speckle(x, W, H, 9000, ['rgba(40,70,20,.10)', 'rgba(200,220,140,.08)'], 2);
    });
  };
}

/* Soft clouds drifting around and below the island. */
function buildClouds(root) {
  const tex = TEX.cloud(), clouds = [];
  const spots = [[-34, -6, -10, 16], [-26, -3, -38, 12], [24, -9, -28, 14], [-10, -12, 30, 18], [28, -14, 14, 15], [-40, -1, 18, 12], [4, -16, -6, 22], [16, -5, 34, 11], [-18, -15, -22, 16]];
  for (const [x, y, z, s] of spots) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.82, depthWrite: false, fog: false }));
    m.position.set(x, y, z); m.scale.set(s, s * 0.45, 1); m.userData.v = wr(0.2, 0.5); root.add(m); clouds.push(m);
  }
  return clouds;
}

/* Spectators: small figurines, each a few instanced smooth parts, so a
   crowd costs a handful of draw calls. They behave like a club crowd:
   heads follow the ball with a little lag (each at their own pace),
   applause ripples through the stand, only some stand up on big points,
   and a missed chance gets a lean forward. */
const CROWD_CLOTHES = [0xf3efe6, 0xf3efe6, 0xe6dccb, 0x2a3a55, 0x9db7cf, 0xc8b48a, 0xd9a7a0, 0x3f6b4f, 0x5b5f66, 0xf0d58a, 0x8a3b32, 0xb8c9b0, 0xe39a5a, 0x7da0c8];
class Crowd {
  constructor(scene, seats, accent) {
    const n = seats.length; this.n = n; this.seats = seats;
    const mat = new THREE.MeshLambertMaterial();
    const mk = (geo) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; };
    const cap = (r, l, sx = 1, sz = 1, rotX = 0) => { const g = new THREE.CapsuleGeometry(r, l, 3, 8); if (rotX) g.rotateX(rotX); g.scale(sx, 1, sz); return g; };
    this.torso = mk(cap(0.17, 0.14, 1.05, 0.72)); this.head = mk(new THREE.SphereGeometry(0.135, 12, 9));
    { const g = new THREE.SphereGeometry(0.142, 12, 8, 0, TAU, 0, Math.PI * 0.55); g.translate(0, -0.13, -0.01); this.hair = mk(g); }
    { const g = new THREE.CylinderGeometry(0.12, 0.23, 0.11, 14); g.translate(0, -0.1, 0); this.hat = mk(g); }
    this.glasses = mk(new THREE.BoxGeometry(0.2, 0.045, 0.02));
    this.armL = mk(cap(0.045, 0.29)); this.armR = mk(cap(0.045, 0.29));
    this.thigh = mk(cap(0.075, 0.26, 2.3, 1, Math.PI / 2)); this.shin = mk(cap(0.06, 0.3, 2.7, 1));
    this.meshes = [this.torso, this.head, this.hair, this.hat, this.glasses, this.armL, this.armR, this.thigh, this.shin];
    const skins = [0xf1c7a1, 0xe8b48c, 0xd29a6e, 0xa8714b, 0x7a4d32, 0x5a3825, 0xf6d6bd];
    const hairs = [0x2a1c12, 0x4a2e1c, 0x6b4428, 0xb08a52, 0x1a1512, 0x9a9a96, 0xd8d2c4];
    const legs = [0x2a3a55, 0xe6dccb, 0x5b5f66, 0xc8b48a, 0x3a3a3a, 0xf3efe6];
    this.state = [];
    for (let i = 0; i < n; i++) {
      const shirt = WR() < 0.12 ? accent : wpick(CROWD_CLOTHES), skin = wpick(skins);
      this.torso.setColorAt(i, _c.set(shirt));
      const sleeve = WR() < 0.55 ? skin : shirt;
      this.armL.setColorAt(i, _c.set(sleeve)); this.armR.setColorAt(i, _c.set(sleeve));
      this.head.setColorAt(i, _c.set(skin));
      this.hair.setColorAt(i, _c.set(wpick(hairs)));
      this.hat.setColorAt(i, _c.set(WR() < 0.6 ? 0xe3cf8f : 0xf3efe6));
      this.glasses.setColorAt(i, _c.set(0x1c1c1c));
      const lc = wpick(legs); this.thigh.setColorAt(i, _c.set(lc)); this.shin.setColorAt(i, _c.set(WR() < 0.4 ? skin : lc));
      this.state.push({
        yaw: seats[i].ry, k: wr(2.2, 5.5), ph: WR() * TAU, rate: wr(15, 21),
        hat: WR() < 0.22, glasses: WR() < 0.28, size: wr(0.92, 1.06),
        delay: 0, clap: 0, stand: seats[i].standing ? 1 : 0, standT: 0, up: 0, lean: 0, leanT: 0, look: 0, lookT: wr(2, 8)
      });
    }
    for (const m of this.meshes) { m.castShadow = true; m.receiveShadow = false; scene.add(m); }
    this.obj = new THREE.Object3D(); this.hide = new THREE.Matrix4().makeScale(0, 0, 0);
    this.update(0.016, null);
  }
  cheer(level = 1) {
    for (const s of this.state) {
      s.delay = wr(0.05, 0.5);
      if (Math.random() < 0.55 + level * 0.3) s.clap = level * (1.0 + Math.random() * 1.6);
      if (level > 0.85 && Math.random() < (level - 0.7) * 0.55) { s.standT = 1.2 + Math.random() * 1.4; s.up = Math.random() < 0.45 ? 1 : 0; }
    }
  }
  ooh() { for (const s of this.state) if (Math.random() < 0.6) { s.leanT = 0.7 + Math.random() * 0.5; s.delay = Math.random() * 0.15; } }
  set(m, i, x, y, z, rx, ry, sc) { const o = this.obj; o.position.set(x, y, z); o.rotation.set(rx, ry, 0, 'YXZ'); o.scale.setScalar(sc); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
  update(dt, ball) {
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i], seat = this.seats[i], ry = seat.ry, S = st.size;
      const fx = Math.sin(ry), fz = Math.cos(ry), rxv = Math.cos(ry), rzv = -Math.sin(ry);
      st.ph += dt;
      if (st.delay > 0) st.delay -= dt;
      const active = st.delay <= 0;
      if (active) { st.clap = Math.max(0, st.clap - dt); st.standT = Math.max(0, st.standT - dt); st.leanT = Math.max(0, st.leanT - dt); }
      let want = ry;
      if (ball) want = Math.atan2(ball.x - seat.x, ball.z - seat.z);
      else { st.lookT -= dt; if (st.lookT < 0) { st.look = Math.random() < 0.5 ? (Math.random() < 0.5 ? 0.8 : -0.8) : 0; st.lookT = wr(1.5, 5); } want = ry + st.look; }
      st.yaw = dampAngle(st.yaw, ry + clamp(angDiff(ry, want), -1.0, 1.0), st.k, dt);
      const standGoal = seat.standing || (active && st.standT > 0) ? 1 : 0;
      st.stand = damp(st.stand, standGoal, 6, dt);
      st.lean = damp(st.lean, active && st.leanT > 0 ? 1 : 0, 7, dt);
      const sd = st.stand, hipY = seat.y + 0.07 + sd * 0.72, back = sd * 0.25;
      const hx = seat.x - fx * back + fx * st.lean * 0.08, hz = seat.z - fz * back + fz * st.lean * 0.08;
      const th = sd * Math.PI / 2;
      this.set(this.thigh, i, hx + fx * 0.19 * Math.cos(th), hipY - 0.19 * Math.sin(th), hz + fz * 0.19 * Math.cos(th), th, ry, S);
      const kx = hx + fx * 0.38 * Math.cos(th), ky = hipY - 0.38 * Math.sin(th), kz = hz + fz * 0.38 * Math.cos(th);
      this.set(this.shin, i, kx, ky - 0.22, kz, 0, ry, S);
      const lean = st.lean * 0.35;
      const tY = hipY + 0.27 * S, tx = hx + fx * lean * 0.15, tz = hz + fz * lean * 0.15;
      this.set(this.torso, i, tx, tY, tz, lean, ry + angDiff(ry, st.yaw) * 0.2, S);
      const hY = tY + 0.38 * S, hxx = tx + fx * lean * 0.2, hzz = tz + fz * lean * 0.2;
      this.set(this.head, i, hxx, hY, hzz, lean * 0.5, st.yaw, S);
      if (st.hat) { this.set(this.hat, i, hxx, hY + 0.2 * S, hzz, 0, st.yaw, S); this.hair.setMatrixAt(i, this.hide); }
      else { this.set(this.hair, i, hxx, hY + 0.16 * S, hzz, 0, st.yaw, S); this.hat.setMatrixAt(i, this.hide); }
      if (st.glasses) this.set(this.glasses, i, hxx + Math.sin(st.yaw) * 0.13 * S, hY + 0.02, hzz + Math.cos(st.yaw) * 0.13 * S, 0, st.yaw, S);
      else this.glasses.setMatrixAt(i, this.hide);
      const clapping = active && st.clap > 0, up = sd > 0.6 && st.up;
      for (const [m, sg] of [[this.armL, 1], [this.armR, -1]]) {
        let a = 0.15, spread = 0.22;
        if (up) { a = -2.9; spread = 0.22; }
        else if (clapping) { a = -1.15; spread = 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(st.ph * st.rate)); }
        const shX = tx + rxv * spread * sg * S, shY = tY + 0.17 * S, shZ = tz + rzv * spread * sg * S;
        const dy = -0.17 * Math.cos(a), df = -0.17 * Math.sin(a);
        this.set(m, i, shX + fx * df, shY + dy, shZ + fz * df, a, ry, S);
      }
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
  dispose(scene) { for (const m of this.meshes) { scene.remove(m); m.geometry.dispose(); m.dispose(); } }
}

/* ---------------- Club variants ----------------
   Shared layout: wooden bleachers on the far long side (-x), the
   clubhouse behind the far baseline (-z), tall trees along the far
   edges, and only low planting on the camera sides so nothing hides the
   players. Each club adds its own planting and colours. */
function clubLayout(B, F, G, ctx, o) {
  const RX = COURT.RX, RZ = COURT.RZ, M = ctx.marks;
  const seats = pBleachers(B, -RX - 0.95, -6.2, 6.2, 4, Object.assign({}, o.stand, { fill: o.stand.fill * 0.62 }));
  M.shade.push([-12.0, 0, 2.6, 7.4, 0.32]);
  M.paving.push([-13.9, -6.9, -9.55, 6.9]);
  const house = pClubhouse(B, G, 3.4, -22.1, o.house);
  M.shade.push([3.4, -22.1, 4.6, 2.8, 0.38]);
  M.paving.push([-1.2, -20.1, 8.0, -18.25]);
  // gravel path from the terrace round the near side of the court
  M.paths.push({ w: 1.25, pts: [[7.6, -19.2], [10.6, -17.8], [10.9, -14], [10.9, 14], [10.3, 17.3], [6, 18.95], [-6, 18.95], [-10.5, 18.3]] });
  M.paths.push({ w: 1.0, pts: [[-1.0, -19.2], [-8.6, -19.2], [-10.4, -17.0], [-10.4, -7.2]] });
  for (const z of [-15.6, 15.6]) ctx.lamps.push(pLamp(B, G, 11.8, z));
  ctx.lamps.push(pLamp(B, G, -11.2, -17.4));
  pBench(B, 11.9, -6, -Math.PI / 2, o.wood); pBench(B, 11.9, 6, -Math.PI / 2, o.wood);
  // scoreboard on two posts behind the far baseline
  for (const x of [-6.6, -3.4]) B.addV(GEO.box, mtx(x, 1.6, -19.0, 0.12, 3.2, 0.12), () => 0x3b3026);
  B.addV(GEO.box, mtx(-5.0, 3.15, -19.06, 3.5, 1.45, 0.12), () => 0x3b3026);
  M.shade.push([-5, -19, 2.2, 0.6, 0.18]);
  return { seats: seats.concat(house), house };
}
function clubRiviera(B, F, G, ctx) {
  const L = clubLayout(B, F, G, ctx, { stand: { seat: 0x9c7650, frame: 0x6e4f33, fill: 0.86 }, wood: 0x8a5a2e,
    house: { w: 7.4, d: 3.8, wall: 0xd9c9a8, trim: 0xf1eadb, base: 0xb9ab95, roof: 0x7d8a7a, door: 0x2f5b40, awning: [0xf4f0e6, 0x2f6b4a], chimney: true, benchWood: 0x8a5a2e } });
  const cyp = [0x3d6a34, 0x9cbf6a];
  const M = ctx.marks;
  const tree = (x, z, h) => { pCypress(B, x, z, h, cyp); M.shade.push([x + 0.5, z + 0.2, 1.3, 1.0, 0.36]); };
  const leaf = [0x5a9040, 0x6aa048, 0x4f8238];
  const bush = (x, z, r, fl) => { pBush(B, x, z, r, leaf, fl); M.shade.push([x + 0.2, z + 0.1, r * 1.3, r * 1.1, 0.3]); };
  const grove = (x, z, n, h) => { for (let k = 0; k < n; k++) tree(x + wr(-0.9, 0.9), z + (k - (n - 1) / 2) * 1.5 + wr(-0.3, 0.3), h * wr(0.82, 1.12)); bush(x + 0.9, z + wr(-1, 1), wr(0.6, 0.85)); bush(x - 0.4, z + n * 0.8, wr(0.5, 0.75)); };
  grove(-14.6, -17.0, 3, 5.2); grove(-14.4, 0, 2, 5.6); grove(-14.6, 15.5, 3, 5.0);
  grove(-10.4, -22.9, 2, 5.0); grove(10.0, -22.6, 2, 5.4);
  bush(-13.4, -20.6, 1.0); bush(-13.9, 18.6, 1.1, [0xf2a6b5, 0xffffff]); bush(11.4, 18.2, 0.9); bush(9.6, 19.3, 0.7, [0xf6f0e2]); bush(11.5, -19.6, 0.8); bush(-12.8, 8.6, 0.8); bush(-12.9, -8.8, 0.85);
  bush(-1.6, 20.0, 0.6); bush(2.4, 20.2, 0.55, [0xb59ad8]); bush(-8.4, 20.0, 0.7);
  const lav = [0x9a7cc8, 0xb59ad8, 0x8a6ab8];
  for (const z of [-11.5, -2, 8.5]) pFlowerBed(B, 11.95, z, 0.8, 3.2, lav);
  return { seats: L.seats, accent: 0x2f6b4a };
}
function clubHollyhock(B, F, G, ctx) {
  const L = clubLayout(B, F, G, ctx, { stand: { seat: 0xe9e4d8, frame: 0x2f5f2a, fill: 0.88 }, wood: 0x2f5f2a,
    house: { w: 7.4, d: 3.8, wall: 0xf4f1e8, trim: 0x2f5f2a, base: 0xc9c2b2, roof: 0x3b4a3f, door: 0x5b2a7a, awning: [0xf4f1e8, 0x5b2a7a], benchWood: 0x2f5f2a } });
  const M = ctx.marks, greens = [[0x3f7a33, 0x4a8a3a, 0x356b2c], [0x4a8a3a, 0x569a42, 0x3f7a33]];
  const tree = (x, z, s) => { pRoundTree(B, x, z, s, greens[(WR() * 2) | 0]); M.shade.push([x + 0.6, z + 0.3, 2.3 * s, 2.0 * s, 0.36]); };
  for (const z of [-17, -9.5, 9.5, 17]) tree(-15.4 + wr(-0.3, 0.3), z, wr(0.95, 1.15));
  for (const x of [-12, -4]) tree(x, -23.4, wr(0.95, 1.1));
  tree(10.2, -22.6, 1.0);
  pHedge(B, -15.8, -4.8, -15.8, 4.8, 1.0, 0x2f5f2a); M.shade.push([-15.6, 0, 1.0, 5.4, 0.28]);
  const roses = [0xd8394a, 0xf2a6b5, 0xf7f4ec];
  const leaf = [0x3f7a33, 0x4a8a3a, 0x356b2c];
  for (const [x, z, r] of [[12.3, 18.5, 0.9], [-14.6, 19.0, 1.0], [12.4, -19.8, 0.8], [-13.4, -20.8, 0.9], [-1.5, 20.1, 0.55], [3, 20.2, 0.55]]) { pBush(B, x, z, r, leaf, roses); M.shade.push([x + 0.2, z, r * 1.3, r * 1.1, 0.3]); }
  for (const z of [-11.5, -2, 8.5]) pFlowerBed(B, 11.95, z, 0.8, 3.2, roses);
  return { seats: L.seats, accent: 0x5b2a7a };
}
function clubHarbour(B, F, G, ctx) {
  const L = clubLayout(B, F, G, ctx, { stand: { seat: 0xd9d6cf, frame: 0x2a5f97, fill: 0.82 }, wood: 0xb48a5c,
    house: { w: 7.4, d: 3.8, wall: 0xf2f1ec, trim: 0x2a5f97, base: 0xd9d6cf, roof: 0xb6b1a6, door: 0x2a5f97, awning: [0xf2f1ec, 0xf2b84b], benchWood: 0xb48a5c } });
  const M = ctx.marks;
  const palm = (x, z, h) => { pPalm(B, F, x, z, h); M.shade.push([x + 0.6, z + 0.3, 1.8, 1.5, 0.3]); };
  for (const z of [-17, -10.5, 10.5, 17]) palm(-15.3 + wr(-0.3, 0.3), z, wr(4.0, 5.2));
  for (const x of [-12.5, -3.5]) palm(x, -23.2, wr(4.2, 5.0));
  palm(10.4, -22.4, 4.8);
  const leaf = [0x4f9440, 0x5ea64b, 0x447f37];
  for (const [x, z, r] of [[-14.6, 19.0, 0.9], [12.4, -19.8, 0.8], [-13.4, -20.8, 0.9], [-1.5, 20.1, 0.55], [3, 20.2, 0.55]]) { pBush(B, x, z, r, leaf, [0xf2b84b, 0xffffff]); M.shade.push([x + 0.2, z, r * 1.3, r * 1.1, 0.3]); }
  // sandy corner
  M.paving.push([8.4, 15.4, 12.8, 20.0]);
  for (const z of [-11.5, -2, 8.5]) { B.addV(GEO.cyl8, mtx(11.95, 0.25, z, 0.45, 0.5, 0.45), () => 0xd9d6cf); pBush(B, 11.95, z, 0.5, leaf); }
  return { seats: L.seats, accent: 0x2a5f97 };
}

const CLUB_STYLES = {
  clay: {
    build: clubRiviera, seed: 1931, lawn: [0x6a8f47, 0x76994e, 0x5f8441], fringe: 0x68924a, topsoil: 0x4a3322, root: 0x4a3020, rock: [0x8a8276, 0x7a7064, 0x9a9282, 0x6e655a],
    strata: [0x6b4530, 0x7a5038, 0x6a5040, 0x5c4636, 0x544236, 0x4a3b30, 0x40342c],
    path: '#c9b89a', pathEdge: '#a8987c', paving: '#cfc6b6',
    curb: 0x2a4d36, line: 0xfbf7ee, fenceH: 3.0, post: 0x1f3a2a, wood: 0x6e4a2b, parasol: 0x2f6b4a
  },
  grass: {
    build: clubHollyhock, seed: 1877, lawn: [0x5d8a43, 0x67944a, 0x53803c], fringe: 0x5e8c45, topsoil: 0x3e2c20, root: 0x46301f, rock: [0x8f8a80, 0x7a756c, 0x9c978c, 0x6a665e],
    strata: [0x5e4230, 0x6c4c36, 0x5c4838, 0x524236, 0x4a3c32, 0x42362e, 0x3a302a],
    path: '#c8bfa8', pathEdge: '#a39a84', paving: '#d6d0c2',
    curb: 0x234a2c, line: 0xffffff, fenceH: 2.8, post: 0x1f3a24, wood: 0x2f5f2a, parasol: 0x5b2a7a
  },
  hard: {
    build: clubHarbour, seed: 1962, lawn: [0x6c9750, 0x78a259, 0x618b4a], fringe: 0x6b9852, topsoil: 0x6a5a40, root: 0x5a4430, rock: [0xa8a092, 0x968e80, 0xb8b0a2, 0x8a8274],
    strata: [0xbfa883, 0xae9670, 0x9e8a6a, 0x8f7e64, 0x80725c, 0x6f6450, 0x5e5646],
    path: '#e2d4b0', pathEdge: '#c4b490', paving: '#e8dcbc',
    curb: 0x1d4e7d, line: 0xffffff, fenceH: 3.0, post: 0x23405e, wood: 0x8d959c, parasol: 0xf2b84b
  }
};

/* Build a full club. Returns handles for animation and time of day. */
function buildClub(scene, courtId) {
  const style = CLUB_STYLES[courtId];
  WR = mulberry32(style.seed);
  style.courtTex = courtId === 'clay' ? TEX.clay() : courtId === 'grass' ? TEX.grassCourt() : TEX.hardCourt();
  const root = new THREE.Group(); scene.add(root);
  const B = new Builder(), F = new Builder(), G = new Builder();
  const ctx = { lamps: [], marks: { paths: [], paving: [], shade: [] } };
  const core = new THREE.Group(); root.add(core);
  buildCourtCore(core, B, G, style);
  ctx.marks.shade.push([0, 0, COURT.RX + 0.6, COURT.RZ + 0.6, 0.12]);
  const extra = style.build(B, F, G, ctx);
  const isl = buildIsland(root, style, lawnPainter(style, ctx.marks));
  buildCliffDetail(B, isl, style);
  const lights = [], halos = [];
  const FL = new Builder(); buildFloodlights(FL, G, root, lights, halos);
  const flood = FL.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); root.add(flood);
  for (const l of ctx.lamps) halos.push({ x: l.x, y: l.y, z: l.z, s: 1.6 });

  // in-world scoreboard face
  const sbCanvas = document.createElement('canvas'); sbCanvas.width = 512; sbCanvas.height = 192;
  const sbTex = new THREE.CanvasTexture(sbCanvas); sbTex.colorSpace = THREE.SRGBColorSpace;
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: sbTex, toneMapped: false }));
  sb.position.set(-5.0, 3.15, -18.99); root.add(sb);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  root.add(B.mesh(mat));
  if (F.pos.length) { const fm = F.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); root.add(fm); }
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const glowMesh = G.mesh(glowMat, false); root.add(glowMesh);

  const haloMat = new THREE.SpriteMaterial({ map: TEX.glow(), color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  for (const h of halos) { const s = new THREE.Sprite(haloMat); s.position.set(h.x, h.y, h.z); s.scale.setScalar(h.s); root.add(s); }

  const crowd = new Crowd(root, extra.seats, extra.accent);
  const clouds = buildClouds(root);
  return {
    id: courtId, root, crowd, lights, flood, glowMat, glowMesh, haloMat, sb, sbCanvas, sbTex, style, clouds,
    update(dt, t, ball) {
      crowd.update(dt, ball);
      for (const c of clouds) { c.position.x += dt * c.userData.v; if (c.position.x > 62) c.position.x = -62; }
    },
    dispose() {
      crowd.dispose(root);
      root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      scene.remove(root);
    }
  };
}

/* Draw the in-world scoreboard. */
function drawWorldBoard(club, names, sets, games, points, server) {
  const c = club.sbCanvas, x = c.getContext('2d');
  x.fillStyle = '#14261c'; x.fillRect(0, 0, 512, 192);
  x.strokeStyle = '#6e5a40'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 184);
  x.font = '600 18px ui-monospace,Menlo,monospace'; x.fillStyle = '#86b394'; x.textAlign = 'left';
  x.fillText(COURTS[club.id].board, 22, 36);
  for (let i = 0; i < 2; i++) {
    const y = 88 + i * 62;
    x.fillStyle = server === i ? '#d9f03b' : '#24503a'; x.beginPath(); x.arc(30, y - 9, 7, 0, TAU); x.fill();
    x.fillStyle = '#f4efe4'; x.font = '700 34px ui-monospace,Menlo,monospace'; x.fillText(names[i], 48, y);
    x.fillStyle = '#9cc3a8'; x.textAlign = 'right'; x.fillText(sets[i].join(' '), 360, y);
    x.fillStyle = '#ffffff'; x.fillText(String(games[i]), 410, y);
    x.fillStyle = '#ffd84d'; x.fillText(points[i], 492, y); x.textAlign = 'left';
  }
  club.sbTex.needsUpdate = true;
}
