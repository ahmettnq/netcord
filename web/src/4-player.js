/* =====================================================================
   PLAYERS: a low-poly articulated rig with keyframed strokes (forehand,
   two-handed backhand, serve, volleys, smash) blended over a procedural
   locomotion layer (split step, run, side shuffle, crossover). Strokes
   are split into a held "prep" pose and a timed "strike" so the contact
   frame lands exactly when the physics says the ball arrives.
   Rig faces +z in local space; the racket arm is local -x (right hand).
   Left-handers are a mirrored rig.
   ===================================================================== */
const CH = ['hipY', 'hipRx', 'torRx', 'torRy', 'torRz', 'headRx', 'headRy',
  'shRx', 'shRy', 'shRz', 'elR', 'wrRx', 'wrRz',
  'shLx', 'shLy', 'shLz', 'elL',
  'thRx', 'thRz', 'knR', 'thLx', 'thLz', 'knL', 'rootRy'];
const CI = {}; CH.forEach((n, i) => (CI[n] = i));
const NCH = CH.length;
const READY = {
  hipY: -0.09, hipRx: 0, torRx: 0.24, torRy: 0, torRz: 0, headRx: -0.12, headRy: 0,
  shRx: -0.55, shRy: 0.1, shRz: -0.18, elR: -1.15, wrRx: 0.15, wrRz: 0,
  shLx: -0.62, shLy: -0.1, shLz: 0.3, elL: -1.25,
  thRx: -0.38, thRz: -0.13, knR: 0.66, thLx: -0.38, thLz: 0.13, knL: 0.66, rootRy: 0
};
function P(over) { const a = new Float32Array(NCH); for (let i = 0; i < NCH; i++) a[i] = READY[CH[i]]; if (over) for (const k in over) a[CI[k]] = over[k]; return a; }
const POSE_READY = P();
const POSE_STAND = P({ hipY: -0.01, torRx: 0.04, shRx: -0.15, shRz: -0.12, elR: -0.35, shLx: -0.05, shLz: 0.1, elL: -0.2, thRx: -0.05, knR: 0.08, thLx: -0.05, knL: 0.08, headRx: 0 });

const STROKES = {
  fh: {
    prep: P({ torRy: -1.15, shRx: 0.15, shRy: 0.25, shRz: -1.15, elR: -0.6, wrRx: -0.45, shLx: -1.25, shLz: 0.45, elL: -0.2, headRy: 0.9, hipY: -0.12, thRx: -0.45, knR: 0.85, rootRy: -0.2 }),
    keys: [
      [0.00, P({ torRy: -1.2, shRx: 0.2, shRy: 0.3, shRz: -1.2, elR: -0.5, wrRx: -0.3, shLx: -1.25, shLz: 0.45, elL: -0.2, headRy: 0.9, hipY: -0.12, thRx: -0.45, knR: 0.85, rootRy: -0.2 })],
      [0.11, P({ torRy: -0.05, shRx: -0.95, shRy: 0, shRz: -1.25, elR: -0.15, wrRx: -0.15, shLx: -0.9, shLz: 0.9, elL: -0.6, headRy: 0.5, hipY: -0.1, rootRy: -0.05 })],
      [0.28, P({ torRy: 0.75, shRx: -2.45, shRy: 0, shRz: -0.35, elR: -1.5, wrRx: -0.3, shLx: -0.5, shLz: 0.7, elL: -1.2, headRy: 0.1, hipY: -0.06 })],
      [0.55, POSE_READY]
    ]
  },
  bh: {
    prep: P({ torRy: 1.2, shRx: -0.45, shRz: 0.95, elR: -0.55, wrRx: 0.4, shLx: -0.3, shLz: 0.95, elL: -0.75, headRy: -0.9, hipY: -0.12, thLx: -0.45, knL: 0.85, rootRy: 0.2 }),
    keys: [
      [0.00, P({ torRy: 1.25, shRx: -0.4, shRz: 1.0, elR: -0.5, wrRx: 0.45, shLx: -0.25, shLz: 1.0, elL: -0.7, headRy: -0.9, hipY: -0.12, thLx: -0.45, knL: 0.85, rootRy: 0.2 })],
      [0.11, P({ torRy: 0.9, shRx: -1.3, shRz: -0.4, elR: -0.25, wrRx: -0.1, shLx: -1.0, shLz: 0.55, elL: -0.55, headRy: -0.6, hipY: -0.1 })],
      [0.28, P({ torRy: -0.75, shRx: -2.5, shRz: 0.3, elR: -1.3, wrRx: -0.2, shLx: -2.35, shLz: -0.15, elL: -1.45, headRy: -0.1, hipY: -0.06 })],
      [0.55, POSE_READY]
    ]
  },
  vf: {
    prep: P({ torRy: -0.45, shRx: -0.75, shRz: -0.95, elR: -0.85, wrRx: 0.3, shLx: -0.9, shLz: 0.4, elL: -0.6, hipY: -0.14, thRx: -0.5, knR: 0.9 }),
    keys: [
      [0.00, P({ torRy: -0.5, shRx: -0.75, shRz: -1.0, elR: -0.85, wrRx: 0.35, shLx: -0.9, shLz: 0.4, elL: -0.6, hipY: -0.14 })],
      [0.07, P({ torRy: -0.15, shRx: -1.15, shRz: -0.8, elR: -0.5, wrRx: 0.1, shLx: -0.7, shLz: 0.6, elL: -0.7, hipY: -0.14 })],
      [0.2, P({ torRy: 0.05, shRx: -1.25, shRz: -0.6, elR: -0.6, wrRx: 0.05, hipY: -0.12 })],
      [0.45, POSE_READY]
    ]
  },
  vb: {
    prep: P({ torRy: 0.55, shRx: -0.8, shRz: 0.7, elR: -1.1, wrRx: 0.35, shLx: -0.9, shLz: 0.6, elL: -1.2, hipY: -0.14, thLx: -0.5, knL: 0.9 }),
    keys: [
      [0.00, P({ torRy: 0.6, shRx: -0.8, shRz: 0.75, elR: -1.1, wrRx: 0.4, shLx: -0.9, shLz: 0.6, elL: -1.2, hipY: -0.14 })],
      [0.07, P({ torRy: 0.6, shRx: -1.15, shRz: 0.5, elR: -0.55, wrRx: 0.1, shLx: -0.5, shLz: -0.1, elL: -0.5, hipY: -0.14 })],
      [0.2, P({ torRy: 0.0, shRx: -1.3, shRz: 0.3, elR: -0.6, wrRx: 0.05, shLx: -0.4, shLz: -0.3, hipY: -0.12 })],
      [0.45, POSE_READY]
    ]
  },
  serve: {
    prep: P({ torRx: -0.3, torRy: -0.75, torRz: 0.12, shRx: -0.35, shRz: -1.45, elR: -1.85, wrRx: 0.5, shLx: -2.95, shLz: 0.15, elL: -0.05, headRx: -0.45, hipY: -0.17, thRx: -0.15, knR: 0.75, thLx: -0.5, knL: 0.8, rootRy: -0.45 }),
    keys: [
      [0.00, P({ torRx: -0.35, torRy: -0.8, torRz: 0.12, shRx: -0.25, shRz: -1.5, elR: -2.05, wrRx: 0.6, shLx: -2.9, shLz: 0.15, elL: -0.05, headRx: -0.5, hipY: -0.18, thRx: -0.15, knR: 0.8, thLx: -0.5, knL: 0.85, rootRy: -0.45 })],
      [0.1, P({ torRx: 0.1, torRy: 0.05, shRx: -3.05, shRz: -0.25, elR: -0.05, wrRx: -0.2, shLx: -1.2, shLz: 0.5, elL: -0.4, headRx: -0.55, hipY: 0.06, thRx: 0.05, knR: 0.05, thLx: 0.05, knL: 0.05, rootRy: -0.2 })],
      [0.3, P({ torRx: 0.55, torRy: 0.8, shRx: -0.45, shRz: 0.65, elR: -0.5, wrRx: -0.3, shLx: -0.2, shLz: 0.2, elL: -0.6, headRx: 0.1, hipY: -0.1, thRx: -0.75, knR: 0.6, thLx: 0.2, knL: 0.4, rootRy: 0 })],
      [0.62, POSE_READY]
    ]
  },
  whiff: {
    prep: null,
    keys: [[0, POSE_READY], [0.1, P({ torRy: 0.6, shRx: -1.8, shRz: -0.6, elR: -1.0 })], [0.35, POSE_READY]]
  }
};
for (const k of ['fh', 'bh']) STROKES[k].contact = 0.11;
for (const k of ['vf', 'vb']) STROKES[k].contact = 0.07;
STROKES.serve.contact = 0.1; STROKES.whiff.contact = 0.1;
STROKES.smash = { contact: 0.1, prep: P({ torRx: -0.25, torRy: -0.85, shRx: -0.3, shRz: -1.45, elR: -1.9, wrRx: 0.5, shLx: -2.8, shLz: 0.2, elL: -0.1, headRx: -0.5, hipY: -0.12, rootRy: -0.5 }), keys: STROKES.serve.keys };

const CELEBRATE = [P({ torRx: -0.1, shLx: -0.4, shLz: 0.1, elL: -2.2, shRx: -2.8, shRz: -0.3, elR: -0.2, hipY: -0.02, thRx: 0, knR: 0.1, thLx: 0, knL: 0.1, headRx: -0.3 }),
  P({ torRx: 0.35, shLx: -0.8, shLz: 0.2, elL: -2.4, shRx: -0.3, shRz: -0.2, elR: -0.3, hipY: -0.2, thRx: -0.6, knR: 1.1, thLx: -0.2, knL: 0.6, headRx: 0.1 })];
const DEJECT = P({ torRx: 0.45, headRx: 0.65, shRx: 0.05, shRz: -0.1, elR: -0.1, shLx: 0.05, shLz: 0.1, elL: -0.1, hipY: -0.02, thRx: 0, knR: 0.08, thLx: 0, knL: 0.08 });

/* One-shot reactions after a point, played once and then settling into a
   relaxed stand. Built on the same channels as the strokes. */
const STAND = POSE_STAND;
const MOODS = {
  // small fist pump with the free hand
  pump: [[0, STAND],
    [0.14, P({ hipY: -0.02, torRx: 0.0, shLx: -1.5, shLz: 0.25, elL: -2.1, shRx: -0.25, shRz: -0.15, elR: -0.4, headRx: -0.05 })],
    [0.32, P({ hipY: -0.12, torRx: 0.28, shLx: -0.55, shLz: 0.2, elL: -2.45, shRx: -0.2, shRz: -0.15, elR: -0.4, headRx: 0.25, thRx: -0.35, knR: 0.6, thLx: -0.35, knL: 0.6 })],
    [0.46, P({ hipY: -0.08, torRx: 0.18, shLx: -1.1, shLz: 0.2, elL: -2.3, shRx: -0.2, elR: -0.4, headRx: 0.1, thRx: -0.2, knR: 0.35, thLx: -0.2, knL: 0.35 })],
    [0.62, P({ hipY: -0.12, torRx: 0.3, shLx: -0.5, shLz: 0.2, elL: -2.45, shRx: -0.2, elR: -0.4, headRx: 0.3, thRx: -0.35, knR: 0.6, thLx: -0.35, knL: 0.6 })],
    [1.3, STAND]],
  // racket and free arm up after a big point
  raise: [[0, STAND],
    [0.2, P({ hipY: 0.02, torRx: -0.15, shRx: -3.0, shRz: -0.35, elR: -0.15, shLx: -2.9, shLz: 0.35, elL: -0.25, headRx: -0.35, thRx: 0, knR: 0.05, thLx: 0, knL: 0.05 })],
    [1.1, P({ hipY: 0.0, torRx: -0.12, shRx: -2.85, shRz: -0.4, elR: -0.3, shLx: -2.75, shLz: 0.4, elL: -0.4, headRx: -0.3, thRx: 0, knR: 0.08, thLx: 0, knL: 0.08 })],
    [1.7, STAND]],
  // head drops, shoulders slump, a small shake of the head
  slump: [[0, STAND],
    [0.35, P({ hipY: -0.03, torRx: 0.42, headRx: 0.6, headRy: 0.25, shRx: 0.05, shRz: -0.08, elR: -0.15, shLx: 0.05, shLz: 0.1, elL: -0.1, thRx: 0, knR: 0.1, thLx: 0, knL: 0.1 })],
    [0.6, P({ hipY: -0.03, torRx: 0.42, headRx: 0.6, headRy: -0.25, shRx: 0.05, shRz: -0.08, elR: -0.15, shLx: 0.05, shLz: 0.1, elL: -0.1, thRx: 0, knR: 0.1, thLx: 0, knL: 0.1 })],
    [0.85, P({ hipY: -0.03, torRx: 0.4, headRx: 0.55, headRy: 0.15, shRx: 0.05, elR: -0.15, shLx: 0.05, elL: -0.1, knR: 0.1, knL: 0.1 })],
    [1.8, P({ hipY: -0.02, torRx: 0.2, headRx: 0.3, shRx: 0, elR: -0.2, shLx: 0, elL: -0.15, knR: 0.08, knL: 0.08 })]],
  // racket slapped down in frustration, then hands drop
  frustrate: [[0, STAND],
    [0.16, P({ hipY: -0.02, torRx: 0.05, shRx: -1.7, shRz: -0.2, elR: -0.9, headRx: -0.1 })],
    [0.3, P({ hipY: -0.06, torRx: 0.35, shRx: 0.35, shRz: -0.1, elR: -0.2, headRx: 0.45 })],
    [1.6, P({ hipY: -0.03, torRx: 0.25, shRx: 0.1, elR: -0.2, shLx: 0, elL: -0.2, headRx: 0.4 })]]
};

/* Where the strings sit at the contact frame of each stroke, in the
   player's own frame (lat = out to the side, fwd = in front, y = height).
   The match reads these, so the timing plane and the stance always match
   the animation, whatever the rig looks like. */
let _rig = null;
function rigSpots() {
  if (_rig) return _rig;
  const ch = new Character({ shirt: 0xffffff, shorts: 0, skin: 0xffffff, hair: 0, cap: null, lefty: false });
  const pose = new Float32Array(NCH), H = new THREE.Vector3(), out = {};
  for (const k of ['fh', 'bh', 'vf', 'vb']) {
    ch.probeHead(ch.contactPose(k, 1, null, pose), 0, 0, 0, 0, H);
    out[k] = { lat: Math.abs(H.x), fwd: H.z, y: H.y };
  }
  out.ahead = (out.fh.fwd + out.bh.fwd) / 2;
  out.lat = (out.fh.lat + out.bh.lat) / 2;
  return (_rig = out);
}

const _matCache = new Map();
let _toonGrad = null;
function tmat(c) {
  c = c | 0; const key = 't' + c;
  if (!_matCache.has(key)) {
    if (!_toonGrad) { const d = new Uint8Array([90, 170, 235, 255]); _toonGrad = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); _toonGrad.minFilter = _toonGrad.magFilter = THREE.NearestFilter; _toonGrad.needsUpdate = true; }
    _matCache.set(key, new THREE.MeshToonMaterial({ color: c, gradientMap: _toonGrad }));
  }
  return _matCache.get(key);
}
const lathe = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
Object.assign(GEO, {
  // tapered limb, 1 unit long hanging down from y=0, radius 0.1 at the top
  limb: lathe([[0, 0.04], [0.07, 0.02], [0.1, -0.08], [0.095, -0.4], [0.08, -0.8], [0.07, -0.96], [0, -1.02]], 12),
  shorts: lathe([[0, 0.12], [0.17, 0.1], [0.22, 0.02], [0.235, -0.08], [0.25, -0.16], [0, -0.16]], 18),
  torsoToy: lathe([[0, -0.08], [0.22, -0.06], [0.27, 0.06], [0.3, 0.22], [0.3, 0.4], [0.26, 0.52], [0.13, 0.58], [0, 0.585]], 20),
  torsoAth: lathe([[0, -0.08], [0.19, -0.06], [0.205, 0.08], [0.25, 0.28], [0.29, 0.44], [0.27, 0.53], [0.13, 0.58], [0, 0.585]], 20),
  band: new THREE.CylinderGeometry(0.3, 0.3, 1, 20, 1, true)
});
function lmat(c) { c = c | 0; if (!_matCache.has(c)) _matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return _matCache.get(c); }
function shadeHex(c, k) { return (Math.min(255, ((c >> 16) & 255) * k) << 16) | (Math.min(255, ((c >> 8) & 255) * k) << 8) | Math.min(255, (c & 255) * k); }
function part(geo, color, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, lmat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m;
}

class Character {
  constructor(look) {
    this.look = look;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.maxSpeed = 6; this.accel = 26; this.decel = 34;
    this.pose = new Float32Array(POSE_READY); this.target = new Float32Array(NCH);
    this.runPh = 0; this.stepCount = 0;
    this.act = null;             // {clip, t, prep:boolean, w}
    this.mood = null; this.moodT = 0;
    this.split = 0;
    this.lefty = !!look.lefty;
    this.build();
  }
  /* A small painted figurine: rounded limbs, a smooth head with a cap or
     hair, a polo shirt and shorts, socks and shoes, and a racket with a
     real oval frame. Joint layout matches the stroke animations. */
  build() {
    const L = this.look, style = (typeof window !== 'undefined' && window.CHAR_STYLE) || 'toy';
    const toy = style === 'toy';
    const S = GEO.sph, C = GEO.cap, Y = GEO.cyl8;
    const M = c => tmat(c), pt = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
    const skinD = shadeHex(L.skin, 0.86), trim = L.trim || 0xf4efe4, shoe = L.shoe || 0xf6f4ef, hairC = L.hair;
    const root = this.root = new THREE.Group(); root.scale.setScalar(1.28);
    const body = this.body = new THREE.Group(); root.add(body);
    if (this.lefty) body.scale.x = -1;
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
    // shorts: a flared tube over the hips
    hips.add(pt(GEO.shorts, L.shorts, 0, -0.07, 0, toy ? 1.08 : 0.94, 1, toy ? 0.9 : 0.8));
    const soles = [];
    const leg = (side) => {
      const th = new THREE.Group(); th.position.set(side * 0.11, -0.12, 0); hips.add(th);
      th.add(pt(Y, L.shorts, 0, -0.07, 0, toy ? 0.125 : 0.11, 0.16, toy ? 0.125 : 0.11));      // short leg opening
      th.add(pt(GEO.limb, L.skin, 0, -0.06, 0, toy ? 1.2 : 0.95, 0.36, toy ? 1.2 : 0.95));    // thigh (tapered)
      const kn = new THREE.Group(); kn.position.y = -0.42; th.add(kn);
      kn.add(pt(GEO.limb, L.skin, 0, 0, 0, toy ? 1.05 : 0.8, 0.31, toy ? 1.05 : 0.8));        // shin
      kn.add(pt(Y, 0xf7f5ef, 0, -0.33, 0, toy ? 0.066 : 0.052, 0.09, toy ? 0.066 : 0.052));   // sock
      // shoe: rounded upper, contrasting sole, a toe cap
      const sh = new THREE.Group(); sh.position.set(0, -0.405, toy ? 0.055 : 0.045); kn.add(sh);
      sh.add(pt(S, shoe, 0, 0.005, 0, toy ? 0.095 : 0.072, toy ? 0.07 : 0.05, toy ? 0.17 : 0.145));
      sh.add(pt(S, L.trim2 || L.shorts, toy ? 0.0 : 0, 0.02, -0.04, toy ? 0.097 : 0.074, toy ? 0.045 : 0.032, toy ? 0.09 : 0.07));
      const sole = pt(GEO.box, 0x2b2f33, 0, -0.035, 0.005, toy ? 0.17 : 0.13, 0.024, toy ? 0.33 : 0.28); sh.add(sole);
      soles.push({ g: kn, y: -0.405 - 0.035 - 0.012, z: (toy ? 0.055 : 0.045), half: toy ? 0.15 : 0.125 });
      return [th, kn];
    };
    [this.thR, this.knR] = leg(-1); [this.thL, this.knL] = leg(1);
    const tor = this.tor = new THREE.Group(); hips.add(tor);
    // shirt: a lathed body, broad at the chest (athletic) or round (toy)
    tor.add(pt(toy ? GEO.torsoToy : GEO.torsoAth, L.shirt, 0, 0.02, 0, 1, 1, toy ? 0.78 : 0.66));
    tor.add(pt(Y, trim, 0, 0.555, 0.0, 0.1, 0.04, 0.08));                                       // collar band
    tor.add(pt(GEO.box, trim, 0, 0.5, 0.115, 0.06, 0.08, 0.012));                              // placket
    // a stripe across the chest in the trim colour
    tor.add(pt(GEO.band, trim, 0, toy ? 0.36 : 0.38, 0, toy ? 1.01 : 0.93, 0.06, toy ? 0.79 : 0.62));
    const head = this.head = new THREE.Group(); head.position.y = toy ? 0.56 : 0.63; tor.add(head);
    head.add(pt(Y, skinD, 0, 0.02, 0, 0.06, 0.1, 0.06));                                         // neck
    const hr = toy ? 0.25 : 0.13, hy = toy ? 0.24 : 0.17;
    head.add(pt(S, L.skin, 0, hy, 0.005, hr, hr * (toy ? 0.96 : 1.12), hr * 0.98));
    for (const sx of [-1, 1]) head.add(pt(S, L.skin, sx * hr * 0.98, hy - 0.01, -0.005, 0.03, 0.045, 0.03)); // ears
    // face: eyes with a highlight, brows, a little nose and cheeks
    const ez = hr * 0.93, ey = hy - (toy ? 0.015 : 0.0), ex = toy ? 0.09 : 0.046;
    for (const sx of [-1, 1]) {
      head.add(pt(S, 0x1b1410, sx * ex, ey, ez, toy ? 0.034 : 0.016, toy ? 0.046 : 0.021, 0.014));
      if (toy) head.add(pt(S, 0xffffff, sx * ex + 0.011, ey + 0.016, ez + 0.011, 0.011, 0.011, 0.004));
      head.add(pt(GEO.box, shadeHex(hairC, 1.1), sx * ex, ey + (toy ? 0.06 : 0.04), ez - 0.004, toy ? 0.05 : 0.036, 0.012, 0.01));
      if (toy) head.add(pt(S, 0xf08a7a, sx * 0.145, hy - 0.08, hr * 0.84, 0.036, 0.02, 0.01));      // cheeks
    }
    head.add(pt(S, shadeHex(L.skin, 0.92), 0, hy - (toy ? 0.035 : 0.025), ez + 0.01, toy ? 0.026 : 0.018, toy ? 0.02 : 0.024, 0.016));
    head.add(pt(GEO.box, shadeHex(L.skin, 0.62), 0, hy - (toy ? 0.09 : 0.065), ez - 0.012, toy ? 0.05 : 0.034, 0.01, 0.01));   // mouth
    this.buildHair(head, hr, hy, L, toy, pt);
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.255, 0.5, 0); tor.add(sh);
      sh.add(pt(S, L.shirt, 0, -0.04, 0, toy ? 0.1 : 0.085, toy ? 0.11 : 0.095, toy ? 0.1 : 0.085));  // shoulder
      sh.add(pt(Y, L.shirt, 0, -0.1, 0, toy ? 0.095 : 0.078, 0.1, toy ? 0.095 : 0.078));            // short sleeve
      sh.add(pt(GEO.limb, L.skin, 0, -0.12, 0, toy ? 0.9 : 0.72, 0.19, toy ? 0.9 : 0.72));          // upper arm
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      el.add(pt(GEO.limb, L.skin, 0, 0, 0, toy ? 0.82 : 0.64, 0.25, toy ? 0.82 : 0.64));           // forearm
      if (side < 0) el.add(pt(Y, trim, 0, -0.205, 0, toy ? 0.062 : 0.05, 0.06, toy ? 0.062 : 0.05)); // wristband
      const wr = new THREE.Group(); wr.position.y = -0.27; el.add(wr);
      wr.add(pt(S, L.skin, 0, -0.035, 0, toy ? 0.068 : 0.048, toy ? 0.072 : 0.056, toy ? 0.062 : 0.045)); // hand
      return [sh, el, wr];
    };
    [this.shR, this.elR, this.wrR] = arm(-1); [this.shL, this.elL, this.wrL] = arm(1);
    // racket: grip, throat and an oval frame with strings (frame in the y-z plane)
    const r = this.racket = new THREE.Group(); r.position.y = -0.06; this.wrR.add(r);
    const rc = L.racket || 0xc8382e;
    r.add(pt(Y, 0x2a2a2a, 0, -0.1, 0, 0.022, 0.22, 0.022));
    r.add(pt(Y, rc, 0, -0.27, 0, 0.016, 0.14, 0.016));
    const hoop = new THREE.Group(); hoop.position.y = -0.48; r.add(hoop);
    const ring = new THREE.Mesh(GEO.hoop, M(rc)); ring.rotation.y = Math.PI / 2; ring.scale.set(0.135, 0.18, 0.16); ring.castShadow = true; hoop.add(ring);
    const strings = new THREE.Mesh(GEO.disc, new THREE.MeshLambertMaterial({ color: 0xf2efe6, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    strings.rotation.y = Math.PI / 2; strings.scale.set(0.13, 0.172, 1); hoop.add(strings);
    // soft contact shadow under the feet so the figure reads as standing on the court
    const blob = this.blob = new THREE.Group();
    for (const [r, o] of [[0.62, 0.13], [0.44, 0.14], [0.27, 0.16]]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: 0x1e140c, transparent: true, depthWrite: false, opacity: o }));
      d.rotation.x = -Math.PI / 2; d.renderOrder = 2; blob.add(d);
    }
    blob.position.y = 0.03;
    root.add(blob);
    this._sole = soles;
    this.applyPose();
  }
  /* hair shapes: short crop, ponytail, bun, curls or a buzz, under an optional cap */
  buildHair(head, hr, hy, L, toy, pt) {
    const S = GEO.sph, h = L.hair, st = L.hairStyle || 'short';
    if (st === 'curls') {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, up = i % 2 ? 0.55 : 0.85;
        head.add(pt(S, h, Math.sin(a) * hr * 0.78, hy + hr * up * 0.75, Math.cos(a) * hr * 0.7 - hr * 0.12, hr * 0.42, hr * 0.42, hr * 0.42));
      }
      head.add(pt(S, h, 0, hy + hr * 0.45, -hr * 0.1, hr * 1.02, hr * 0.85, hr * 0.98));
    } else if (st !== 'buzz') {
      head.add(pt(S, h, 0, hy + hr * 0.2, -hr * 0.1, hr * 1.06, hr * 0.92, hr * 1.02));              // the hair cap over the skull
      head.add(pt(S, h, 0, hy + hr * 0.62, hr * 0.45, hr * 0.8, hr * 0.32, hr * 0.5));             // fringe
    } else head.add(pt(S, h, 0, hy + hr * 0.18, -hr * 0.05, hr * 1.02, hr * 0.9, hr * 1.0));
    if (st === 'pony') {
      head.add(pt(S, h, 0, hy + hr * 0.1, -hr * 1.05, hr * 0.32, hr * 0.32, hr * 0.32));
      head.add(pt(GEO.cap, h, 0, hy - hr * 0.35, -hr * 1.2, hr * 0.38, hr * 1.1, hr * 0.38));
    }
    if (st === 'bun') head.add(pt(S, h, 0, hy + hr * 0.95, -hr * 0.45, hr * 0.42, hr * 0.38, hr * 0.42));
    if (L.cap != null) {
      // a cap that sits back on the head so the face stays visible from the high camera
      head.add(pt(S, L.cap, 0, hy + hr * 0.62, -hr * 0.08, hr * 1.0, hr * 0.56, hr * 0.98));       // crown
      const bill = pt(GEO.cyl8, L.cap, 0, hy + hr * 0.62, hr * 0.72, hr * 0.62, 0.014, hr * 0.42); bill.rotation.x = -0.32; head.add(bill);
    } else if (L.band != null) head.add(pt(GEO.cyl8, L.band, 0, hy + hr * 0.42, 0, hr * 1.07, hr * 0.2, hr * 1.06));
  }
  /* Keep the lowest sole on the court: whatever the legs and hips are doing,
     shift the whole body so one foot is always planted (jumps go through the
     root offset, not through this). */
  plantFeet() {
    const v = this._fv || (this._fv = new THREE.Vector3());
    this.body.position.y = 0;
    this.root.updateMatrixWorld(true);
    let mn = Infinity;
    for (const so of this._sole) for (const dz of [-0.01, 0.01]) {   // the ball of each foot (sampling toe and heel makes the body pump with every knee angle)
      v.set(0, so.y, so.z + dz); so.g.localToWorld(v); this.root.worldToLocal(v); if (v.y < mn) mn = v.y;
    }
    if (mn < Infinity) { this.body.position.y = -mn; this.root.updateMatrixWorld(true); }
  }
  /* world-space side of the forehand: +1 means the forehand is on the player's right */
  get fhSign() { return this.lefty ? -1 : 1; }
  facingRight() { return { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) }; }
  applyPose() {
    const p = this.pose, I = CI;
    this.hips.position.y = 0.95 + p[I.hipY];
    this.hips.rotation.set(p[I.hipRx], 0, 0);
    this.tor.rotation.set(p[I.torRx], p[I.torRy], p[I.torRz], 'YXZ');
    this.head.rotation.set(p[I.headRx], p[I.headRy] - p[I.torRy] * 0.35, 0, 'YXZ');
    this.shR.rotation.set(p[I.shRx], p[I.shRy], p[I.shRz], 'ZYX');
    this.elR.rotation.set(p[I.elR], 0, 0);
    this.wrR.rotation.set(p[I.wrRx], 0, p[I.wrRz]);
    this.shL.rotation.set(p[I.shLx], p[I.shLy], p[I.shLz], 'ZYX');
    this.elL.rotation.set(p[I.elL], 0, 0);
    this.thR.rotation.set(p[I.thRx], 0, p[I.thRz]); this.knR.rotation.set(p[I.knR], 0, 0);
    this.thL.rotation.set(p[I.thLx], 0, p[I.thLz]); this.knL.rotation.set(p[I.knL], 0, 0);
    this.body.rotation.y = p[I.rootRy];
    if (this._sole) this.plantFeet();
  }
  /* --- actions --- */
  prep(kind) { if (this.act && this.act.kind === kind && this.act.prep) return; this.act = { kind, clip: STROKES[kind], t: 0, prep: true, w: this.act ? this.act.w : 0 }; }
  /* rate stretches the forward swing so the contact frame lands exactly
     when the ball arrives; after contact the follow-through plays at 1x. */
  strike(kind, contactH = 1.0, rate = 1, target = null) {
    // a strike always plays at full weight (no "pop" from a cold start)
    const w = Math.max(this.act ? this.act.w : 0, 0.85);
    const clip = STROKES[kind];
    const from = new Float32Array(this.pose);
    this.act = { kind, clip, t: 0, prep: false, w, h: contactH, rate: clamp(rate, 0.3, 4), keyT: clip.contact || 0.1, from,
      target: target ? { x: target.x, y: target.y, z: target.z } : null, adj: { shRx: 0, hipY: 0 }, off: null };
    if (this.act.target) this.aimAt(this.act.keyT / this.act.rate);
  }

  /* ---- contact solving: the strings must meet the ball ----
     For the contact frame of the stroke we pose the rig off-screen, read
     where the racket head lands, bend the arm and knees to match the ball
     height, and step the body so the head sits on the ball. Re-solved each
     frame of the forward swing, so it follows the player's own movement. */
  contactPose(kind, h, adj, out) {
    const clip = STROKES[kind], ks = clip.keys, t = clip.contact || 0.1;
    let i = 0; while (i < ks.length - 2 && t > ks[i + 1][0]) i++;
    const k0 = ks[i], k1 = ks[i + 1], u = smoothstep((t - k0[0]) / (k1[0] - k0[0]));
    for (let j = 0; j < NCH; j++) out[j] = lerp(k0[1][j], k1[1][j], u);
    this.adaptPose(out, kind, h, adj);
    return out;
  }
  adaptPose(A, kind, h, adj) {
    const dh = clamp((h || 1) - 1.0, -0.7, 1.2);
    if (kind === 'fh' || kind === 'bh' || kind === 'vf' || kind === 'vb') {
      A[CI.hipY] += Math.min(0, dh) * 0.12; A[CI.knR] += Math.max(0, -dh) * 0.4; A[CI.knL] += Math.max(0, -dh) * 0.4;
    }
    if (adj) { A[CI.shRx] += adj.shRx; A[CI.hipY] += adj.hipY; A[CI.knR] += -adj.hipY * 2.2; A[CI.knL] += -adj.hipY * 2.2; }
  }
  probeHead(pose, px, py, pz, yaw, out) {
    const save = this._save || (this._save = new Float32Array(NCH)); save.set(this.pose);
    const rp = this._rp || (this._rp = new THREE.Vector3()); rp.copy(this.root.position); const ry = this.root.rotation.y;
    this.pose.set(pose); this.applyPose();
    this.root.position.set(px, py, pz); this.root.rotation.y = yaw; this.root.updateMatrixWorld(true);
    this.racketHead(out);
    this.pose.set(save); this.applyPose(); this.root.position.copy(rp); this.root.rotation.y = ry; this.root.updateMatrixWorld(true);
    return out;
  }
  aimAt(tRem) {
    const a = this.act; if (!a || a.prep || !a.target) return;
    const T = a.target, adj = a.adj;
    tRem = Math.max(0, tRem);
    const px = this.pos.x + this.vel.x * tRem, pz = this.pos.z + this.vel.z * tRem, yaw = this.yaw;
    const pose = this._cp || (this._cp = new Float32Array(NCH));
    const H = this._h1 || (this._h1 = new THREE.Vector3()), H2 = this._h2 || (this._h2 = new THREE.Vector3());
    const probe = (out) => this.probeHead(this.contactPose(a.kind, a.h, adj, pose), px, 0, pz, yaw, out);
    const overhead = a.kind === 'serve' || a.kind === 'smash';
    let jump = 0;
    if (!overhead) {
      for (let it = 0; it < 3; it++) {
        probe(H);
        const dy = T.y - H.y; if (Math.abs(dy) < 0.015) break;
        adj.shRx += 0.12; probe(H2); adj.shRx -= 0.12;
        const d = (H2.y - H.y) / 0.12;
        if (Math.abs(d) < 0.08) break;
        adj.shRx = clamp(adj.shRx + clamp(dy / d, -0.5, 0.5), -1.1, 0.9);
      }
      probe(H);
      const dy = T.y - H.y;
      if (dy < -0.02 || adj.hipY < 0) { adj.hipY = clamp(adj.hipY + dy / 1.42, -0.3, 0); probe(H); }
    } else {
      probe(H);
      // ball below the strings (a late tap): sink the knees, then tip the arm forward a touch
      if (T.y < H.y - 0.015) {
        for (let it = 0; it < 3; it++) {
          const dy = T.y - H.y; if (Math.abs(dy) < 0.015) break;
          const h0 = H.y; adj.hipY -= 0.1; probe(H2); adj.hipY += 0.1;
          const d = (H2.y - h0) / -0.1; if (Math.abs(d) < 0.05) break;
          adj.hipY = clamp(adj.hipY + dy / d, -0.4, 0); probe(H);
        }
        for (let it = 0; it < 3; it++) {
          const dy = T.y - H.y; if (dy > -0.015) break;
          adj.shRx += 0.12; probe(H2); adj.shRx -= 0.12;
          const d = (H2.y - H.y) / 0.12; if (Math.abs(d) < 0.08) break;
          adj.shRx = clamp(adj.shRx + clamp(dy / d, -0.4, 0.4), 0, 0.25); probe(H);
        }
      }
      jump = clamp(T.y - H.y, 0, a.kind === 'smash' ? 0.6 : 0);
    }
    let ox = T.x - H.x, oz = T.z - H.z; const L = Math.hypot(ox, oz), M = 1.35;
    if (L > M) { ox *= M / L; oz *= M / L; }
    a.off = { x: ox, y: jump, z: oz };
    a.head = { x: H.x + ox, y: H.y + jump, z: H.z + oz };           // where the strings will be at contact
  }
  cancel() { if (this.act) this.act.release = true; }
  celebrate(kind = 'pump') { this.mood = kind; this.moodT = 0; this.act = null; }
  deject(kind = 'slump') { this.mood = kind; this.moodT = 0; this.act = null; }
  clearMood() { this.mood = null; }

  /* Move with acceleration limits toward a desired velocity (x,z). */
  drive(dvx, dvz, dt, speedScale = 1) {
    const max = this.maxSpeed * speedScale;
    const l = Math.hypot(dvx, dvz); if (l > max) { dvx *= max / l; dvz *= max / l; }
    const ex = dvx - this.vel.x, ez = dvz - this.vel.z, el = Math.hypot(ex, ez);
    const acc = (dvx * this.vel.x + dvz * this.vel.z) > 0 && Math.hypot(dvx, dvz) > Math.hypot(this.vel.x, this.vel.z) ? this.accel : this.decel;
    const step = acc * dt;
    if (el <= step) { this.vel.x = dvx; this.vel.z = dvz; } else { this.vel.x += ex / el * step; this.vel.z += ez / el * step; }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
  }

  update(dt, faceYaw, surface) {
    // facing
    this.yaw = dampAngle(this.yaw, faceYaw, 9, dt);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    // base locomotion pose
    const T = this.target; T.set(this.mood ? POSE_STAND : POSE_READY);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const fwd = (this.vel.x * fx + this.vel.z * fz), lat = (this.vel.x * fz - this.vel.z * fx);
    // acceleration in the body frame, smoothed: lean into starts, sit back into stops
    const lv = this._lv || (this._lv = { x: 0, z: 0, f: 0, l: 0 });
    const af = clamp(((this.vel.x - lv.x) * fx + (this.vel.z - lv.z) * fz) / Math.max(dt, 1e-3), -40, 40);
    const al = clamp(((this.vel.x - lv.x) * fz - (this.vel.z - lv.z) * fx) / Math.max(dt, 1e-3), -40, 40);
    lv.x = this.vel.x; lv.z = this.vel.z; lv.f += (af - lv.f) * Math.min(1, dt * 10); lv.l += (al - lv.l) * Math.min(1, dt * 10);
    T[CI.torRx] += clamp(lv.f * 0.012, -0.22, 0.3); T[CI.torRz] += clamp(-lv.l * 0.01, -0.2, 0.2);
    if (sp > 0.25) {
      const k = clamp(sp / 5.5, 0, 1);
      const lastPh = this.runPh;
      this.runPh += dt * (7 + sp * 1.7);
      if (Math.floor(lastPh / Math.PI) !== Math.floor(this.runPh / Math.PI)) { this.stepCount++; this.onStep && this.onStep(); }
      const s = Math.sin(this.runPh), c = Math.cos(this.runPh);
      const fk = Math.abs(fwd) / (sp + 1e-3), lk = Math.abs(lat) / (sp + 1e-3);
      const A = 0.35 + 0.65 * k, dirF = Math.sign(fwd) || 1;
      // legs: longer stride, a real knee lift on the recovering leg
      T[CI.thRx] += (-s * 1.05 * A * fk) * dirF - 0.12 * A * fk; T[CI.thLx] += (s * 1.05 * A * fk) * dirF - 0.12 * A * fk;
      T[CI.knR] += Math.max(0, c) * 1.35 * A * fk + 0.25 * lk; T[CI.knL] += Math.max(0, -c) * 1.35 * A * fk + 0.25 * lk;
      // side shuffle: legs open and close, with a little hop
      T[CI.thRz] += -Math.max(0, s) * 0.5 * A * lk; T[CI.thLz] += Math.max(0, -s) * 0.5 * A * lk;
      // springy bounce twice per stride, lower when shuffling
      T[CI.hipY] += -Math.abs(c) * 0.075 * A - 0.05 * lk;
      // forward lean with speed, hips and shoulders counter-twist
      T[CI.torRx] += Math.max(0, fwd) * 0.05 - Math.max(0, -fwd) * 0.02; T[CI.torRz] += -lat * 0.03;
      T[CI.torRy] += s * 0.22 * A * fk; T[CI.rootRy] += -s * 0.1 * A * fk;
      T[CI.headRy] += -s * 0.12 * A * fk;
      // both arms pump opposite the legs; the racket arm swings less
      T[CI.shLx] += s * 0.85 * A * fk; T[CI.elL] += -0.25 * A * fk;
      T[CI.shRx] += -s * 0.45 * A * fk;
      // arms out for balance on a shuffle
      T[CI.shLz] += 0.2 * A * lk;
    } else {
      // on the toes between shots: a light rhythmic bounce, weight shifting side to side
      this.runPh += dt * 7.5;
      const live = !this.mood;
      T[CI.hipY] += (live ? -Math.abs(Math.sin(this.runPh)) * 0.03 : Math.sin(this.runPh * 0.4) * 0.01) - this.split * 0.14;
      T[CI.torRz] += live ? Math.sin(this.runPh * 0.5) * 0.04 : 0;
      T[CI.knR] += this.split * 0.4 + (live ? Math.abs(Math.sin(this.runPh)) * 0.08 : 0);
      T[CI.knL] += this.split * 0.4 + (live ? Math.abs(Math.sin(this.runPh)) * 0.08 : 0);
    }
    this.split = Math.max(0, this.split - dt * 4);
    // mood overlays
    if (this.mood && MOODS[this.mood]) {
      this.moodT += dt;
      const ks = MOODS[this.mood], t = Math.min(this.moodT, ks[ks.length - 1][0]);
      let i = 0; while (i < ks.length - 2 && t > ks[i + 1][0]) i++;
      const u = smoothstep((t - ks[i][0]) / (ks[i + 1][0] - ks[i][0]));
      for (let j = 0; j < NCH; j++) T[j] = lerp(ks[i][1][j], ks[i + 1][1][j], u);
    }
    // stroke layer
    let snap = 14, exact = false;
    const a = this.act;
    const vo = this.visOff || (this.visOff = new THREE.Vector3());
    vo.set(0, 0, 0);
    if (a) {
      const clip = a.clip;
      a.w = Math.min(1, a.w + dt * (a.prep ? 7 : 14));
      let A;
      if (a.prep) { A = clip.prep || clip.keys[0][1]; }
      else {
        const before = a.t < a.keyT;
        if (before && a.target) this.aimAt((a.keyT - a.t) / (a.rate || 1));
        a.t += dt * (a.t < a.keyT ? a.rate || 1 : 1);
        if (before && a.t >= a.keyT) { a.t = a.keyT + 1e-4; a.atContact = true; }
        const ks = clip.keys; const end = ks[ks.length - 1][0];
        if (a.t >= end) { this.act = null; A = null; }
        else {
          // the swing shape: forward swing up to the contact key at the swing rate
          const tk = before && !a.atContact ? a.t : a.t;
          let i = 0; while (i < ks.length - 2 && tk > ks[i + 1][0]) i++;
          const k0 = ks[i], k1 = ks[i + 1];
          const u = smoothstep((tk - k0[0]) / (k1[0] - k0[0]));
          A = this._tmp || (this._tmp = new Float32Array(NCH));
          for (let j = 0; j < NCH; j++) A[j] = lerp(k0[1][j], k1[1][j], u);
          // arm and knee corrections ramp in through the swing, then ease out
          const g = a.t <= a.keyT ? smoothstep(clamp(a.t / a.keyT, 0, 1)) : clamp(1 - (a.t - a.keyT) / 0.3, 0, 1);
          const adj = a.target ? { shRx: a.adj.shRx * g, hipY: a.adj.hipY * g } : null;
          this.adaptPose(A, a.kind, a.target ? a.h : 1 + (a.h - 1) * 0.6, adj);
          if (!a.target && (a.kind === 'fh' || a.kind === 'bh' || a.kind === 'vf' || a.kind === 'vb')) A[CI.shRx] += -clamp((a.h || 1) - 1, -0.7, 1.2) * 0.55;
          // blend from wherever the body was when the swing began
          if (a.from && a.t < a.keyT * 0.55) {
            const b = smoothstep(a.t / (a.keyT * 0.55));
            for (let j = 0; j < NCH; j++) A[j] = lerp(a.from[j], A[j], b);
          }
          // body step into the ball: visual first, committed at contact
          if (a.off) {
            if (a.t <= a.keyT) { const s = smoothstep(clamp(a.t / a.keyT, 0, 1)); vo.set(a.off.x * s, a.off.y * s, a.off.z * s); }
            else {
              if (!a.committed) {
                a.committed = true;
                this.pos.x += a.off.x; this.pos.z += a.off.z;
                if (this.prev) { this.prev.x += a.off.x; this.prev.z += a.off.z; }
              }
              vo.set(0, a.off.y * clamp(1 - (a.t - a.keyT) / 0.25, 0, 1), 0);
            }
          }
          snap = 30; exact = a.t <= a.keyT + 0.04;
        }
      }
      if (A) {
        const legs = a.kind === 'serve' || a.kind === 'smash' ? 1 : 0.45;
        for (let j = 0; j < NCH; j++) {
          const isLeg = j >= CI.thRx && j <= CI.knL;
          T[j] = lerp(T[j], A[j], isLeg ? a.w * legs : (a.prep ? a.w : 1));
        }
      }
    }
    // smooth toward target (the arm is exact through the swing so the strings land on time)
    const k = 1 - Math.exp(-snap * dt);
    for (let i = 0; i < NCH; i++) {
      const isLeg = i >= CI.thRx && i <= CI.knL;
      if (exact && !isLeg) this.pose[i] = T[i]; else this.pose[i] += (T[i] - this.pose[i]) * k;
    }
    this.applyPose();
    this.root.position.set(this.pos.x + vo.x, vo.y, this.pos.z + vo.z);
    if (this.blob) { const r = this.root.scale.x; this.blob.position.y = (0.03 - vo.y) / r; const bs = 1 / (1 + vo.y * 1.5); this.blob.scale.set(bs, 1, bs * 0.85); }
  }
  /* where the free (tossing) hand's palm is, relative to the character's feet, from the last drawn pose */
  palmOffset(out) {
    this.root.updateMatrixWorld(true);
    const w = this._pw || (this._pw = new THREE.Vector3());
    this.wrL.localToWorld(out.set(0, -0.075, 0.02)); this.root.getWorldPosition(w);
    return out.sub(w);
  }
  racketHead(out) { this.racket.children[2].getWorldPosition(out); return out; }
}
