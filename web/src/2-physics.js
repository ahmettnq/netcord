/* =====================================================================
   BALL PHYSICS
   Real tennis ball: 57 g, 33.5 mm radius. Quadratic air drag, Magnus
   lift from spin (topspin dips, slice floats), and a friction impulse
   bounce model (Brody/Cross) so topspin kicks on and slice skids and
   checks. Net cord and net catches included. Deterministic so the AI
   and the on-court guides can predict exactly what the ball will do.
   ===================================================================== */
const BALL_R = 0.0335;
const GRAV = 9.81;
const KD = 0.0205;      // drag: 0.5*rho*Cd*A/m
const KM = 0.00085;     // Magnus coefficient (linear in w x v)
const SPIN_DECAY = 0.12;
const PHYS_DT = 1 / 240;

function netHeight(x) {
  const a = Math.min(Math.abs(x) / COURT.NETW, 1);
  return COURT.NETC + (COURT.NETP - COURT.NETC) * a * a;
}
function hash01(a, b, c) { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); }

class BallState {
  constructor() {
    this.p = { x: 0, y: 1, z: 0 }; this.v = { x: 0, y: 0, z: 0 }; this.w = { x: 0, y: 0, z: 0 };
    this.rolling = false; this.netHit = false;
  }
  copyFrom(o) {
    this.p.x = o.p.x; this.p.y = o.p.y; this.p.z = o.p.z;
    this.v.x = o.v.x; this.v.y = o.v.y; this.v.z = o.v.z;
    this.w.x = o.w.x; this.w.y = o.w.y; this.w.z = o.w.z;
    this.rolling = o.rolling; this.netHit = o.netHit; return this;
  }
  clone() { return new BallState().copyFrom(this); }
  speed() { return Math.hypot(this.v.x, this.v.y, this.v.z); }
}

/* Friction impulse bounce. Hollow sphere: I = 2/3 m R^2. */
function bounceBall(b, surf) {
  const v = b.v, w = b.w;
  const vyIn = v.y;
  v.y = -surf.e * vyIn;
  // contact point velocity u = v + w x r, r = (0,-R,0)
  const ux = v.x + w.z * BALL_R;
  const uz = v.z - w.x * BALL_R;
  const u = Math.hypot(ux, uz);
  if (u > 1e-6) {
    const jRoll = 0.4 * u;                         // impulse/m needed to reach rolling
    const jMax = surf.mu * (1 + surf.e) * Math.abs(vyIn);
    const j = Math.min(jRoll, jMax);
    const Jx = -ux / u * j, Jz = -uz / u * j;
    v.x += Jx; v.z += Jz;
    w.x += -1.5 * Jz / BALL_R;
    w.z += 1.5 * Jx / BALL_R;
  }
  if (v.y < 0.45) { v.y = 0; b.rolling = true; }
}

/* One integration step. Pushes events into `ev` when given. */
function stepBall(b, dt, surf, ev) {
  const p = b.p, v = b.v, w = b.w;
  if (b.rolling) {
    const k = Math.exp(-1.6 * dt);
    v.x *= k; v.z *= k; v.y = 0; p.y = BALL_R;
    p.x += v.x * dt; p.z += v.z * dt;
  } else {
    const sp = Math.hypot(v.x, v.y, v.z);
    const ax = -KD * sp * v.x + KM * (w.y * v.z - w.z * v.y);
    const ay = -GRAV - KD * sp * v.y + KM * (w.z * v.x - w.x * v.z);
    const az = -KD * sp * v.z + KM * (w.x * v.y - w.y * v.x);
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    const px = p.x, py = p.y, pz = p.z;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    const dk = Math.exp(-SPIN_DECAY * dt); w.x *= dk; w.y *= dk; w.z *= dk;

    // ---- net ----
    if ((pz > 0) !== (p.z > 0) && !b.netHit) {
      const t = pz / (pz - p.z);
      const xc = px + (p.x - px) * t, yc = py + (p.y - py) * t;
      if (Math.abs(xc) < COURT.NETW) {
        const h = netHeight(xc);
        if (yc - BALL_R < h) {
          const dir = Math.sign(pz - p.z) * -1; // travel direction in z
          if (yc > h - 0.07) {
            // net cord: pops up and dies, may roll over or fall back
            const r = hash01(xc, yc, v.z);
            const over = r < 0.55;
            p.x = xc; p.y = h + BALL_R + 0.005; p.z = (over ? dir : -dir) * 0.03;
            v.z = (over ? dir : -dir) * (0.6 + r * 1.8);
            v.y = 1.0 + r * 1.4; v.x *= 0.35;
            w.x *= 0.2; w.y *= 0.2; w.z *= 0.2;
            if (ev) ev.push({ type: 'cord', x: xc, y: yc, over });
          } else {
            p.x = xc; p.y = yc; p.z = -dir * 0.05;
            v.z = -v.z * 0.08; v.x *= 0.3; v.y = Math.min(v.y, 0) * 0.3;
            w.x *= 0.1; w.y *= 0.1; w.z *= 0.1;
            b.netHit = true;
            if (ev) ev.push({ type: 'net', x: xc, y: yc });
          }
        }
      }
    }
    // ---- ground ----
    if (p.y < BALL_R && v.y < 0) {
      p.y = BALL_R;
      const vy = -v.y;
      bounceBall(b, surf);
      if (ev) ev.push({ type: 'bounce', x: p.x, z: p.z, vy });
    }
  }
  // ---- backstops and side walls ----
  if (Math.abs(p.z) > COURT.RZ - 0.3) { p.z = Math.sign(p.z) * (COURT.RZ - 0.3); v.z *= -0.25; v.x *= 0.5; v.y *= 0.6; if (ev) ev.push({ type: 'wall' }); }
  if (Math.abs(p.x) > COURT.RX - 0.3) { p.x = Math.sign(p.x) * (COURT.RX - 0.3); v.x *= -0.25; v.z *= 0.6; v.y *= 0.6; if (ev) ev.push({ type: 'wall' }); }
}

/* Predict a trajectory. Returns samples {t,x,y,z,vy,b} where b = bounces so far. */
function predictPath(state, surf, maxT = 3, dt = 1 / 120, maxBounces = 2) {
  const b = state.clone();
  const out = []; const ev = [];
  let bounces = 0, t = 0, netAt = -1;
  out.push({ t: 0, x: b.p.x, y: b.p.y, z: b.p.z, vy: b.v.y, vz: b.v.z, b: 0 });
  while (t < maxT) {
    ev.length = 0;
    stepBall(b, dt, surf, ev);
    t += dt;
    for (const e of ev) { if (e.type === 'bounce') bounces++; if (e.type === 'net' || e.type === 'cord') netAt = t; }
    out.push({ t, x: b.p.x, y: b.p.y, z: b.p.z, vy: b.v.y, vz: b.v.z, b: bounces });
    if (bounces >= maxBounces || b.rolling) break;
  }
  out.netAt = netAt;
  return out;
}
function firstBounce(path) { for (const s of path) if (s.b >= 1) return s; return null; }

/* ---------- Shot solver ----------
   Given a start point, a target landing spot, a pace and a spin, find the
   launch velocity (elevation + azimuth) that lands there, while clearing
   the net by minClear. Shooting method with bisection, runs in ~1 ms. */
function spinVec(dx, dz, top, side) { return { x: top * dz, y: side, z: -top * dx }; }

function flyTo(p0, v0, w0) {
  let px = p0.x, py = p0.y, pz = p0.z, vx = v0.x, vy = v0.y, vz = v0.z;
  let wx = w0.x, wy = w0.y, wz = w0.z;
  const dt = 1 / 120; let t = 0, clear = 99, crossed = false;
  while (t < 5) {
    const sp = Math.hypot(vx, vy, vz);
    const ax = -KD * sp * vx + KM * (wy * vz - wz * vy);
    const ay = -GRAV - KD * sp * vy + KM * (wz * vx - wx * vz);
    const az = -KD * sp * vz + KM * (wx * vy - wy * vx);
    vx += ax * dt; vy += ay * dt; vz += az * dt;
    const opz = pz, opy = py, opx = px;
    px += vx * dt; py += vy * dt; pz += vz * dt;
    if (!crossed && (opz > 0) !== (pz > 0)) {
      crossed = true; const k = opz / (opz - pz);
      const xc = opx + (px - opx) * k, yc = opy + (py - opy) * k;
      clear = yc - BALL_R - netHeight(xc);
    }
    t += dt;
    if (py <= BALL_R) break;
  }
  return { x: px, z: pz, t, clear, crossed };
}

function solveShot(p0, tx, tz, o) {
  const top = o.top || 0, side = o.side || 0;
  const minClear = o.minClear == null ? 0.2 : o.minClear;
  let az = Math.atan2(tx - p0.x, tz - p0.z);
  const distT = Math.hypot(tx - p0.x, tz - p0.z);
  let best = null;
  const tryAt = (azim) => {
    const dx = Math.sin(azim), dz = Math.cos(azim);
    const w = spinVec(dx, dz, top, side);
    const land = (s, el) => {
      const v = { x: dx * Math.cos(el) * s, y: Math.sin(el) * s, z: dz * Math.cos(el) * s };
      const r = flyTo(p0, v, w);
      r.d = (r.x - p0.x) * dx + (r.z - p0.z) * dz; r.v = v; r.w = w; return r;
    };
    if (o.mode === 'lob') {
      const el = o.elev || 0.82;
      let lo = 4, hi = 40, r = null;
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; r = land(m, el); if (r.d < distT) lo = m; else hi = m; }
      return r;
    }
    // drive: try the requested pace, ease off until the net is cleared
    let s = o.speed, r = null;
    for (let k = 0; k < 14; k++) {
      let lo = -0.45, hi = 0.75;
      const rHi = land(s, hi);
      if (rHi.d < distT) { r = rHi; s *= 1.08; continue; }
      if (land(s, lo).d > distT) { s *= 0.9; continue; }
      for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; r = land(s, m); if (r.d < distT) lo = m; else hi = m; }
      if (r.clear >= minClear) return r;
      s *= 0.92;
      if (s < 6) break;
    }
    return r;
  };
  for (let it = 0; it < 3; it++) {
    best = tryAt(az);
    if (!best) break;
    // correct the azimuth for curve and drift
    const dx = Math.sin(az), dz = Math.cos(az);
    const lat = (best.x - p0.x) * dz - (best.z - p0.z) * dx;
    const want = (tx - p0.x) * dz - (tz - p0.z) * dx;
    const err = lat - want;
    if (Math.abs(err) < 0.03) break;
    az -= Math.atan2(err, Math.max(2, distT));
  }
  return best ? { v: best.v, w: best.w, land: { x: best.x, z: best.z }, t: best.t, clear: best.clear } : null;
}

/* Is a bounce inside a rectangle with the ball touching the line counted as in? */
function lineMargin(x, z, hx, z0, z1) {
  // positive = inside by that much, negative = out by that much
  const mx = hx + BALL_R - Math.abs(x);
  const mz = Math.min(z - (z0 - BALL_R), (z1 + BALL_R) - z);
  return Math.min(mx, mz);
}
