/* =====================================================================
   GAME: renderer, lights, time of day, camera framing, input (touch
   joystick, buttons, keyboard, gamepad), the main loop and screens.
   ===================================================================== */
/* Time of day: warm sun from the upper left against a cool sky, like a
   model photographed in a sunny studio. fog = haze on things far below. */
const TOD = {
  day:   { skyP: [0xf3efe4, 0xdde5e2, 0xbccdd3], sky: 'radial-gradient(120% 90% at 12% 8%,#f3efe4 0%,#e6eae4 30%,#d2dcdc 62%,#bccdd3 100%)', fog: 0xd8e0de, sun: 0xfff3e2, sunI: 2.6, sunPos: [-22, 30, 10], hemiSky: 0xdde6ee, hemiGround: 0x6a5a40, hemiI: 1.2, flood: 0, glow: 0x8a96a0, halo: 0, amb: 'bird', exp: 1.0 },
  dusk:  { skyP: [0xf4cc9c, 0xd8b8ac, 0x8f96b6], sky: 'radial-gradient(120% 90% at 10% 10%,#f4cc9c 0%,#e6c0aa 30%,#c4aeb4 60%,#8f96b6 100%)', fog: 0xc8b2ac, sun: 0xffc896, sunI: 2.2, sunPos: [-32, 14, -2], hemiSky: 0xe2d2cc, hemiGround: 0x4b4438, hemiI: 1.0, flood: 18, glow: 0xffe2a8, halo: 0.55, amb: 'bird', exp: 1.02 },
  night: { skyP: [0x34456a, 0x1c2a46, 0x0c1424], sky: 'radial-gradient(120% 90% at 15% 10%,#2b3a5c 0%,#1a2742 45%,#0e1628 100%)', fog: 0x1a2438, sun: 0x9db6e8, sunI: 0.5, sunPos: [-12, 30, 16], hemiSky: 0x4a5c80, hemiGround: 0x1d2418, hemiI: 0.55, flood: 55, glow: 0xfff0c8, halo: 1, amb: 'cricket', exp: 1.05 }
};
const STEP = 1 / 120;
const CAMS = {
  diorama: { yaw: 0.62, pitch: 0.6 },
  low:     { yaw: 0.98, pitch: 0.46 },
  behind:  { yaw: 0.06, pitch: 0.78 }
};

/* =====================================================================
   POST: one full-screen pass that turns the render into a miniature:
   tilt-shift blur away from the focus band, a painted sky behind the
   island, a touch of contrast, saturation and vignette. Rendered into a
   4x MSAA target. Switched off automatically on slow devices.
   ===================================================================== */
class Post {
  constructor(renderer) {
    this.r = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture }, res: { value: new THREE.Vector2(1, 1) },
        focusY: { value: 0.5 }, focusW: { value: 0.22 }, blur: { value: 2.5 },
        skyA: { value: new THREE.Color() }, skyB: { value: new THREE.Color() }, skyC: { value: new THREE.Color() }, skyO: { value: new THREE.Vector2(0.12, 0.92) },
        vig: { value: 0.2 }, sat: { value: 0.9 }, con: { value: 0.98 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 res; uniform float focusY, focusW, blur, vig, sat, con;
        uniform vec3 skyA, skyB, skyC; uniform vec2 skyO; varying vec2 vUv;
        const int N = 12;
        void main(){
          float d = abs(vUv.y - focusY) - focusW;
          float rad = clamp(d / 0.25, 0.0, 1.0); rad = rad * rad * blur;
          vec4 acc = texture2D(tDiffuse, vUv); float wsum = 1.0;
          if (rad > 0.05) {
            for (int i = 0; i < N; i++) {
              float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / float(N)) * rad;
              vec2 o = vec2(cos(a), sin(a)) * rr / res;
              acc += texture2D(tDiffuse, vUv + o); wsum += 1.0;
            }
          }
          vec4 c = acc / wsum;
          vec3 rgb = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);
          gl_FragColor = vec4(rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          vec3 col = gl_FragColor.rgb;
          // grade: gentle contrast and saturation, the look of a sunny model shot
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, sat);
          col = (col - 0.5) * con + 0.5;
          col *= vec3(1.035, 1.0, 0.95);          // warm studio light
          // painted sky behind the island
          vec2 q = (vUv - skyO) * vec2(res.x / res.y, 1.0);
          float g = clamp(length(q) / 1.35, 0.0, 1.0);
          vec3 sky = g < 0.45 ? mix(skyA, skyB, g / 0.45) : mix(skyB, skyC, (g - 0.45) / 0.55);
          col = mix(sky, col, clamp(c.a, 0.0, 1.0));
          vec2 v = vUv - 0.5; col *= 1.0 - vig * dot(v, v) * 1.6;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false, toneMapped: true
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h, pr) { this.rt.setSize(Math.round(w * pr), Math.round(h * pr)); this.mat.uniforms.res.value.set(w * pr, h * pr); }
  /* sky colours are sRGB hex, used after tone mapping, so pass them raw */
  setSky(a, b, c) { const U = this.mat.uniforms; for (const [k, v] of [['skyA', a], ['skyB', b], ['skyC', c]]) U[k].value.setRGB(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, THREE.LinearSRGBColorSpace); }
  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.qScene, this.qCam);
  }
}

class Input {
  constructor(game) {
    this.game = game; this.sx = 0; this.sy = 0; this.keys = {}; this.pad = null; this.stickId = null;
    const zone = $('stickzone'), stick = $('stick'), knob = $('knob');
    this.home = () => { const r = zone.getBoundingClientRect(); stick.style.left = (r.left + 86) + 'px'; stick.style.top = (r.bottom - 96) + 'px'; stick.style.position = 'fixed'; };
    this.home();
    const R = 46;
    const move = (x, y) => {
      let dx = x - this.cx, dy = y - this.cy; const d = Math.hypot(dx, dy);
      if (d > R) { // let the base follow a dragging thumb
        this.cx += dx - dx / d * R; this.cy += dy - dy / d * R; stick.style.left = this.cx + 'px'; stick.style.top = this.cy + 'px';
        dx = x - this.cx; dy = y - this.cy;
      }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const m = Math.min(1, Math.hypot(dx, dy) / R); const a = Math.atan2(dy, dx);
      const mm = m < 0.12 ? 0 : (m - 0.12) / 0.88;
      this.sx = Math.cos(a) * mm; this.sy = Math.sin(a) * mm;
    };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); SFX.unlock();
      if (this.stickId !== null) return;
      this.stickId = e.pointerId; zone.setPointerCapture(e.pointerId);
      this.cx = e.clientX; this.cy = e.clientY; stick.style.left = this.cx + 'px'; stick.style.top = this.cy + 'px';
      stick.classList.add('active'); move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === this.stickId) move(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== this.stickId) return; this.stickId = null; this.sx = this.sy = 0; knob.style.transform = ''; stick.classList.remove('active'); this.home(); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
    document.querySelectorAll('.shot').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); SFX.unlock(); game.press(b.dataset.shot); }));
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyJ') { e.preventDefault(); game.press('top'); }
      else if (e.code === 'KeyK') game.press('slice');
      else if (e.code === 'KeyL') game.press('lob');
      else if (e.code === 'Escape' || e.code === 'KeyP') game.togglePause();
      SFX.unlock();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('resize', () => this.home());
    this.padPrev = {};
  }
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const map = { 0: 'top', 2: 'slice', 3: 'lob', 1: 'slice' };
      for (const k in map) { const pr = p.buttons[k] && p.buttons[k].pressed; if (pr && !this.padPrev[k]) this.game.press(map[k]); this.padPrev[k] = pr; }
      const st = p.buttons[9] && p.buttons[9].pressed; if (st && !this.padPrev.st) this.game.togglePause(); this.padPrev.st = st;
      this.pad = { x: Math.abs(p.axes[0]) > 0.15 ? p.axes[0] : 0, y: Math.abs(p.axes[1]) > 0.15 ? p.axes[1] : 0 };
      return;
    }
    this.pad = null;
  }
  screenStick() {
    let x = this.sx, y = this.sy;
    const k = this.keys;
    const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; }
    if (this.pad && (this.pad.x || this.pad.y)) { x = this.pad.x; y = this.pad.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } }
    return { x, y };
  }
  /* Screen-relative stick mapped onto the court plane. */
  worldStick() {
    const s = this.screenStick(), g = this.game;
    const wx = g.camRight.x * s.x - g.camFwd.x * s.y, wz = g.camRight.z * s.x - g.camFwd.z * s.y;
    return { x: wx, z: wz, mag: Math.hypot(s.x, s.y) };
  }
}

class Game {
  constructor() {
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd6dfe4, 96, 150);
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.camRight = new THREE.Vector3(1, 0, 0); this.camFwd = new THREE.Vector3(0, 0, -1); this.camDir = new THREE.Vector3();
    this.camTarget = new THREE.Vector3(); this.zoom = 1; this.shakeAmt = 0;
    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.2); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 140;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04; this.sun.shadow.radius = 3;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.post = new Post(this.renderer);
    this.input = new Input(this);
    this.club = null; this.match = null; this.paused = false; this.mode = 'title';
    this.last = performance.now(); this.t = 0; this.ambT = 0; this.acc = 0; this.stopT = 0; this.punchAmt = 0; this.resScale = 1;
    this.applySettings();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (this.mode === 'play' && !this.paused) UI.pause(); if (SFX.ctx) SFX.ctx.suspend(); } else if (SFX.ctx) SFX.ctx.resume(); });
    this.bindMenu();
    this.toTitle();
    this.loop();
  }
  bindMenu() {
    const unlockAnd = f => () => { SFX.unlock(); SFX.click(); f(); };
    $('m-career').onclick = unlockAnd(() => UI.career());
    $('m-quick').onclick = unlockAnd(() => UI.quick());
    $('m-how').onclick = unlockAnd(() => UI.how());
    $('m-settings').onclick = unlockAnd(() => UI.settings());
    $('btn-pause').onclick = () => { SFX.click(); this.togglePause(); };
    $('btn-cam').onclick = () => { SFX.click(); const k = Object.keys(CAMS); SAVE.settings.cam = k[(k.indexOf(SAVE.settings.cam) + 1) % k.length]; persist(); this.resize(); UI.flash('CAMERA · ' + SAVE.settings.cam.toUpperCase()); };
    $('sheet').addEventListener('pointerdown', e => { if (e.target === $('sheet') && !this.paused && this.mode !== 'results') UI.close(); });
  }
  applySettings() {
    const s = SAVE.settings;
    SFX.enabled = s.sfx; SFX.setAmbience(this.mode === 'play' ? 0.05 : 0.025);
    const low = s.quality === 'low';
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : (window.__DPR_MAX || 2));
    if (this.renderer.shadowMap.enabled === low) { this.renderer.shadowMap.enabled = !low; this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
    this.pixelRatio = (s.pixel === 0 ? dpr : s.pixel === 1 ? Math.max(1, dpr * 0.5) : 0.5) * (this.resScale || 1);
    $('gl').classList.toggle('pixel', s.pixel !== 0);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.post) this.post.setSize(w, h, this.pixelRatio);
    this.aspect = w / h;
    this.frame();
    if (this.mode === 'play') $('rotate').classList.toggle('hidden', w > h);
  }
  /* Fit the court (or the whole island in menus) into the view. */
  frame() {
    const menu = this.mode !== 'play';
    const c = CAMS[menu ? 'diorama' : SAVE.settings.cam];
    this.camYaw = menu ? (this.camYaw || 0.62) : c.yaw; this.camPitch = c.pitch;
    this.placeCamera();
    const pts = menu
      ? [[ISLAND.x0, 0, ISLAND.z0], [ISLAND.x1, 0, ISLAND.z0], [ISLAND.x0, 0, ISLAND.z1], [ISLAND.x1, -7, ISLAND.z1], [ISLAND.x1, -6, ISLAND.z0], [ISLAND.x0, -6, ISLAND.z1], [ISLAND.x0, 8, ISLAND.z0], [-3.5, -ISLAND_DEPTH - 2.5, 0], [-1, -ISLAND_DEPTH * 0.6, ISLAND.z1 - 2]]
      : [[-COURT.RX + 0.6, 0, -COURT.RZ + 1.2], [COURT.RX - 0.6, 0, -COURT.RZ + 1.2], [-COURT.RX + 0.6, 0, COURT.RZ - 1.6], [COURT.RX - 0.6, 0, COURT.RZ - 1.6], [0, 3.0, -COURT.HL - 2.6], [0, 2.4, COURT.HL + 2.0]];
    const v = new THREE.Vector3(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    this.camera.updateMatrixWorld();
    for (const p of pts) { v.set(p[0], p[1], p[2]).applyMatrix4(this.camera.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const portrait = this.aspect < 1;
    const padX = menu ? 1.05 : (portrait ? 1.04 : 1.06), padY = menu ? 1.08 : (portrait ? 1.24 : 1.12);
    let hw = (x1 - x0) / 2 * padX, hh = (y1 - y0) / 2 * padY;
    if (hw / hh > this.aspect) hh = hw / this.aspect; else hw = hh * this.aspect;
    if (menu && this.aspect > 1) { hw *= 1.0; hh *= 1.0; }
    this.viewHW = hw; this.viewHH = hh;
    this.frameCx = (x0 + x1) / 2; this.frameCy = (y0 + y1) / 2;
    this.applyFrustum();
  }
  applyFrustum() {
    let { viewHW: hw, viewHH: hh } = this;
    const pz = 1 - (this.punchAmt || 0); hw *= pz; hh *= pz;
    let ox = this.frameCx, oy = this.frameCy;
    if (this.mode !== 'play' && this.aspect > 1.1) ox -= hw * 0.22; // keep island right of the title card
    if (this.mode === 'play' && this.aspect < 1) oy -= hh * 0.06;
    this.camera.left = ox - hw; this.camera.right = ox + hw; this.camera.top = oy + hh; this.camera.bottom = oy - hh;
    this.camera.updateProjectionMatrix();
  }
  placeCamera() {
    const d = 80, y = this.camYaw, p = this.camPitch, t = this.camTarget;
    this.camera.position.set(t.x + Math.sin(y) * Math.cos(p) * d, t.y + Math.sin(p) * d, t.z + Math.cos(y) * Math.cos(p) * d);
    this.camera.up.set(0, 1, 0); this.camera.lookAt(t);
    this.camera.getWorldDirection(this.camDir);
    this.camRight.set(Math.cos(y), 0, -Math.sin(y));
    this.camFwd.set(-Math.sin(y), 0, -Math.cos(y));
  }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  usePost() { const q = SAVE.settings.quality; return this.post && SAVE.settings.pixel === 0 && (q === 'high' || (q === 'auto' && this.resScale > 0.8)); }
  draw() {
    if (this.usePost()) {
      const U = this.post.mat.uniforms, menu = this.mode !== 'play';
      // menus: a strong miniature look; in play: only the far edges soften
      U.focusY.value = damp(U.focusY.value, menu ? 0.46 : 0.52, 3, 1 / 60);
      U.focusW.value = damp(U.focusW.value, menu ? 0.16 : 0.36, 3, 1 / 60);
      U.blur.value = (menu ? 3.2 : 2.0) * this.pixelRatio;
      this.post.render(this.scene, this.camera);
    } else this.renderer.render(this.scene, this.camera);
  }

  setTOD(name) {
    const T = TOD[name] || TOD.day; this.tod = name;
    $('sky').style.background = T.sky;
    if (this.post) this.post.setSky(...T.skyP);
    this.scene.fog.color.setHex(T.fog);
    this.renderer.toneMappingExposure = T.exp;
    this.sun.color.setHex(T.sun); this.sun.intensity = T.sunI; this.sun.position.set(...T.sunPos); this.sun.target.position.set(0, 0, 0);
    this.hemi.color.setHex(T.hemiSky); this.hemi.groundColor.setHex(T.hemiGround); this.hemi.intensity = T.hemiI;
    if (this.club) { this.club.lights.forEach(l => (l.intensity = T.flood)); if (this.club.flood) this.club.flood.visible = T.flood > 0; const cc = this.tod === 'night' ? 0x46526e : this.tod === 'dusk' ? 0xf0d2c4 : 0xffffff; for (const c of this.club.clouds || []) c.material.color.setHex(cc); this.club.glowMat.color.setHex(T.glow); this.club.haloMat.opacity = T.halo; }
  }
  loadCourt(courtId) {
    if (this.club && this.club.id === courtId) return;
    if (this.club) this.club.dispose();
    this.club = buildClub(this.scene, courtId);
    this.setTOD(this.tod || 'day');
  }
  previewCourt(courtId, tod) { if (this.mode !== 'title') return; this.endMatch(); this.loadCourt(courtId); this.setTOD(tod); this.startDemo(courtId); }

  endMatch() { if (this.match) { this.match.dispose(); this.match = null; } }
  startDemo(courtId) {
    this.endMatch();
    const rival = pick(RIVALS.filter(r => r.id !== 'teodor'));
    this.match = new Match(this, { court: courtId, rival, format: 'match', demo: true, diff: DIFFICULTY.hard });
  }
  toTitle() {
    this.mode = 'title'; this.paused = false;
    const court = SAVE.quick.court || 'clay';
    this.loadCourt(court); this.setTOD(SAVE.quick.tod === 'night' ? 'dusk' : SAVE.quick.tod || 'day');
    this.startDemo(court);
    UI.showTitle(); this.camTarget.set(0, 0, 0); this.resize();
    SFX.setAmbience(0.025);
  }
  startMatch(cfg) {
    this.lastCfg = cfg;
    this.endMatch();
    this.mode = 'play'; this.paused = false;
    this.loadCourt(cfg.court); this.setTOD(cfg.tod || 'day');
    const diff = DIFFICULTY[cfg.difficulty || 'normal'];
    this.match = new Match(this, { court: cfg.court, rival: cfg.rival, format: cfg.format || 'short', diff, career: cfg.career });
    UI.hideTitle(); $('hud').classList.remove('hidden'); $('controls').classList.remove('hidden');
    this.camTarget.set(0, 0, 0.6); this.resize();
    UI.callout(`${COURTS[cfg.court].short} · ${cfg.rival.name}`, (cfg.career != null ? `LADDER RUNG ${cfg.career + 1}` : FORMATS[cfg.format || 'short'].sub.toUpperCase()));
    Umpire.say(`${cfg.rival.name.split(' ')[1]} to receive. Play.`);
    SFX.setAmbience(0.05);
    this.input.home();
  }
  matchOver(m, winner) {
    if (this.match !== m || m.cfg.demo) { if (m.cfg.demo && this.mode === 'title') this.startDemo(this.club.id); return; }
    this.mode = 'results';
    SAVE.stats.played++; if (winner === 0) SAVE.stats.won++;
    const me = m.P[0].stats;
    SAVE.stats.aces += me.aces; SAVE.stats.longest = Math.max(SAVE.stats.longest, m.longest); SAVE.stats.fastest = Math.max(SAVE.stats.fastest, me.fastest || 0);
    let unlocked = null;
    if (m.cfg.career != null && winner === 0 && m.cfg.career === SAVE.career.rung) {
      SAVE.career.rung++;
      unlocked = SAVE.career.rung >= RIVALS.length ? 'You are the club champion. Every court is yours.' : `${RIVALS[SAVE.career.rung].name} is waiting at the ${COURTS[RIVALS[SAVE.career.rung].court].name}.`;
    }
    persist();
    $('controls').classList.add('hidden');
    UI.results(m, winner, unlocked);
  }
  press(kind) {
    if (this.mode !== 'play' || this.paused || !this.match) return;
    this.match.press(kind);
  }
  togglePause() {
    if (this.mode !== 'play') return;
    if (this.paused) { UI.close(); this.paused = false; } else UI.pause();
  }

  updateCamera(dt) {
    const m = this.match;
    if (this.mode === 'play' && m) {
      // gentle follow: drift toward the action along the court axis
      const bz = m.ball.p.z, hz = m.human.char.pos.z, hx = m.human.char.pos.x;
      const tz = clamp((bz * 0.3 + hz * 0.7) * 0.1, -0.8, 1.2), tx = clamp(hx * 0.1, -0.6, 0.6);
      this.camTarget.x = damp(this.camTarget.x, tx, 2, dt); this.camTarget.z = damp(this.camTarget.z, tz, 2, dt);
    } else {
      this.camYaw = (this.camYaw || 0.62) + dt * 0.035;
      this.camTarget.set(-2.5, 0, -2);
    }
    this.placeCamera();
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt; this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt = damp(this.shakeAmt, 0, 10, dt);
    }
    if (this.punchAmt > 0.0004) this.punchAmt = damp(this.punchAmt, 0, 14, dt);
    this.applyFrustum();
  }
  updateActionButton() {
    const m = this.match; if (!m || m.cfg.demo) return;
    let main = 'TOPSPIN', sub = TOUCH ? '' : 'J · SPACE';
    if (m.server === 0 && m.state === 'serveReady') { main = 'TOSS'; sub = 'SERVE'; }
    else if (m.server === 0 && m.state === 'toss') { main = 'HIT!'; sub = 'AT THE TOP'; }
    if (this._lbl !== main) { this._lbl = main; UI.actionLabel(main, sub); }
    // in a rally the ring around the big button fills up to the moment to swing
    const cue = m.state === 'live' ? m.timingCue() : null;
    if (cue && cue.dt < 0.7 && cue.dt > -cue.W.w) UI.tossMeter(clamp(1 - cue.dt / 0.7, 0, 1), Math.abs(cue.dt) <= cue.W.p);
    else if (m.state !== 'toss') UI.tossMeter(0, false);
  }
  ambience(dt) {
    this.ambT -= dt; if (this.ambT > 0) return;
    this.ambT = rand(2.5, 7);
    const T = TOD[this.tod] || TOD.day;
    if (T.amb === 'bird' && !(this.club && this.club.style.water)) SFX.bird(); else if (T.amb === 'cricket') SFX.cricket();
  }
  /* Fixed 120 Hz simulation (real time), so a 60 Hz phone always runs
     exactly two steps per frame: no judder, identical physics on every
     device. Rendering interpolates between the last two steps. */
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now(); let rdt = (now - this.last) / 1000; this.last = now;
    if (rdt > 0.25) rdt = 0.25;
    this.watchPerf(rdt);
    this.input.poll();
    if (!this.paused) {
      this.t += rdt;
      const m = this.match;
      let scale = m ? (m.cfg.demo ? SPEEDS.normal : SPEEDS[SAVE.settings.speed] || 0.8) : 1;
      if (this.stopT > 0) { this.stopT -= rdt; scale *= 0.06; }
      this.acc += rdt;
      let n = 0;
      while (this.acc >= STEP && n < 12) { if (m) { m.snap(); m.update(STEP * scale); } this.acc -= STEP; n++; }
      if (n >= 12) this.acc = 0;
      if (m) m.render(this.acc / STEP, rdt, this.camDir);
      if (this.club) this.club.update(rdt, this.t, m && (m.state === 'live' || m.state === 'dead' || m.state === 'toss') ? m.ball.p : null);
      this.updateActionButton();
      this.ambience(rdt);
    }
    this.updateCamera(rdt);
    this.draw();
  }
  hitStop(t) { this.stopT = Math.max(this.stopT || 0, t); }
  punch(a) { this.punchAmt = Math.max(this.punchAmt || 0, a); }
  /* Adaptive quality: if the phone can't hold ~50 fps for a few seconds,
     step the render resolution down (physics is unaffected either way). */
  watchPerf(rdt) {
    this.ema = this.ema == null ? 1 / 60 : this.ema * 0.95 + rdt * 0.05;
    if (SAVE.settings.quality !== 'auto' || this.mode !== 'play' || this.paused) { this.slowT = 0; return; }
    if (this.ema > 1 / 48) this.slowT = (this.slowT || 0) + rdt; else this.slowT = Math.max(0, (this.slowT || 0) - rdt * 0.5);
    if (this.slowT > 2.5 && this.resScale > 0.55) {
      this.resScale = Math.max(0.55, this.resScale - 0.15); this.slowT = 0; this.ema = 1 / 60;
      this.applySettings();
    }
  }
}

/* Touch devices hide the keyboard hints on the shot buttons. */
const TOUCH = !!NATIVE || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (TOUCH) document.body.classList.add('touch');
let GAME = null;
window.addEventListener('DOMContentLoaded', () => { GAME = new Game(); window.GAME = GAME; });
if (document.readyState !== 'loading') { GAME = new Game(); window.GAME = GAME; }
