/* =====================================================================
   MATCH: ball visuals and effects, rules and scoring, the AI brain, the
   shared hitting model (used by both the human and the AI), and the
   point flow: walk back, serve, rally, call, crowd, umpire.
   ===================================================================== */
const VIS_R = 0.072;  // drawn ball radius (bigger than real so it reads on a phone)
const SWING_T = 0.12; // sim seconds from the tap to racket-on-ball (the stroke's forward swing)
const TAP_LAG = 0.045; // real seconds of touch + display latency forgiven on every tap
const CONTACT_AHEAD = 0.35; // the ideal contact point sits this far in front of the body
const REACH = 1.15, REACH_PRE = 1.25;   // how far from the ideal contact spot a lunge can still reach

class BallView {
  constructor(scene) {
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(VIS_R, 12, 10), new THREE.MeshLambertMaterial({ color: 0xdff23c, emissive: 0x4a5a00 }));
    this.mesh.castShadow = true; scene.add(this.mesh);
    const blobT = TEX.blob();
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; scene.add(this.blob);
    // trail ribbon
    this.N = 16; this.hist = [];
    const g = new THREE.BufferGeometry();
    this.tp = new Float32Array(this.N * 2 * 3); this.tc = new Float32Array(this.N * 2 * 4);
    const idx = []; for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(this.tp, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.tc, 4));
    this.trail = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false; scene.add(this.trail);
    // guide rings
    const ringT = TEX.ring();
    const ring = (c, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: ringT, color: c, transparent: true, depthWrite: false, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; scene.add(m); return m; };
    this.landRing = ring(0xffffff, 0.9);
    this.spotRing = ring(0xffe14d, 1.1);
    this.aimRing = ring(0xffffff, 0.8);
    this.outRing = ring(0xff5a3c, 0.7);
    this.timeRing = ring(0xffffff, 1.0);
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3();
    this.hot = 0;
  }
  setVisible(v) { this.mesh.visible = v; this.blob.visible = v; this.trail.visible = v; }
  update(p, dt, camDir, live) {
    const y = Math.max(p.y, VIS_R);
    this.mesh.position.set(p.x, y, p.z);
    this.blob.position.set(p.x, 0.012, p.z);
    const s = clamp(1.15 - p.y * 0.12, 0.35, 1.15); this.blob.scale.set(s, s, s);
    this.blob.material.opacity = clamp(1 - p.y * 0.1, 0.3, 1);
    // trail
    this.hist.unshift({ x: p.x, y, z: p.z }); if (this.hist.length > this.N) this.hist.pop();
    this.hot = Math.max(0, this.hot - dt * 0.8);
    const w = VIS_R * 0.95;
    for (let i = 0; i < this.N; i++) {
      const a = this.hist[Math.min(i, this.hist.length - 1)], b = this.hist[Math.min(i + 1, this.hist.length - 1)];
      this._d.set(a.x - b.x, a.y - b.y, a.z - b.z);
      if (this._d.lengthSq() < 1e-6) this._d.set(1, 0, 0);
      this._v.crossVectors(this._d, camDir).normalize().multiplyScalar(w * (1 - i / this.N));
      const o = i * 6;
      this.tp[o] = a.x + this._v.x; this.tp[o + 1] = a.y + this._v.y; this.tp[o + 2] = a.z + this._v.z;
      this.tp[o + 3] = a.x - this._v.x; this.tp[o + 4] = a.y - this._v.y; this.tp[o + 5] = a.z - this._v.z;
      const al = live ? (1 - i / this.N) * 0.55 : 0;
      const c = i * 8, r = 1, gg = 1 - this.hot * 0.15, bb = 0.55 - this.hot * 0.4;
      this.tc[c] = r; this.tc[c + 1] = gg; this.tc[c + 2] = bb; this.tc[c + 3] = al;
      this.tc[c + 4] = r; this.tc[c + 5] = gg; this.tc[c + 6] = bb; this.tc[c + 7] = al;
    }
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.color.needsUpdate = true;
  }
  ring(r, x, z, op, scale = 1) { r.position.set(x, 0.02, z); r.material.opacity = op; r.scale.setScalar(scale); }
}

/* Dust, chalk and grass puffs via a single instanced mesh. */
class FX {
  constructor(scene) {
    this.n = 140; this.i = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false }), this.n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.p = []; for (let i = 0; i < this.n; i++) { this.p.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0 }); this.mesh.setColorAt(i, _c.set(0xffffff)); }
    scene.add(this.mesh); this.o = new THREE.Object3D();
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TEX.burst(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    this.flash.renderOrder = 5; this.flash.visible = false; this.flash.userData = { t: 1, k: 0 }; scene.add(this.flash);
    // clay marks
    this.markTex = TEX.mark(); this.marks = []; this.mi = 0;
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.5), new THREE.MeshBasicMaterial({ map: this.markTex, transparent: true, depthWrite: false, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.006; scene.add(m); this.marks.push(m); }
  }
  puff(x, y, z, color, count = 6, spread = 1.2, size = 0.09) {
    for (let k = 0; k < count; k++) {
      const p = this.p[this.i]; this.i = (this.i + 1) % this.n;
      p.life = rand(0.35, 0.7); p.max = p.life; p.x = x + rand(-0.1, 0.1); p.y = y; p.z = z + rand(-0.1, 0.1);
      p.vx = rand(-spread, spread); p.vy = rand(0.6, 1.8); p.vz = rand(-spread, spread); p.s = size * rand(0.6, 1.4);
      this.mesh.setColorAt(this.p.indexOf(p), _c.set(color));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  mark(x, z, vx, vz) {
    const m = this.marks[this.mi]; this.mi = (this.mi + 1) % this.marks.length;
    m.position.set(x, 0.006, z); m.rotation.z = -Math.atan2(vx, vz); m.material.opacity = 0.9; m.userData.age = 0;
  }
  clearMarks() { for (const m of this.marks) m.material.opacity = 0; }
  /* A quick white shock ring at the contact point, facing the camera. */
  impact(x, y, z, k, cam) {
    const f = this.flash; f.position.set(x, y, z); f.quaternion.copy(cam.quaternion);
    f.userData.t = 0; f.userData.k = k; f.visible = true;
  }
  update(dt) {
    const o = this.o, f = this.flash;
    if (f.visible) {
      f.userData.t += dt; const u = f.userData.t / 0.16, k = f.userData.k;
      if (u >= 1) f.visible = false;
      else { f.scale.setScalar((0.25 + u * 1.1) * (0.6 + k * 0.8)); f.material.opacity = (1 - u) * (0.5 + k * 0.5); }
    }
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      if (p.life > 0) {
        p.life -= dt; p.vy -= 3 * dt; p.vx *= 0.96; p.vz *= 0.96;
        p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt;
        const s = p.s * (0.4 + 0.6 * (p.life / p.max));
        o.position.set(p.x, p.y, p.z); o.scale.set(s, s, s);
      } else { o.position.set(0, -50, 0); o.scale.set(0.001, 0.001, 0.001); }
      o.updateMatrix(); this.mesh.setMatrixAt(i, o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(scene) { scene.remove(this.mesh); scene.remove(this.flash); this.marks.forEach(m => scene.remove(m)); }
}

/* ---------------- the competitors ---------------- */
function makeComp(i, profile, look, isAI) {
  const ch = new Character(look);
  ch.maxSpeed = profile.speed || 6;
  return {
    i, side: i === 0 ? 1 : -1, name: profile.name, short: profile.short, profile, char: ch, isAI,
    swing: null, plan: null, recover: null, stamina: 1,
    stats: { aces: 0, df: 0, winners: 0, errors: 0, perfect: 0, fastest: 0, points: 0, firstIn: 0, firstTotal: 0 }
  };
}

const POINT_WORDS = ['Love', 'Fifteen', 'Thirty', 'Forty'];
const POINT_SHORT = ['0', '15', '30', '40'];

class Match {
  constructor(game, cfg) {
    this.game = game; this.cfg = cfg; this.scene = game.scene;
    this.surf = COURTS[cfg.court];
    const youLook = { shirt: 0xf6f3ea, shorts: 0x173a2a, skin: 0xe8b98e, hair: 0x3a2416, cap: 0xf6f3ea, hairStyle: 'short', trim: 0xc8582f, racket: 0x1d5f8a };
    const r = cfg.rival;
    const rivalLook = { shirt: r.shirt, shorts: r.shorts, skin: r.skin, hair: r.hair, cap: r.cap, band: r.band, hairStyle: r.hairStyle, lefty: r.lefty, racket: 0xc8382e, trim: r.shorts === r.shirt ? 0xf4efe4 : r.shorts };
    const youProfile = cfg.demo ? Object.assign({}, RIVALS[2], { name: 'Ivy Rowe', short: 'IVY' }) : { name: 'You', short: 'YOU', speed: 6.2 };
    this.P = [makeComp(0, youProfile, youLook, !!cfg.demo), makeComp(1, r, rivalLook, true)];
    for (const c of this.P) { this.scene.add(c.char.root); c.char.onStep = () => this.onStep(c); }
    this.ball = new BallState();
    this.view = new BallView(this.scene);
    this.fx = new FX(this.scene);
    this.format = FORMATS[cfg.format];
    this.score = { p: [0, 0], g: [0, 0], sets: [], won: [0, 0], tb: false, tbStart: 0, setStarter: 0 };
    this.server = 0; this.serveNum = 1;
    this.rally = 0; this.longest = 0;
    this.state = 'reposition'; this.stateT = 0; this.time = 0;
    this.hitter = -1; this.bounces = 0; this.isServe = false; this.letCord = false; this.lastHitT = 0;
    this.events = []; this.acc = 0; this.over = false;
    this.toss = null;
    this.placeForPoint(true);
    UI.scoreboard(this);
  }
  get human() { return this.P[0]; }
  get rival() { return this.P[1]; }
  dispose() {
    for (const c of this.P) this.scene.remove(c.char.root);
    for (const o of [this.view.mesh, this.view.blob, this.view.trail, this.view.landRing, this.view.spotRing, this.view.aimRing, this.view.outRing, this.view.timeRing]) this.scene.remove(o);
    this.fx.dispose(this.scene);
  }

  /* ---------- serve geometry ---------- */
  rightSign(i) { return i === 0 ? 1 : -1; }                 // world x sign of player i's right hand side
  deuceSide() {
    const s = this.score;
    return s.tb ? (s.p[0] + s.p[1]) % 2 === 0 : (s.p[0] + s.p[1]) % 2 === 0;
  }
  boxSign() { const rs = this.rightSign(this.server); return this.deuceSide() ? -rs : rs; }
  servePos() { const rs = this.rightSign(this.server); return { x: rs * (this.deuceSide() ? 0.85 : -0.85), z: this.P[this.server].side * (COURT.HL + 0.35) }; }
  returnPos() {
    const r = 1 - this.server, rc = this.P[r];
    const deep = rc.isAI ? 0.9 + (this.P[this.server].profile.serve || 0.6) * 0.8 : 0.9;
    return { x: this.boxSign() * 2.9, z: rc.side * (COURT.HL + deep) };
  }
  currentServer() {
    if (this.cfg.tutorial && typeof TUT !== 'undefined') return TUT.step >= 1 ? 1 : 0;   // practice: you serve first, then Pip feeds you
    const s = this.score;
    if (!s.tb) return this.server;
    const k = s.p[0] + s.p[1];
    if (k === 0) return s.tbStart;
    return Math.floor((k - 1) / 2) % 2 === 0 ? 1 - s.tbStart : s.tbStart;
  }

  placeForPoint(instant) {
    this.server = this.currentServer();
    const sp = this.servePos(), rp = this.returnPos();
    const s = this.P[this.server], r = this.P[1 - this.server];
    s.target = sp; r.target = rp;
    if (instant) { for (const c of [s, r]) { c.char.pos.set(c.target.x, 0, c.target.z); c.char.vel.set(0, 0, 0); c.char.yaw = c.side > 0 ? Math.PI : 0; } }
    this.state = 'reposition'; this.stateT = 0;
    this.hitter = -1; this.bounces = 0; this.isServe = true; this.letCord = false;
    for (const c of this.P) { c.swing = null; c.queued = null; c.plan = null; c.recover = null; c.char.act = null; c.rushing = false; c.path = null; }
    this.toss = null; this.rally = 0; UI.rally(0);
  }

  /* ---------- main update (sim time) ---------- */
  update(dt) {
    this.time += dt; this.stateT += dt;
    const ball = this.ball, H = this.human;
    // input for the human
    const stick = this.cfg.demo ? { x: 0, z: 0, mag: 0 } : this.game.input.worldStick();

    switch (this.state) {
      case 'reposition': {
        let done = true;
        for (const c of this.P) {
          const dx = c.target.x - c.char.pos.x, dz = c.target.z - c.char.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.08) { done = false; const sp = Math.min(c.char.maxSpeed * 0.62, d * 3); c.char.drive(dx / d * sp, dz / d * sp, dt); }
          else c.char.drive(0, 0, dt);
        }
        // ball held by server
        this.holdBall();
        if ((done && this.stateT > 0.5) || this.stateT > 3.2) {
          for (const c of this.P) { c.char.pos.x = c.target.x; c.char.pos.z = c.target.z; c.char.vel.set(0, 0, 0); }
          this.state = 'serveReady'; this.stateT = 0;
          const sv = this.P[this.server];
          UI.status(this.serveNum === 1 ? 'FIRST SERVE' : 'SECOND SERVE');
          if (!sv.isAI && (Match.hints = (Match.hints || 0) + 1) <= 2) UI.hint('Tap to toss, tap again at the top');
          UI.scoreboard(this);
        }
        break;
      }
      case 'serveReady': {
        const sv = this.P[this.server], rc = this.P[1 - this.server];
        this.holdBall();
        rc.char.drive(0, 0, dt);
        if (sv.isAI) {
          sv.char.drive(0, 0, dt);
          if (this.stateT > 0.9 + (this.serveNum === 2 ? 0.3 : 0)) this.startToss(sv);
        } else {
          // slide along the baseline before the toss
          const rs = this.rightSign(this.server), dS = this.deuceSide() ? 1 : -1;
          const lo = dS * rs > 0 ? 0.25 : -4.0, hi = dS * rs > 0 ? 4.0 : -0.25;
          sv.char.drive(stick.x * 2.4, 0, dt);
          sv.char.pos.x = clamp(sv.char.pos.x, Math.min(lo, hi), Math.max(lo, hi));
          sv.char.pos.z = sv.side * (COURT.HL + 0.35);
          this.showServeAim(sv, stick);
        }
        break;
      }
      case 'toss': {
        const sv = this.P[this.server];
        sv.char.drive(0, 0, dt);
        this.P[1 - this.server].char.drive(0, 0, dt);
        // ball under gravity only
        ball.v.y -= GRAV * dt; ball.p.y += ball.v.y * dt;
        { const k = Math.pow(Math.max(0, 1 - this.stateT / 0.28), 2), T = this.toss; if (T.tx != null) { ball.p.x = T.tx + T.hx * k; ball.p.z = T.tz + T.hz * k; } }
        if (!sv.isAI) {
          this.showServeAim(sv, stick);
          // seconds until the ideal tap (the strings arrive as the toss peaks)
          const sw = SAVE.settings.assist === 'off' ? 1 : 1.35, W = this.timing();
          const te = (ball.v.y + GRAV * TAP_LAG * this.simScale() - GRAV * STROKES.serve.contact) / GRAV;
          const good = Math.abs(te) <= Math.max(W.p * 1.2 * sw, W.w * 0.5 * sw);
          UI.tossMeter(clamp(1 - te / 0.5, 0, 1), good);
          if (this.toss.queued && !this.toss.hit && te <= 0) { const k = this.toss.queued; this.toss.queued = null; this.toss.hit = true; UI.held(null); this.serveSwing(sv, k, 0.8); }
          if (!this.toss.hit && te > -W.w * sw) UI.cue({ x: ball.p.x, y: this.toss.apex, z: ball.p.z }, Math.max(0, te) / 0.5, good); else UI.cue(null);
        } else if (ball.v.y <= GRAV * STROKES.serve.contact + 0.1 && !this.toss.hit) {
          this.toss.hit = true; this.serveSwing(sv, 'top', 1 - rand(0, 0.25) * (1 - sv.profile.accuracy));
        }
        if (this.toss.pending && this.time >= this.toss.pending.at - 1e-6) {
          const pd = this.toss.pending; this.toss.pending = null; this.serveHit(sv, pd.kind, pd.q);
          break;
        }
        if (ball.p.y < 1.25 && ball.v.y < 0 && this.state === 'toss') {
          // let the toss drop, no penalty
          sv.char.act = null; UI.tossMeter(0, false); UI.flash('LET IT DROP · RE-TOSS');
          this.state = 'serveReady'; this.stateT = 0.4;
        }
        break;
      }
      case 'live': case 'dead': {
        // physics
        this.events.length = 0;
        const steps = Math.max(1, Math.round(dt / PHYS_DT)); const h = dt / steps;
        for (let k = 0; k < steps; k++) {
          stepBall(ball, h, this.surf, this.events);
          if (this.state === 'live') for (const c of this.P) this.tryContact(c);
        }
        for (const e of this.events) this.onBallEvent(e);
        if (this.state === 'live' && this.time - this.lastHitT > 7) this.pointTo(this.bounces >= 1 ? this.hitter : 1 - this.hitter, 'WINNER');
        // movement
        for (const c of this.P) {
          if (c.isAI) this.aiMove(c, dt);
          else { this.humanMove(c, stick, dt); this.humanPrep(c); }
          this.swingUpdate(c, dt);
        }
        if (this.state === 'dead' && this.stateT > 2.1) this.nextPoint();
        if (this.state === 'live' && !H.isAI) this.updateGuides(stick); else if (this.state !== 'toss') UI.cue(null);
        break;
      }
      case 'over': {
        for (const c of this.P) c.char.drive(0, 0, dt);
        break;
      }
    }
    // animate characters
    for (const c of this.P) {
      const ch = c.char;
      let face = c.side > 0 ? Math.PI : 0;
      if (this.state === 'live' || this.state === 'dead') {
        const bx = ball.p.x - ch.pos.x, bz = ball.p.z - ch.pos.z;
        const want = Math.atan2(bx, bz);
        // mid-stroke the body stays square to the net so the strings meet the ball where the game expects
        const swinging = ch.act && !ch.act.prep && ch.act.target;
        face = face + clamp(angDiff(face, want), swinging ? -0.12 : -0.9, swinging ? 0.12 : 0.9);
      } else if (this.state === 'reposition') {
        const sp = Math.hypot(ch.vel.x, ch.vel.z);
        if (sp > 1.2) face = Math.atan2(ch.vel.x, ch.vel.z);
      }
      // stamina
      if (!c.isAI) {
        const sp = Math.hypot(ch.vel.x, ch.vel.z) / ch.maxSpeed;
        c.stamina = clamp(c.stamina + (sp > 0.7 ? -0.1 : 0.16) * dt, 0.15, 1);
      }
      ch.update(dt, face, this.surf.id);
    }
    if (!this.cfg.demo) UI.stamina(this.human.stamina);
    this.fx.update(dt);
  }

  /* Interpolation support: remember where things were before a step,
     then draw them part way to where they are now. */
  snap() {
    const b = this.ball.p; this._bp = this._bp || { x: 0, y: 0, z: 0 };
    this._bp.x = b.x; this._bp.y = b.y; this._bp.z = b.z;
    for (const c of this.P) { const ch = c.char; ch.prev = ch.prev || new THREE.Vector3(); ch.prev.copy(ch.pos); }
  }
  render(a, rdt, camDir) {
    const b = this.ball.p, q = this._bp || b;
    const jump = Math.abs(b.x - q.x) + Math.abs(b.y - q.y) + Math.abs(b.z - q.z) > 1.5;
    const ip = this._ip || (this._ip = { x: 0, y: 0, z: 0 });
    ip.x = jump ? b.x : lerp(q.x, b.x, a); ip.y = jump ? b.y : lerp(q.y, b.y, a); ip.z = jump ? b.z : lerp(q.z, b.z, a);
    // right after contact the drawn ball starts from the strings and eases onto its real path
    const bo = this.ballOff;
    if (bo && bo.k > 0) { ip.x += bo.x * bo.k; ip.y += bo.y * bo.k; ip.z += bo.z * bo.k; bo.k = Math.max(0, bo.k - rdt / 0.12); }
    this.view.update(ip, rdt, camDir, this.state === 'live' || this.state === 'dead');
    for (const c of this.P) { const ch = c.char; if (ch.prev) { ch.root.position.lerpVectors(ch.prev, ch.pos, a); if (ch.visOff) ch.root.position.add(ch.visOff); } }
  }

  holdBall() {
    const sv = this.P[this.server], ch = sv.char;
    const r = ch.facingRight();
    const fwd = { x: Math.sin(ch.yaw), z: Math.cos(ch.yaw) };
    // the ball sits in the free hand's palm (the non-racket hand, left for righties)
    const o = ch.palmOffset(this._po || (this._po = new THREE.Vector3()));
    if (o.lengthSq() > 0.01 && o.y > 0.3 && o.y < 2.4) { this.ball.p.x = ch.pos.x + o.x; this.ball.p.z = ch.pos.z + o.z; this.ball.p.y = o.y; }
    else { const hs = ch.lefty ? -1 : 1; this.ball.p.x = ch.pos.x - r.x * 0.3 * hs + fwd.x * 0.3; this.ball.p.z = ch.pos.z - r.z * 0.3 * hs + fwd.z * 0.3; this.ball.p.y = 1.0; } this.ball.v.x = this.ball.v.y = this.ball.v.z = 0; this.ball.w.x = this.ball.w.y = this.ball.w.z = 0;
    this.ball.rolling = false; this.ball.netHit = false;
  }

  /* ---------- serving ---------- */
  startToss(sv) {
    const ch = sv.char; const r = ch.facingRight(); const fwd = { x: Math.sin(ch.yaw), z: Math.cos(ch.yaw) };
    const hs = ch.lefty ? -1 : 1;
    // toss the ball to the exact spot the strings reach at full stretch
    const pose = ch._sp || (ch._sp = new Float32Array(NCH));
    const H = ch.probeHead(ch.contactPose('serve', 2.6, null, pose), ch.pos.x, 0, ch.pos.z, ch.yaw, new THREE.Vector3());
    const ok = H.y > 2.0 && H.y < 3.8 && Math.hypot(H.x - ch.pos.x, H.z - ch.pos.z) < 1.2;
    const hand = { x: this.ball.p.x, z: this.ball.p.z };   // where the ball sat in the palm
    if (ok) { this.ball.p.x = H.x; this.ball.p.z = H.z; }
    else { this.ball.p.x = ch.pos.x + fwd.x * 0.42 - r.x * 0.12 * hs; this.ball.p.z = ch.pos.z + fwd.z * 0.42 - r.z * 0.12 * hs; }
    const apex = ok ? H.y : 2.82;
    this.ball.p.y = 1.55; this.ball.v.y = Math.sqrt(2 * GRAV * Math.max(0.6, apex - 1.55)); this.ball.v.x = 0; this.ball.v.z = 0;
    this.toss = { apex: 1.55 + this.ball.v.y * this.ball.v.y / (2 * GRAV), hit: false, pending: null,
      tx: this.ball.p.x, tz: this.ball.p.z, hx: hand.x - this.ball.p.x, hz: hand.z - this.ball.p.z };
    if (Math.hypot(this.toss.hx, this.toss.hz) > 0.8) this.toss.hx = this.toss.hz = 0;
    this.ball.p.x += this.toss.hx; this.ball.p.z += this.toss.hz;   // leaves from the hand, drifts onto the toss line
    ch.prep('serve');
    this.state = 'toss'; this.stateT = 0;
    UI.hint('');
  }
  serveSwing(sv, kind, q) {
    const lead = STROKES.serve.contact, b = this.ball;
    const P = { x: b.p.x, y: b.p.y + b.v.y * lead - 0.5 * GRAV * lead * lead, z: b.p.z };
    sv.char.strike('serve', P.y, 1, P);
    this.toss.pending = { kind, q, at: this.time + lead };
  }
  serveHit(sv, kind, qIn) {
    const ball = this.ball, ch = sv.char;
    const q = clamp(qIn, 0, 1);
    const perfect = !sv.isAI && q > 0.86;
    if (!ch.act || ch.act.kind !== 'serve' || ch.act.prep) ch.strike('serve', 2.6);
    this.ballFromStrings(sv);
    const second = this.serveNum === 2 || (this.cfg.tutorial && sv.isAI);   // practice feeds are gentle
    const bs = this.boxSign();
    let aimX = 0;
    if (!sv.isAI) aimX = this.game.input.worldStick().x * (sv.side > 0 ? 1 : -1);
    else aimX = pick([-1, 0, 1, 1]) * (Math.random() < 0.5 ? 1 : 0.6) * (this.server === 1 ? -1 : 1);
    // aimX: +1 = toward the T for... map to box x positions
    const tWide = bs * (COURT.SW - 0.42), tT = bs * 0.42, tBody = bs * 2.0;
    let tx = sv.isAI ? pick([tWide, tT, tBody, tT, tWide]) : (Math.abs(aimX) < 0.25 ? tBody : (aimX * bs > 0 ? tWide : tT));
    let tz = -sv.side * (COURT.SV - (kind === 'lob' ? 1.3 : 0.75));
    let speed, top, side = 0, minClear = 0.08;
    const pr = sv.profile;
    if (sv.isAI) {
      const pw = pr.serve * (this.cfg.diff ? this.cfg.diff.power : 1);
      speed = (second ? lerp(21, 29, pw) : lerp(26, 45, pw)) * rand(0.92, 1.06);
      top = second ? 260 : 60; side = second ? 0 : rand(-40, 40);
      kind = second ? 'lob' : 'top';
    } else if (kind === 'top') { speed = 30 + q * 17; top = 50; }
    else if (kind === 'slice') { speed = 26 + q * 10; top = 30; side = -bs * 120 * sv.side; }
    else { speed = 21 + q * 8; top = 300; }
    // error model
    const acc = sv.isAI ? clamp(pr.accuracy * (this.cfg.diff ? this.cfg.diff.accuracy : 1), 0.1, 0.96) : 0.75;
    let sig = 0.12 + (1 - q) * 0.85 + (speed > 42 ? 0.18 : 0) + (1 - clamp(acc, 0, 1)) * 0.5 + (second ? -0.08 : 0.12);
    if (perfect) sig *= 0.45;
    tx += gauss() * sig * 0.9; tz += gauss() * sig * 0.9 * -sv.side;
    if (Math.random() < (sv.isAI ? (second ? 0.03 : 0.1) * (1.25 - acc) : (q < 0.4 ? 0.35 : q < 0.6 ? 0.08 : 0.02))) minClear = -0.12;
    const p0 = { x: ball.p.x, y: ball.p.y + 0.15, z: ball.p.z };
    let sol = solveShot(p0, tx, tz, { speed, top, side, minClear });
    if (!sol) sol = solveShot(p0, tx, tz, { speed: speed * 0.7, top: 200, side: 0, minClear: 0.15 });
    ball.p.x = p0.x; ball.p.y = p0.y; ball.p.z = p0.z;
    if (sol) { ball.v.x = sol.v.x; ball.v.y = sol.v.y; ball.v.z = sol.v.z; ball.w.x = sol.w.x; ball.w.y = sol.w.y; ball.w.z = sol.w.z; }
    ball.rolling = false; ball.netHit = false;
    this.hitter = sv.i; this.bounces = 0; this.isServe = true; this.letCord = false; this.lastHitT = this.time;
    this.rally = 0;
    this.state = 'live'; this.stateT = 0;
    const kmh = Math.round(Math.hypot(ball.v.x, ball.v.y, ball.v.z) * 3.6);
    this.serveKmh = kmh;
    if (this.serveNum === 1) sv.stats.firstTotal++;
    SFX.hit(speed / 40, perfect, kind);
    if (sv.isAI && pr.net > 0.55 && Math.random() < pr.net * (second ? 0.6 : 1)) sv.rushing = true;
    this.fx.impact(ball.p.x, ball.p.y, ball.p.z, perfect ? 1 : 0.4, this.game.camera);
    if (!sv.isAI) {
      Haptics.hit(clamp(0.35 + q * 0.6, 0, 1), perfect);
      this.game.hitStop(perfect ? 0.09 : 0.03); this.game.punch(perfect ? 0.03 : 0.012);
      UI.speed(kmh); sv.stats.fastest = Math.max(sv.stats.fastest, kmh);
    }
    if (perfect) { this.view.hot = 1; UI.toast('PERFECT SERVE', '#ffd84d', ch.pos, 2.6); sv.stats.perfect++; this.game.shake(0.12); }
    UI.tossMeter(0, false);
    this.onHit(sv);
  }
  showServeAim(sv, stick) {
    if (!SAVE.settings.guides) return;
    const bs = this.boxSign();
    const ax = stick.x * (sv.side > 0 ? 1 : -1);
    const tx = Math.abs(ax) < 0.25 ? bs * 2.0 : (ax * bs > 0 ? bs * (COURT.SW - 0.42) : bs * 0.42);
    this.view.ring(this.view.aimRing, tx, -sv.side * (COURT.SV - 0.75), 0.55 + Math.sin(this.time * 6) * 0.15, 1);
  }

  /* ---------- human input ---------- */
  press(kind) {
    const H = this.human;
    if (H.isAI) return;
    if (this.state === 'serveReady' && this.server === 0) { this.startToss(H); return; }
    if (this.state === 'toss' && this.server === 0 && !this.toss.hit) {
      // judge the tap against the top of the toss, in time, forgiving input latency
      const lag = TAP_LAG * this.simScale();
      const vy = this.ball.v.y + GRAV * lag - GRAV * STROKES.serve.contact; // toss velocity when the strings arrive
      const te = Math.abs(vy) / GRAV;                    // seconds away from the apex
      const W = this.timing();
      const sw = SAVE.settings.assist === 'off' ? 1 : 1.35;   // Assist and Auto-run: a friendlier toss window
      let q = clamp(1 - Math.pow(te / (W.w * 2.2 * sw), 1.3), 0, 1);
      if (te <= W.p * 1.2 * sw) q = 1;
      if (this.ball.p.y < 1.95) q = Math.min(q, 0.25);
      // Assist and Auto-run: tapping too early on the way up holds the swing until the top
      if (SAVE.settings.assist !== 'off' && vy > 0 && q < 0.75) { if (!this.toss.queued) { UI.held(kind); Haptics.tap(0.25); } this.toss.queued = kind; return; }
      this.toss.hit = true;
      const label = q >= 1 || q > 0.6 ? null : vy > 0 ? 'EARLY' : 'LATE';
      if (label) UI.toast(label, q > 0.6 ? '#9be36b' : '#ff9a5a', H.char.pos, 2.6);
      this.serveSwing(H, kind, q);
      return;
    }
    if (this.state === 'live') { this.humanSwing(H, kind); UI.pressed(kind); }
  }

  /* ---------- timing windows (sim seconds) ---------- */
  simScale() { return this.cfg.demo ? SPEEDS.normal : (SPEEDS[SAVE.settings.speed] || 0.8); }
  timing() {
    const a = SAVE.settings.assist;
    return a === 'off' ? { w: 0.11, p: 0.032 } : a === 'auto' ? { w: 0.19, p: 0.055 } : { w: 0.17, p: 0.048 };
  }

  /* Timing is judged against one moment: the ball crossing the player's
     contact plane, an arm's length in front of the body toward the net.
     Returns that crossing (interpolated) or null if the ball dies first. */
  crossing(c) {
    const path = c.path; if (!path) return null;
    const ch = c.char, s = c.side;
    const zc = ch.pos.z - s * rigSpots().ahead + ch.vel.z * 0.06;
    let prev = null;
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (p.b >= 2) return null;
      if (prev && s * (prev.z - zc) < 0 && s * (p.z - zc) >= 0) {
        const u = (zc - prev.z) / (p.z - prev.z || 1e-6);
        return { t: path.t0 + lerp(prev.t, p.t, u), x: lerp(prev.x, p.x, u), y: lerp(prev.y, p.y, u), z: zc, b: p.b, vy: p.vy };
      }
      prev = p;
    }
    return null;
  }
  /* The ball's predicted state at absolute time t. */
  sampleAt(c, t) {
    const path = c.path; if (!path) return null;
    const lt = t - path.t0, dt = path.length > 1 ? path[1].t - path[0].t : 1 / 240;
    const i = Math.floor(lt / dt);
    if (i < 0 || i >= path.length - 1) return null;
    const a = path[i], b = path[i + 1], u = (lt - a.t) / dt;
    return { t, x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), b: b.b, vy: b.vy };
  }
  /* Can the racket meet the ball if contact happens at sample S? */
  contactOk(c, S) {
    if (!S || S.b >= 2) return 'gone';
    const pre = S.b === 0 && this.bounces === 0;
    if (pre && this.isServe) return 'bounce';
    if (S.z * c.side < 0.15) return 'far';
    if (pre ? S.y > 3.1 : S.y > 2.55) return 'high';
    if (S.y < (pre ? 0.25 : 0.08)) return 'low';
    const ch = c.char, ahead = clamp(S.t - this.time, 0, 0.12);
    const d = this.spotDist(c, S.x, S.z, ch.pos.x + ch.vel.x * ahead, ch.pos.z + ch.vel.z * ahead);
    if (d > (pre ? REACH_PRE : REACH) * (c.isAI ? 0.8 : 1)) return 'reach';
    return null;
  }
  /* Distance from a ball position to the nearer of the forehand and
     backhand contact spots of a player standing at (px,pz). */
  spotDist(c, x, z, px, pz) {
    const R = rigSpots(), ch = c.char, s = c.side;
    const fx = 0, fz = -s;                                   // toward the net
    const rx = -fz, rz = fx;                                 // the player's right when facing the net
    const hs = ch.fhSign;
    const a = Math.hypot(x - (px + rx * R.fh.lat * hs + fx * R.ahead), z - (pz + rz * R.fh.lat * hs + fz * R.ahead));
    const b = Math.hypot(x - (px - rx * R.bh.lat * hs + fx * R.ahead), z - (pz - rz * R.bh.lat * hs + fz * R.ahead));
    return Math.min(a, b);
  }
  strokeFor(c, p, pre) {
    const ch = c.char, right = ch.facingRight();
    const sideDot = ((p.x - ch.pos.x) * right.x + (p.z - ch.pos.z) * right.z) * ch.fhSign;
    const fh = sideDot >= -0.15;
    if (pre && p.y > 2.15) return 'smash';
    return pre ? (fh ? 'vf' : 'vb') : (fh ? 'fh' : 'bh');
  }

  /* The human swings the moment they tap. Contact happens SWING_T later
     (minus the forgiven input lag). How far that is from the ball reaching
     the contact plane sets the quality; early contact pulls the ball
     across the body, late contact pushes it and kills its depth. */
  humanSwing(c, kind, fromQueue = false) {
    if (c.swing && this.time < c.swing.endT) return;          // still mid-swing or recovering
    const incoming = this.hitter === 1 - c.i && this.bounces < 2;
    if (!incoming) return;                                    // our own ball is on its way out
    // Assist and Auto-run: an early tap is never wasted. It is held and the
    // swing fires by itself at the right moment (good, not perfect).
    const hold = SAVE.settings.assist !== 'off' && !fromQueue;
    if (!c.path) this.tracePath(c);
    const W = this.timing(), ch = c.char;
    const tC = Math.max(this.time + 0.02, this.time - TAP_LAG * this.simScale() + SWING_T);
    const X = this.crossing(c);
    const whiff = (label, cool) => {
      ch.strike('whiff', 1, 1);
      c.swing = { kind, stroke: 'whiff', whiff: true, struck: true, endT: this.time + cool };
      UI.toast(label, '#ff9a5a', ch.pos, 2.4); SFX.whoosh();
    };
    if (!X) return hold ? this.queueSwing(c, kind, 9) : whiff('MOVE IN', 0.3);
    const e = X.t - tC;                                       // + = swung early
    if (e > W.w) return hold ? this.queueSwing(c, kind, e) : whiff('TOO EARLY', 0.26);
    if (e < -W.w) return whiff('TOO LATE', 0.4);
    const S = this.sampleAt(c, tC);
    const bad = this.contactOk(c, S);
    if (bad && hold && e > 0.02 && (bad === 'bounce' || bad === 'reach' || bad === 'far')) return this.queueSwing(c, kind, e);
    if (bad) return whiff({ gone: 'TOO LATE', bounce: 'LET IT BOUNCE', far: 'TOO EARLY', high: 'TOO HIGH', low: 'TOO LOW', reach: 'OUT OF REACH' }[bad], 0.3);
    const pre = S.b === 0 && this.bounces === 0;
    const stroke = this.strokeFor(c, S, pre);
    ch.strike(stroke, S.y, STROKES[stroke].contact / Math.max(0.02, tC - this.time), S);
    if (c.queued) { c.queued = null; UI.held(null); }
    c.swing = { kind, stroke, tC, e, struck: false, endT: tC + 0.3 };
    if (fromQueue && c.queuedEarly > W.w * 1.6) c.swing.e = Math.max(e, W.p * 1.35);   // held taps land as GOOD
  }
  queueSwing(c, kind, early) {
    if (!c.queued) { UI.pressed(kind); UI.held(kind); Haptics.tap(0.25); }
    c.queued = { kind, t: this.time, early };
  }
  /* fire a held tap at the ideal moment (each physics step) */
  runQueue(c) {
    const q = c.queued; if (!q) return;
    if (this.state !== 'live' || this.hitter !== 1 - c.i || this.bounces >= 2 || this.time - q.t > 3) { c.queued = null; UI.held(null); return; }
    if (c.swing && this.time < c.swing.endT) return;
    if (!c.path) this.tracePath(c);
    const X = this.crossing(c); if (!X) return;
    if (X.t - SWING_T + TAP_LAG * this.simScale() - this.time > 0) return;
    c.queued = null; UI.held(null); c.queuedEarly = q.early;
    this.humanSwing(c, q.kind, true);
  }

  /* Called every physics substep for the human. */
  humanContactStep(c) {
    if (c.queued) this.runQueue(c);
    const sw = c.swing; if (!sw || sw.struck || this.time < sw.tC - 1e-6) return;
    sw.struck = true;
    const b = this.ball, ch = c.char;
    const rx = b.p.x - ch.pos.x, rz = b.p.z - ch.pos.z, dh = Math.hypot(rx, rz);
    const pre = this.bounces === 0;
    const okH = pre ? b.p.y > 0.25 && b.p.y < 3.2 : b.p.y > 0.08 && b.p.y < 2.6;
    const miss = this.stringsMiss(c);
    if (window.DBGC && miss > 0.45) { const A = ch.act; window.DBGC.push({ miss: +miss.toFixed(2), off: A && A.off ? +Math.hypot(A.off.x, A.off.z).toFixed(2) : null, yaw: +ch.yaw.toFixed(2), kind: A && A.kind }); }
    if (!this.canHit(c) || !okH || miss > 0.45) {
      sw.whiff = true; UI.toast('MISSED', '#ff9a5a', ch.pos, 2.4); SFX.whoosh(); return;
    }
    this.contact(c, sw.stroke, rx, rz, dh);
  }

  /* How far the strings will be from the ball at contact (metres). */
  stringsMiss(c) {
    const a = c.char.act, b = this.ball.p;
    if (!a || !a.head) return 0;
    return Math.hypot(a.head.x - b.x, a.head.y - b.y, a.head.z - b.z);
  }
  /* The drawn ball leaves from the strings, then eases onto the real flight. */
  ballFromStrings(c) {
    const a = c.char.act, b = this.ball.p;
    if (!a || !a.head) return;
    const bo = this.ballOff || (this.ballOff = { x: 0, y: 0, z: 0, k: 0 });
    bo.x = a.head.x - b.x; bo.y = a.head.y - b.y; bo.z = a.head.z - b.z; bo.k = 1;
    if (window.DBGC) window.DBGC.push({ who: c.isAI ? 'ai' : 'me', kind: a.kind, miss: +Math.hypot(bo.x, bo.y, bo.z).toFixed(3), step: +Math.hypot(a.off.x, a.off.z).toFixed(2), jump: +a.off.y.toFixed(2), dt: +(a.keyT - a.t).toFixed(3) });
  }

  humanMove(c, stick, dt) {
    const ch = c.char, st = SAVE.settings.assist;
    const speedScale = 0.82 + 0.18 * c.stamina;
    const charging = c.swing && !c.swing.struck;
    const incoming = this.state === 'live' && this.hitter === 1;
    let dvx = stick.x * ch.maxSpeed, dvz = stick.z * ch.maxSpeed;
    const plan = c.plan;
    if (incoming && plan && !plan.leave) {
      const dx = plan.stand.x - ch.pos.x, dz = plan.stand.z - ch.pos.z, d = Math.hypot(dx, dz);
      const tRem = Math.max(0.05, plan.t - this.time);
      const need = clamp(d / tRem * 1.25, 0, ch.maxSpeed);
      if (st === 'auto' && stick.mag < 0.2) { if (d > 0.08) { dvx = dx / d * need; dvz = dz / d * need; } else { dvx = dvz = 0; } }
      else if (st === 'assist' && stick.mag < 0.2 && this.isServe) {
        // serves are fast: start drifting toward the spot so a return is always possible
        if (d > 0.08) { const sp = Math.min(ch.maxSpeed * 0.8, need * 0.7); dvx = dx / d * sp; dvz = dz / d * sp; } else { dvx = dvz = 0; }
      }
      else if (st !== 'off' && stick.mag > 0.2 && d < 4.5) {
        // magnet: bend the run toward the sweet spot and brake on arrival
        const dot = (stick.x * dx + stick.z * dz) / (d + 1e-3);
        if (dot > 0.25 || d < 0.6) {
          const k = st === 'auto' ? 0.85 : 0.6;
          const tx = d > 0.05 ? dx / d * Math.min(ch.maxSpeed, d * 6) : 0, tz = d > 0.05 ? dz / d * Math.min(ch.maxSpeed, d * 6) : 0;
          dvx = lerp(dvx, tx, k); dvz = lerp(dvz, tz, k);
        }
      }
    } else if (st === 'auto' && stick.mag < 0.2 && this.state === 'live' && this.hitter === 0) {
      // auto recovery toward the middle of the baseline
      const tx = clamp(-this.ballLandX() * 0.25, -1.5, 1.5), tz = COURT.HL + 0.6;
      const dx = tx - ch.pos.x, dz = tz - ch.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { dvx = dx / d * Math.min(ch.maxSpeed * 0.7, d * 2); dvz = dz / d * Math.min(ch.maxSpeed * 0.7, d * 2); }
    }
    ch.drive(dvx, dvz, dt, (charging ? 0.6 : 1) * speedScale);
    ch.pos.z = clamp(ch.pos.z, 0.5, COURT.RZ - 0.6); ch.pos.x = clamp(ch.pos.x, -COURT.RX + 0.5, COURT.RX - 0.5);
  }
  humanPrep(c) {
    if (c.swing || this.state !== 'live' || this.hitter !== 1 - c.i) return;
    const X = this.crossing(c);
    if (X && X.t - this.time < 0.6) c.char.prep(this.strokeFor(c, X, X.b === 0 && this.bounces === 0));
  }
  ballLandX() { return this.lastTarget ? this.lastTarget.x : 0; }

  /* One guide only: a ring on the spot to stand. It shrinks onto your
     feet as the ball arrives and flashes gold at the moment to swing. */
  updateGuides(stick) {
    const v = this.view, H = this.human;
    v.landRing.material.opacity = 0; v.spotRing.material.opacity = 0; v.aimRing.material.opacity = 0;
    if (!SAVE.settings.guides) { v.timeRing.material.opacity = 0; if (this.state !== 'toss') UI.cue(null); return; }
    const pl = H.plan, cue = this.timingCue();
    // tap cue for rallies: the approach circle sits where the ball will be met
    if (this.state !== 'toss') {
      if (cue && cue.dt < 0.85 && cue.dt > -cue.W.w * 0.6) {
        const good = Math.abs(cue.dt) <= Math.max(cue.W.p * 1.6, cue.W.w * 0.35);
        UI.cue(cue.at.p || cue.at, Math.max(0, cue.dt) / 0.85, good);
        UI.tossMeter(clamp(1 - cue.dt / 0.85, 0, 1), good);
      } else { UI.cue(null); if (this.state === 'live') UI.tossMeter(0, false); }
    }
    if (this.hitter === 1 && pl && !pl.leave && pl.t > this.time - 0.2 && !(H.swing && !H.swing.whiff)) {
      const at = cue ? H.char.pos : pl.stand;
      let scale = 1.25, op = 0.28, col = 0xffffff;
      if (cue && cue.dt < 0.7) {
        const k = clamp(cue.dt / 0.7, 0, 1);
        scale = 0.95 + k * 1.3; op = 0.35 + (1 - k) * 0.45;
        if (Math.abs(cue.dt) <= cue.W.p) { col = 0xffd84d; op = 0.95; }
      }
      v.timeRing.material.color.setHex(col);
      v.ring(v.timeRing, at.x, at.z, op, scale);
    } else v.timeRing.material.opacity = Math.max(0, v.timeRing.material.opacity - 0.12);
  }

  /* ---------- the shared hitting model ---------- */
  canHit(c) {
    if (this.state !== 'live' || this.hitter === c.i || this.hitter < 0) return false;
    if (this.bounces >= 2) return false;
    if (this.isServe && this.bounces === 0) return false;           // must let the serve bounce
    if (this.ball.p.z * c.side < -0.15) return false;                // ball still on the other side
    return true;
  }
  /* Called every physics substep. Starts the strike animation just
     before closest approach and makes contact at closest approach. */
  tryContact(c) {
    if (!c.isAI) return this.humanContactStep(c);
    const sw = c.swing; if (!sw || sw.struck) return;
    if (!this.canHit(c)) return;
    if (!c.path) this.tracePath(c);
    const b = this.ball, ch = c.char;
    if (!sw.started) {
      const X = this.crossing(c);
      if (!X) return;
      const pre = X.b === 0 && this.bounces === 0;
      const kind = this.strokeFor(c, X, pre);
      if (sw.side !== kind) { ch.prep(kind); sw.side = kind; }
      const lead = STROKES[kind].contact || 0.1, tR = X.t - this.time;
      if (tR <= lead + 0.004) {
        if (this.contactOk(c, X)) { sw.struck = true; sw.missed = true; return; }
        sw.started = true; sw.anim = kind; sw.tC = X.t;
        ch.strike(kind, X.y, lead / Math.max(0.02, tR), X);
      }
      return;
    }
    if (this.time >= sw.tC - 1e-6) {
      const rx = b.p.x - ch.pos.x, rz = b.p.z - ch.pos.z, dh = Math.hypot(rx, rz);
      const pre = this.bounces === 0;
      const yOk = b.p.y > 0.1 && b.p.y < (pre ? 3.1 : 2.6);
      if (yOk && this.stringsMiss(c) < 0.5) this.contact(c, sw.anim, rx, rz, dh);
      else { sw.struck = true; sw.missed = true; }
    }
  }
  swingUpdate(c, dt) {
    const sw = c.swing; if (!sw) return;
    if (!c.isAI) { if (this.time > sw.endT) c.swing = null; return; }
    sw.t += dt;
    if (!sw.struck && !sw.started && !sw.side) { c.char.prep('fh'); sw.side = 'fh'; }
    if (!sw.struck && !sw.started && !this.canHit(c) && sw.t > 1.6 && this.hitter === c.i) { c.swing = null; c.char.act = null; }
    if (sw.struck && sw.t > 0.8) c.swing = null;
    if (sw.missed && !sw.whiffed) { sw.whiffed = true; if (!sw.started) c.char.strike('whiff'); }
  }

  contact(c, kind, rx, rz, dh) {
    const sw = c.swing, ch = c.char, b = this.ball;
    if (c.isAI && !sw.started) { ch.strike(kind, b.p.y); }
    sw.struck = true;
    this.ballFromStrings(c);
    // quality from position and height
    const right = ch.facingRight(); const fwd = { x: Math.sin(ch.yaw), z: Math.cos(ch.yaw) };
    const lat = Math.abs(rx * right.x + rz * right.z), along = rx * fwd.x + rz * fwd.z;
    const pre = this.bounces === 0;
    const idealH = pre ? 1.15 : 1.0;
    const R = rigSpots();
    const posErr = Math.hypot(lat - R.lat, (along - R.ahead) * 0.8);
    const hErr = Math.abs(b.p.y - idealH);
    const qPos = clamp(1 - posErr * 0.6 - Math.max(0, hErr - 0.2) * 0.55, 0, 1);
    let q = qPos, label, color, perfect = false, eN = 0;
    if (!c.isAI) {
      // timing is the heart of the human swing
      const W = this.timing();
      eN = clamp(sw.e / W.w, -1, 1);                           // + early, - late
      const qT = Math.abs(sw.e) <= W.p ? 1 : clamp(1 - Math.pow((Math.abs(sw.e) - W.p) / (W.w - W.p), 1.25), 0, 1);
      perfect = Math.abs(sw.e) <= W.p && qPos > 0.35;
      q = perfect ? 1 : clamp(qT * 0.72 + qPos * 0.28, 0, 1);
      if (perfect) { label = kind === 'smash' ? 'SMASH!' : 'PERFECT!'; color = '#ffd84d'; c.stats.perfect++; }
      else if (q > 0.7) { label = pre ? 'VOLLEY' : 'GREAT'; color = '#9be36b'; }
      else if (Math.abs(eN) > 0.45) { label = eN > 0 ? 'EARLY' : 'LATE'; color = '#ff9a5a'; }
      else if (q > 0.4) { label = 'GOOD'; color = '#cfe9a8'; }
      else { label = dh > 1.25 ? 'STRETCH' : b.p.y < 0.4 ? 'LOW' : 'RUSHED'; color = '#ff9a5a'; }
      c.lastTiming = { e: sw.e, eN, perfect };
    }
    if (c.isAI) {
      q = clamp(q * 0.6 + 0.4, 0, 1);
      // a long run means a rushed, defensive swing
      const run = c.runFrom ? Math.hypot(ch.pos.x - c.runFrom.x, ch.pos.z - c.runFrom.z) : 0;
      q *= 1 - clamp((run - 2.2) / 5, 0, 0.55);
      if (c.plan && c.plan.stretch) q *= 0.7;
    }
    const stick = c.isAI ? null : this.game.input.worldStick();
    const shotKind = sw.kind;
    const T = c.isAI ? this.aiShot(c, kind, q) : this.shotTarget(c, shotKind, stick, true, { kind, q, perfect, pre });
    if (!c.isAI && !T.drop) {
      // early contact pulls the ball across the body, late contact pushes it
      // toward the hitting side and robs it of pace and depth
      const hs = (kind === 'bh' || kind === 'vb' ? -1 : 1) * ch.fhSign;
      const hitSideX = right.x * hs;
      T.x += -hitSideX * eN * 2.4;
      if (eN < 0) { T.z += c.side * -eN * 1.6; if (T.speed) T.speed *= 1 - 0.22 * -eN; }
      else if (T.speed) T.z -= c.side * eN * 0.5;
    }
    // scatter
    const acc = c.isAI ? clamp(c.profile.accuracy * (this.cfg.diff ? this.cfg.diff.accuracy : 1), 0.1, 0.98) : 0.72;
    // incoming pace and spin make clean contact harder
    const inPace = clamp((Math.hypot(b.v.x, b.v.z) - 12) / 18, 0, 1);
    let sig = c.isAI
      ? 0.17 + (1 - q) * 1.0 + (1 - acc) * 1.0 + inPace * 0.25 + (c.plan && c.plan.stretch ? 0.35 : 0)
      : 0.14 + (1 - q) * 0.75 + inPace * 0.15 + (1 - c.stamina) * 0.3;
    if (perfect) sig *= 0.35;
    if (T.drop) sig *= 0.6;
    const tx = T.x + gauss() * sig, tz = T.z + gauss() * sig * 1.1;
    const p0 = { x: b.p.x, y: Math.max(b.p.y, 0.25), z: b.p.z };
    const minClear = T.minClear != null ? T.minClear : 0.3;
    if (b.p.y < 0.6) sig += (0.6 - b.p.y) * 0.8;               // scooping a low ball
    let sol = solveShot(p0, tx, tz, { speed: T.speed, top: T.top, side: T.side || 0, minClear, mode: T.mode, elev: T.elev });
    if (!sol) sol = solveShot(p0, tx * 0.6, -c.side * 8.5, { mode: 'lob', elev: 0.8, top: 60 });   // safe floater if the shot can't be made
    if (sol) { b.v.x = sol.v.x; b.v.y = sol.v.y; b.v.z = sol.v.z; b.w.x = sol.w.x; b.w.y = sol.w.y; b.w.z = sol.w.z; }
    // the occasional framed or netted ball: the swing path dips too low
    const netRisk = (c.isAI ? 0.05 + (1 - acc) * 0.12 + (1 - q) * 0.12 : (1 - q) * 0.12) + inPace * 0.03;
    if (!T.mode && Math.random() < netRisk) b.v.y -= rand(0.9, 2.2);
    b.rolling = false; b.netHit = false;
    this.lastTarget = { x: tx, z: tz };
    this.hitter = c.i; this.bounces = 0; this.isServe = false; this.letCord = false; this.lastHitT = this.time;
    this.rally++;
    UI.rally(this.rally);
    const pace = Math.hypot(b.v.x, b.v.y, b.v.z);
    const pw = pace / 30;
    SFX.hit(pw, perfect, shotKind);
    this.fx.impact(b.p.x, b.p.y, b.p.z, perfect ? 1 : c.isAI ? 0.35 : 0.3 + q * 0.4, this.game.camera);
    if (!c.isAI) {
      if (perfect || label === 'EARLY' || label === 'LATE') UI.toast(label, color, ch.pos, 2.9);
      UI.speed(Math.round(pace * 3.6)); c.stats.fastest = Math.max(c.stats.fastest, Math.round(pace * 3.6));
      // the feel of a clean strike: a sharp haptic, a few frames of hit-stop,
      // a camera kick and a flash on the ball
      const smash = kind === 'smash';
      Haptics.hit(clamp(0.3 + q * 0.45 + pw * 0.25, 0, 1), perfect || smash);
      this.game.hitStop(perfect ? (smash ? 0.11 : 0.085) : 0.03 + q * 0.02);
      this.game.punch(perfect ? 0.035 : 0.012 + q * 0.01);
      if (perfect) { this.view.hot = 1; this.game.shake(smash ? 0.25 : 0.12); }
    } else if (pw > 0.95) Haptics.tap(0.25);
    if (perfect || kind === 'smash') this.fx.puff(b.p.x, b.p.y, b.p.z, 0xfff6c8, 8, 1.6, 0.06);
    this.onHit(c);
  }

  /* Where the human wants the ball to go. */
  shotTarget(c, kind, stick, final, ctx = {}) {
    const s = c.side, ch = c.char, opp = this.P[1 - c.i];
    const lat = stick.mag > 0.25 ? stick.x : null;
    const depthIn = -stick.z * s;            // positive = pushing toward the opponent
    const q = ctx.q != null ? ctx.q : 0.7, perfect = ctx.perfect;
    const charge = clamp((q - 0.3) / 0.7, 0, 1);             // clean timing = a fuller swing
    let x, d, speed, top, mode = null, elev = null, minClear = 0.32, drop = false;
    const aimWidth = COURT.SW - 0.55;
    const defaultX = clamp(-ch.pos.x * 0.45, -2, 2) + (opp.char.pos.x > 0 ? -0.6 : 0.6);
    x = lat != null ? clamp(lat * 1.35, -1, 1) * aimWidth : defaultX;
    if (kind === 'lob') {
      mode = 'lob'; elev = perfect ? 0.72 : 0.86; d = depthIn < -0.4 ? 8.6 : 10.0; top = perfect ? 160 : 80; speed = 0; minClear = 0.6;
    } else if (kind === 'slice') {
      if (depthIn < -0.45) { drop = true; d = 2.4; speed = 9 + charge * 2; top = -230; minClear = 0.1; x = lat != null ? x * 0.8 : clamp(-opp.char.pos.x * 0.5, -2.5, 2.5); }
      else { d = depthIn > 0.4 ? 10.4 : 8.8; speed = 17 + charge * 4 + (perfect ? 2 : 0); top = -140; minClear = 0.16; }
    } else {
      d = depthIn > 0.4 ? 10.5 : depthIn < -0.4 ? 5.9 : 9.3;
      speed = 21 + charge * 8 + (perfect ? 4 : 0) + q * 2;
      top = 170 + charge * 60;
      if (depthIn < -0.4 && lat != null) x = Math.sign(lat) * (COURT.SW - 0.35);
    }
    if (ctx.pre) { // volleys and smashes
      if (ctx.kind === 'smash') { speed = 32 + charge * 4; top = 20; d = depthIn < -0.4 ? 6 : 8.5; minClear = 0.1; mode = null; }
      else if (kind !== 'lob') { speed = Math.min(speed, 17 + q * 5); top = -60; d = depthIn < -0.4 ? 4.5 : 8.6; minClear = 0.12; }
    }
    return { x, z: -s * d, speed, top, mode, elev, minClear, drop };
  }

  onHit(c) {
    if (this.cfg.tutorial && typeof TUT !== 'undefined') { if (c.i === 1) TUT.onServeIn(); else if (!this.isServe) TUT.onHumanReturn(); }
    // the other side plans its response
    const o = this.P[1 - c.i];
    o.plan = null; o.planAt = this.time + (o.isAI ? this.aiReaction(o) : 0);
    if (o.isAI) o.swing = null;
    c.plan = null; c.path = null;
    this.tracePath(o);
    if (!o.isAI || this.cfg.demo) this.planFor(o); // human guide/assist (or demo) plans right away
    if (c.isAI) c.recover = this.aiRecoverSpot(c); else c.recover = null;
    if (!this.isServe) for (const p of this.P) if (p !== c && Math.random() < 0.8) p.char.split = 1;
  }

  /* ---------- rules ---------- */
  onBallEvent(e) {
    const b = this.ball;
    if (e.type === 'bounce') {
      SFX.bounce(this.surf.id, e.vy);
      const col = this.surf.id === 'clay' ? 0xd27a4c : this.surf.id === 'grass' ? 0x8fbf5a : 0x9ab8d8;
      this.fx.puff(e.x, 0.05, e.z, col, this.surf.id === 'hard' ? 2 : 5, 0.9, 0.07);
      if (this.surf.id === 'clay') this.fx.mark(e.x, e.z, b.v.x, b.v.z);
      // chalk when the ball kisses a line
      const onLine = Math.abs(Math.abs(e.x) - COURT.SW) < 0.07 || Math.abs(Math.abs(e.z) - COURT.HL) < 0.09 || Math.abs(Math.abs(e.z) - COURT.SV) < 0.06;
      if (onLine && this.surf.id !== 'hard') this.fx.puff(e.x, 0.05, e.z, 0xffffff, 7, 0.8, 0.06);
      if (this.state === 'live') this.ruleBounce(e.x, e.z);
    } else if (e.type === 'net') { SFX.net(); if (this.state === 'live') this.netTouched = true; }
    else if (e.type === 'cord') { SFX.cord(); if (this.state === 'live') { if (this.isServe) this.letCord = true; UI.flash('NET CORD'); this.replanAfterCord(); } }
  }
  ruleBounce(x, z) {
    const halfOf = z > 0 ? 0 : 1;
    const h = this.hitter, r = 1 - h;
    if (h < 0) return;
    if (this.bounces === 0) {
      if (halfOf === h) { return this.isServe ? this.serveFault(0, 'NET') : this.ballFault(h, 'NET', 0); }
      if (this.isServe) {
        const bs = this.boxSign();
        const x0 = bs > 0 ? 0 : -COURT.SW, x1 = bs > 0 ? COURT.SW : 0;
        const zs = this.P[r].side;
        const z0 = zs > 0 ? 0 : -COURT.SV, z1 = zs > 0 ? COURT.SV : 0;
        const m = Math.min(x - (x0 - BALL_R), (x1 + BALL_R) - x, z - (z0 - BALL_R), (z1 + BALL_R) - z);
        if (m < 0) { this.view.ring(this.view.outRing, x, z, 0.9, 1); return this.serveFault(-m); }
        if (this.letCord) { return this.callLet(); }
        if (this.serveNum === 1) this.P[h].stats.firstIn++;
      } else {
        const zs = this.P[r].side;
        const m = lineMargin(x, z, COURT.SW, zs > 0 ? 0 : -COURT.HL, zs > 0 ? COURT.HL : 0);
        if (m < 0) { this.view.ring(this.view.outRing, x, z, 0.9, 1); return this.ballFault(h, 'OUT', -m); }
        if (m < 0.06) UI.flash('ON THE LINE');
      }
      this.bounces = 1;
    } else {
      this.bounces = 2;
      const ace = this.isServe;
      if (ace) this.P[h].stats.aces++; else this.P[h].stats.winners++;
      this.pointTo(h, ace ? 'ACE' : 'WINNER');
    }
  }
  ballFault(h, why, by) {
    this.P[h].stats.errors++;
    const cm = Math.round(by * 100);
    const detail = why === 'OUT' ? (cm < 100 ? `OUT BY ${Math.max(1, cm)} CM` : 'OUT') : 'INTO THE NET';
    this.pointTo(1 - h, why, detail);
  }
  serveFault(by, why) {
    const sv = this.P[this.server];
    if (this.serveNum === 1) {
      this.serveNum = 2;
      UI.callout('Fault', why === 'NET' ? 'INTO THE NET' : `LONG / WIDE BY ${Math.max(1, Math.round(by * 100))} CM`);
      Umpire.say('Fault');
      this.state = 'dead'; this.stateT = 0.9; this.faultPending = true;
      this.P[1 - this.server].char.split = 0.6;
    } else {
      sv.stats.df++;
      this.serveNum = 1;
      this.pointTo(1 - this.server, 'DOUBLE FAULT', 'DOUBLE FAULT', true);
    }
  }
  callLet() {
    UI.callout('Let', 'REPLAY THE SERVE'); Umpire.say('Let. ' + (this.serveNum === 1 ? 'First service' : 'Second service'));
    this.state = 'dead'; this.stateT = 0.9; this.faultPending = true;
  }
  replanAfterCord() { for (const c of this.P) if (c.i !== this.hitter) { c.plan = null; c.planAt = this.time + 0.05; this.tracePath(c); if (!c.isAI) { this.planFor(c); if (c.swing && !c.swing.struck) c.swing = null; } else if (c.swing && !c.swing.started) c.swing = null; } }
  /* The exact future of the ball, sampled finely, for the human's timing. */
  tracePath(c) { const p = predictPath(this.ball, this.surf, 3.2, 1 / 240, 2); p.t0 = this.time; c.path = p; }

  /* How close the human is to the ideal tap moment, for the guide ring and
     the button ring. Returns null when there is nothing to hit. */
  timingCue() {
    const H = this.human;
    if (this.state !== 'live' || this.hitter !== 1 || !H.path) return null;
    if (H.swing && !H.swing.whiff && !H.swing.struck) return null;
    const X = this.crossing(H);
    if (!X || this.contactOk(H, X)) return null;
    const tapAt = X.t - SWING_T + TAP_LAG * this.simScale();
    return { dt: tapAt - this.time, W: this.timing(), at: X };
  }

  pointTo(w, kind, detail, df) {
    if (this.state !== 'live') return;
    if (this.cfg.tutorial) {
      // practice: nothing is scored, the player serves again
      this.state = 'dead'; this.stateT = 0.6; this.faultPending = false; this.serveNum = 1;
      UI.callout(w === 0 ? 'Nice' : 'Again', kind === 'OUT' || kind === 'NET' ? (detail || kind) : kind);
      if (typeof TUT !== 'undefined') TUT.onPoint(w, kind);
      if (window.DBG) window.DBG.push({ w, kind, detail });
      return;
    }
    this.state = 'dead'; this.stateT = 0; this.faultPending = false;
    if (!df) this.serveNum = 1;
    const l = 1 - w, W = this.P[w], L = this.P[l];
    W.stats.points++;
    this.longest = Math.max(this.longest, this.rally);
    const before = { g: this.score.g.slice(), sets: this.score.won.slice() };
    const res = this.addPoint(w);
    if (window.DBG) window.DBG.push({ w, kind, detail, rally: this.rally, serveNum: this.serveNum, score: this.scoreCall(res) });
    // reactions
    const big = this.rally >= 8 || kind === 'ACE' || res.game;
    // the winner reacts (a fist pump, or arms up on a big point); the loser
    // slumps after a winner against them, or slaps the air after an error
    if (big || Math.random() < 0.6) W.char.celebrate(res.game || (kind === 'ACE' && Math.random() < 0.5) ? 'raise' : 'pump');
    const err = kind === 'OUT' || kind === 'NET' || kind === 'DOUBLE FAULT';
    if (err ? Math.random() < 0.7 : Math.random() < 0.45) L.char.deject(err && Math.random() < 0.5 ? 'frustrate' : 'slump');
    const crowd = this.game.club.crowd;
    const intensity = clamp(0.35 + this.rally * 0.07 + (res.game ? 0.3 : 0) + (kind === 'ACE' ? 0.3 : 0), 0.3, 1.4);
    // winners and aces get proper applause; errors get a polite one,
    // and an error after a long rally gets a groan and a lean forward
    if (err && this.rally > 5) { crowd.ooh(); SFX.ooh(); setTimeout(() => { if (this.game.club) this.game.club.crowd.cheer(intensity * 0.55); }, 650); }
    else crowd.cheer(err ? intensity * 0.5 : intensity);
    SFX.applause(err ? intensity * 0.6 : intensity);
    SFX.chime(w === 0 && !this.cfg.demo);
    if (!this.cfg.demo && w === 0 && (res.game || kind === 'ACE')) Haptics.notify('success');
    // callout
    const small = kind === 'WINNER' ? (this.rally > 1 ? `WINNER · ${this.rally} SHOT RALLY` : 'WINNER') : kind === 'ACE' ? `ACE · ${this.serveKmh} KM/H` : (detail || kind);
    let big1 = this.scoreCall(res);
    UI.callout(big1, small);
    Umpire.say(this.spokenCall(res));
    UI.scoreboard(this);
    if (res.match) { this.finish(res.match - 1); }
  }

  addPoint(w) {
    const s = this.score, l = 1 - w, res = { game: false, set: false, match: 0, winner: w };
    s.p[w]++;
    const need = s.tb ? 7 : 4;
    if (s.p[w] >= need && s.p[w] - s.p[l] >= 2) {
      res.game = true; s.g[w]++; s.p = [0, 0];
      const wasTB = s.tb;
      const N = this.format.games;
      if ((s.g[w] >= N && s.g[w] - s.g[l] >= 2) || wasTB) {
        res.set = true; s.sets.push(s.g.slice()); s.won[w]++; s.g = [0, 0]; s.tb = false;
        if (s.won[w] > this.format.sets / 2) res.match = w + 1;
        this.server = wasTB ? 1 - s.tbStart : 1 - this.server;
      } else {
        this.server = 1 - this.server;
        if (s.g[0] === N && s.g[1] === N) { s.tb = true; s.tbStart = this.server; }
      }
    }
    return res;
  }
  pointLabel(i) {
    const s = this.score, o = 1 - i;
    if (s.tb) return String(s.p[i]);
    if (s.p[0] >= 3 && s.p[1] >= 3) return s.p[i] === s.p[o] ? '40' : s.p[i] > s.p[o] ? 'AD' : '40';
    return POINT_SHORT[Math.min(3, s.p[i])];
  }
  scoreCall(res) {
    const s = this.score;
    if (res.match) return 'Game, set, match';
    if (res.set) return `Set ${this.P[res.winner].short === 'YOU' ? 'to you' : this.P[res.winner].name.split(' ')[0]}`;
    if (res.game) return `Game ${this.P[res.winner].short === 'YOU' ? 'to you' : this.P[res.winner].name.split(' ')[0]}`;
    if (s.tb) return `${s.p[this.server]} – ${s.p[1 - this.server]}`;
    const sv = this.server, rv = 1 - sv;
    if (s.p[0] >= 3 && s.p[1] >= 3) { if (s.p[0] === s.p[1]) return 'Deuce'; const a = s.p[0] > s.p[1] ? 0 : 1; return a === 0 && !this.cfg.demo ? 'Advantage you' : `Advantage ${this.P[a].name.split(' ')[0]}`; }
    const a = s.p[sv], b = s.p[rv];
    if (a === b) return `${POINT_SHORT[a] === '0' ? 'Love' : POINT_SHORT[a]} all`;
    return `${a === 0 ? 'Love' : POINT_SHORT[a]} – ${b === 0 ? 'Love' : POINT_SHORT[b]}`;
  }
  spokenCall(res) {
    const s = this.score, nm = i => (this.P[i].short === 'YOU' ? 'Rowe' : this.P[i].name.split(' ')[1] || this.P[i].name);
    if (res.match) return `Game, set and match, ${nm(res.winner)}.`;
    if (res.set) return `Game and set, ${nm(res.winner)}.`;
    if (res.game) return `Game, ${nm(res.winner)}.`;
    if (s.tb) return `${s.p[this.server]}, ${s.p[1 - this.server]}`;
    const sv = this.server, rv = 1 - sv;
    if (s.p[0] >= 3 && s.p[1] >= 3) { if (s.p[0] === s.p[1]) return 'Deuce'; return `Advantage, ${nm(s.p[0] > s.p[1] ? 0 : 1)}`; }
    const a = s.p[sv], b = s.p[rv];
    if (a === b) return `${POINT_WORDS[a]} all`;
    return `${POINT_WORDS[a]}, ${POINT_WORDS[b]}`;
  }
  nextPoint() {
    if (this.over) return;
    this.fx.clearMarks();
    for (const c of this.P) c.char.clearMood();
    for (const r of [this.view.outRing, this.view.aimRing, this.view.landRing, this.view.spotRing, this.view.timeRing]) r.material.opacity = 0;
    if (this.faultPending) { this.faultPending = false; }
    this.placeForPoint(false);
  }
  finish(winner) {
    this.over = true; this.state = 'over';
    this.P[winner].char.celebrate('raise'); this.P[1 - winner].char.deject('slump');
    setTimeout(() => this.game.matchOver(this, winner), 2600);
  }
  onStep(c) {
    const ch = c.char, sp = Math.hypot(ch.vel.x, ch.vel.z);
    if (sp > 3 && Math.random() < 0.5) {
      if (this.surf.id === 'clay') this.fx.puff(ch.pos.x, 0.05, ch.pos.z, 0xd27a4c, 2, 0.5, 0.08);
      if (!this.cfg.demo && c.i === 0) SFX.step(this.surf.id);
    }
  }

  /* =================== AI =================== */
  aiReaction(c) { const d = this.cfg.diff ? this.cfg.diff.reaction : 1; return ((c.profile.reaction || 0.18) * d + (this.isServe ? 0.1 : 0)) * rand(0.8, 1.25); }
  aiSpeed(c) { const d = this.cfg.diff ? this.cfg.diff.speed : 1; return (c.profile.speed || 6) * (c.isAI && c.i === 1 ? d : 1); }

  /* Plan an interception: simulate the ball, then pick the reachable
     contact point closest to ideal height. Shared by AI and the guides. */
  planFor(c) {
    const ch = c.char, s = c.side;
    const path = predictPath(this.ball, this.surf, 3.2, 1 / 120, 2);
    const fb = firstBounce(path);
    const plan = { stand: { x: ch.pos.x, z: ch.pos.z }, t: this.time + 1, leave: false, land: fb ? { x: fb.x, z: fb.z } : null, landT: fb ? this.time + fb.t : this.time };
    // judge out balls
    if (fb && this.bounces === 0 && !this.isServe) {
      const m = lineMargin(fb.x, fb.z, COURT.SW, s > 0 ? 0 : -COURT.HL, s > 0 ? COURT.HL : 0);
      const inOwnHalf = fb.z * s > 0;
      if (inOwnHalf && m < -0.05 && c.isAI && Math.random() < (c.profile.judge || 0.6)) { plan.leave = true; c.plan = plan; return plan; }
    }
    const speed = (c.isAI ? this.aiSpeed(c) * 0.88 : ch.maxSpeed * 0.95);
    const right = { x: -Math.cos(s > 0 ? Math.PI : 0), z: 0 };
    const fhx = (s > 0 ? 1 : -1) * ch.fhSign;  // world x sign of the forehand side
    let best = null, bestScore = -1e9, fallback = null, fbScore = 1e9;
    const atNet = Math.abs(ch.pos.z) < 7;
    for (let i = 4; i < path.length; i += 2) {
      const p = path[i];
      if (p.z * s < 0.4) continue;
      if (p.b >= 2) break;
      const pre = p.b === 0;
      if (pre) {
        if (this.isServe && this.bounces === 0) continue;
        if (!(p.y > 0.35 && p.y < 2.9)) continue;
        if (Math.abs(p.z) > 9 && !atNet) continue;
      } else if (!(p.y > 0.28 && p.y < 2.2)) continue;
      if (Math.abs(p.z) > COURT.RZ - 1.2) continue;
      for (const sideSign of [1, -1]) {
        const R = rigSpots();
        const off = (sideSign > 0 ? R.fh.lat : R.bh.lat) * fhx * sideSign;
        const stand = { x: p.x - off, z: p.z + s * R.ahead };
        const d = Math.hypot(stand.x - ch.pos.x, stand.z - ch.pos.z);
        const tt = p.t - 0.06 - (c.isAI ? 0.2 : 0);
        const slack = speed * tt + 0.25 - d;
        let score = -Math.abs(p.y - (pre ? 1.2 : 1.0)) * 2.2 - (sideSign < 0 ? 0.25 : 0);
        if (!pre && Math.abs(p.vy) < 1.6) score += 0.7;          // ball at the top of the bounce
        if (Math.abs(p.z) > COURT.HL + 2.5) score -= (Math.abs(p.z) - COURT.HL - 2.5) * 0.8;
        if (c.isAI) score += (c.profile.aggression || 0.4) * (pre ? 0.3 : 0) - p.t * 0.25;
        if (slack >= 0) { if (score > bestScore) { bestScore = score; best = { stand, t: this.time + p.t, p, side: sideSign }; } }
        else if (-slack < fbScore) { fbScore = -slack; fallback = { stand, t: this.time + p.t, p, side: sideSign, stretch: true }; }
      }
    }
    const pk = best || fallback;
    c.runFrom = { x: ch.pos.x, z: ch.pos.z };
    if (pk) { plan.stand = pk.stand; plan.t = pk.t; plan.p = pk.p; plan.stretch = !!pk.stretch; }
    c.plan = plan;
    return plan;
  }
  aiMove(c, dt) {
    const ch = c.char; ch.maxSpeed = this.aiSpeed(c);
    if (this.state === 'dead') { ch.drive(0, 0, dt, 0.5); return; }
    const incoming = this.hitter === 1 - c.i;
    if (incoming) {
      if (!c.plan && this.time >= (c.planAt || 0)) this.planFor(c);
      const pl = c.plan;
      if (pl && !pl.leave) {
        const dx = pl.stand.x - ch.pos.x, dz = pl.stand.z - ch.pos.z, d = Math.hypot(dx, dz);
        const tRem = Math.max(0.04, pl.t - this.time - 0.05);
        const need = Math.min(ch.maxSpeed, d / tRem * 1.15 + (d > 0.4 ? 0.6 : 0));
        if (d > 0.06) ch.drive(dx / d * need, dz / d * need, dt); else ch.drive(0, 0, dt);
        // arm the swing a moment before the ball arrives
        if (!c.swing && pl.t - this.time < 0.65) c.swing = { kind: 'top', t: 0.25 + c.profile.power * 0.3, struck: false, side: null };
      } else if (pl && pl.leave) {
        ch.drive(0, 0, dt);
        if (!c.saidOut && this.bounces === 0) { c.saidOut = true; }
      } else ch.drive(0, 0, dt);
    } else {
      c.saidOut = false;
      const rec = c.recover;
      if (rec) {
        const dx = rec.x - ch.pos.x, dz = rec.z - ch.pos.z, d = Math.hypot(dx, dz);
        const sp = Math.min(ch.maxSpeed * (rec.rush ? 1 : 0.8), d * 2.6);
        if (d > 0.1) ch.drive(dx / d * sp, dz / d * sp, dt); else ch.drive(0, 0, dt);
      } else ch.drive(0, 0, dt);
    }
    // keep inside their half
    ch.pos.z = c.side > 0 ? clamp(ch.pos.z, 0.6, COURT.RZ - 0.6) : clamp(ch.pos.z, -COURT.RZ + 0.6, -0.6);
    ch.pos.x = clamp(ch.pos.x, -COURT.RX + 0.5, COURT.RX - 0.5);
  }
  aiRecoverSpot(c) {
    const s = c.side, tgt = this.lastTarget || { x: 0, z: 0 };
    if (c.rushing) return { x: clamp(tgt.x * 0.45, -2.2, 2.2), z: s * 3.4, rush: true };
    return { x: clamp(tgt.x * 0.3, -1.6, 1.6), z: s * (COURT.HL + 0.7) };
  }
  /* Shot selection for the AI. Returns a target in world space. */
  aiShot(c, kind, q) {
    const pr = c.profile, s = c.side, ch = c.char, opp = this.P[1 - c.i].char;
    const dif = this.cfg.diff || DIFFICULTY.normal;
    const pw = clamp(pr.power * dif.power, 0, 1.2);
    const oppAtNet = Math.abs(opp.pos.z) < 6.5;
    const oppX = opp.pos.x;
    const away = -Math.sign(oppX || rand(-1, 1));
    const margin = lerp(1.7, 0.55, clamp(pr.accuracy * dif.accuracy * (0.6 + pr.aggression * 0.6), 0, 1));
    const stretched = c.plan && c.plan.stretch;
    let T;
    c.rushing = false;
    if (kind === 'smash') T = { x: away * (COURT.SW - margin), z: -s * 8, speed: 30 + pw * 5, top: 20, minClear: 0.1 };
    else if (oppAtNet && Math.random() < 0.25 + pr.lob) T = { x: rand(-1.5, 1.5), z: -s * 10, mode: 'lob', elev: 0.8, top: 120, minClear: 0.8 };
    else if (oppAtNet) T = { x: away * (COURT.SW - margin * 0.8), z: -s * 7.5, speed: 22 + pw * 6, top: 250, minClear: 0.15 };
    else if (stretched || q < 0.35) T = Math.random() < 0.5 ? { x: rand(-1.2, 1.2), z: -s * 10, mode: 'lob', elev: 0.82, top: 60, minClear: 0.8 } : { x: rand(-1.5, 1.5), z: -s * 9.6, speed: 16, top: -120, minClear: 0.35 };
    else if (Math.abs(opp.pos.z) > 12 && Math.abs(ch.pos.z) < 9.5 && Math.random() < pr.drop) T = { x: rand(-2.6, 2.6), z: -s * 2.6, speed: 9.5, top: -230, minClear: 0.12, drop: true };
    else if (kind === 'vf' || kind === 'vb') T = { x: away * (COURT.SW - margin), z: -s * (Math.random() < 0.4 ? 5 : 8.8), speed: 16 + pw * 6, top: -60, minClear: 0.12 };
    else {
      const attack = Math.random() < pr.aggression;
      const x = attack ? away * (COURT.SW - margin) : clamp(rand(-1.8, 1.8) - oppX * 0.3, -2.4, 2.4);
      const depth = lerp(8.4, 10.6, clamp(pr.accuracy * dif.accuracy * 0.8 + rand(-0.2, 0.2), 0, 1));
      const slice = Math.random() < (this.ball.p.y < 0.6 ? 0.45 : 0.15);
      T = slice ? { x, z: -s * depth, speed: 16 + pw * 4, top: -150, minClear: 0.2 }
        : { x, z: -s * depth, speed: lerp(19, 33, pw) * (0.8 + q * 0.3) * (attack ? 1.08 : 0.92), top: 160 + pw * 90, minClear: 0.32 };
      // approach the net on a short ball
      if (Math.abs(ch.pos.z) < 8.5 && Math.random() < pr.net * 1.4) c.rushing = true;
    }
    if (this.isServe === false && Math.abs(ch.pos.z) < 5) c.rushing = true;
    return T;
  }
}
