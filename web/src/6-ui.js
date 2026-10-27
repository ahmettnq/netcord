/* =====================================================================
   UI: HUD helpers, menus (title, ladder, quick match, settings, how to
   play, pause, results). Everything is plain DOM over the canvas.
   ===================================================================== */
const UI = {
  _co: null, _toastT: null, _flashT: null,
  scoreboard(m) {
    const s = m.score;
    for (let i = 0; i < 2; i++) {
      $('pn' + i).textContent = m.P[i].short;
      $('g' + i).textContent = s.g[i];
      $('p' + i).textContent = m.pointLabel(i);
      $('sv' + i).classList.toggle('on', m.currentServer() === i && !m.over);
      $('ss' + i).innerHTML = s.sets.map(set => `<span>${set[i]}</span>`).join('');
    }
    $('b-title').textContent = COURTS[m.cfg.court].board + (s.tb ? ' · TIEBREAK' : '');
    if (m.game.club) drawWorldBoard(m.game.club, [m.P[0].short, m.P[1].short], [s.sets.map(x => x[0]), s.sets.map(x => x[1])], s.g, [m.pointLabel(0), m.pointLabel(1)], m.currentServer());
  },
  callout(big, small) {
    if (GAME.match && GAME.match.cfg.demo) return;
    $('co-big').textContent = big; $('co-small').textContent = small || '';
    $('co-small').style.display = small ? '' : 'none';
    const el = $('callout'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this._co); this._co = setTimeout(() => el.classList.remove('show'), 1700);
  },
  flash(text) {
    if (GAME.match && GAME.match.cfg.demo) return;
    const el = $('hint'); el.textContent = text; el.classList.add('show');
    clearTimeout(this._flashT); this._flashT = setTimeout(() => el.classList.remove('show'), 1100);
  },
  hint(text) {
    if (GAME.match && GAME.match.cfg.demo) return;
    const el = $('hint'); el.textContent = text; el.classList.toggle('show', !!text);
    clearTimeout(this._flashT); if (text) this._flashT = setTimeout(() => el.classList.remove('show'), 3800);
  },
  status(t) { $('b-status').textContent = t; },
  rally(n) { $('b-rally').textContent = 'RALLY ' + n; },
  stamina(v) { $('stam').style.width = Math.round(v * 100) + '%'; },
  toast(text, color, pos, h = 2.3) {
    if (GAME.match && GAME.match.cfg.demo) return;
    const v = GAME.project(pos.x, h, pos.z);
    const el = $('toast'); el.textContent = text; el.style.background = color;
    el.style.left = v.x + 'px'; el.style.top = v.y + 'px'; el.style.opacity = 1;
    clearTimeout(this._toastT); this._toastT = setTimeout(() => (el.style.opacity = 0), 750);
  },
  speed(kmh) { const el = $('speedo'); el.textContent = kmh + ' KM/H'; el.style.opacity = 1; clearTimeout(this._sp); this._sp = setTimeout(() => (el.style.opacity = 0), 1800); },
  tossMeter(f, good) {
    const arc = $('ring-arc'); const len = 2 * Math.PI * 58;
    arc.setAttribute('stroke-dasharray', `${f * len} ${len}`);
    arc.setAttribute('stroke', good ? '#f2c14e' : '#173a2a');
  },
  pressed(kind) { const b = $(kind === 'top' ? 'b-top' : kind === 'slice' ? 'b-slice' : 'b-lob'); if (!b) return; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); },
  actionLabel(main, sub) { $('b-top-label').textContent = main; $('b-top-sub').textContent = sub; },

  /* ---------- sheets ---------- */
  open(html, onMount) {
    $('sheet-card').innerHTML = html; $('sheet').classList.remove('hidden');
    $('sheet-card').scrollTop = 0;
    const x = $('sheet-card').querySelector('[data-close]'); if (x) x.onclick = () => { SFX.click(); UI.close(); };
    if (onMount) onMount($('sheet-card'));
  },
  close() { $('sheet').classList.add('hidden'); if (UI.onClose) { const f = UI.onClose; UI.onClose = null; f(); } },
  head(eyebrow, title, close = true) { return `<div class="sheet-head"><div><div class="eyebrow">${eyebrow}</div><div class="h2" style="margin-top:6px">${title}</div></div>${close ? '<button class="x" data-close>✕</button>' : ''}</div>`; },
  chips(name, opts, cur) { return `<div class="chips" data-group="${name}">` + opts.map(([v, l]) => `<button class="chip ${String(v) === String(cur) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('') + '</div>'; },
  bindChips(root, name, cb) {
    const g = root.querySelector(`[data-group="${name}"]`); if (!g) return;
    g.querySelectorAll('.chip').forEach(b => b.onclick = () => { SFX.click(); g.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
  },
  courtCards(cur) {
    return '<div class="courts" data-group="court">' + Object.values(COURTS).map(c => `<button class="court-card ${c.id === cur ? 'on' : ''}" data-v="${c.id}"><div class="sw" style="background:${c.swatch}"></div><b>${c.short}</b><i>${c.tag}</i></button>`).join('') + '</div>';
  },
  bindCourts(root, cb) { root.querySelectorAll('.court-card').forEach(b => b.onclick = () => { SFX.click(); root.querySelectorAll('.court-card').forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); }); },
  rungHtml(r, i, state, sel) {
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    const st = state === 'done' ? 'BEATEN' : state === 'next' ? 'NEXT UP' : state === 'locked' ? 'LOCKED' : COURTS[r.court].short;
    return `<button class="rung ${state} ${sel ? 'sel' : ''}" data-i="${i}"><span class="av" style="background:${hex(r.shirt)};--skin:${hex(r.skin)}"></span><span class="nm"><b>${i + 1}. ${r.name}</b><i>${r.style} · ${COURTS[r.court].short}</i></span><span class="st">${st}</span></button>`;
  },

  showTitle() {
    $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); $('controls').classList.add('hidden'); $('rotate').classList.add('hidden');
    const rung = Math.min(SAVE.career.rung, RIVALS.length);
    $('m-career-sub').textContent = rung >= RIVALS.length ? 'CHAMPION' : `RUNG ${rung + 1} / ${RIVALS.length}`;
    $('m-record').textContent = `${SAVE.stats.played} MATCHES · ${SAVE.stats.won} WON`;
  },
  hideTitle() { $('title').classList.add('hidden'); },

  career() {
    const rung = SAVE.career.rung;
    let html = UI.head('The Club Ladder', rung >= RIVALS.length ? 'Club champion' : 'Climb the ladder');
    html += `<p class="lede" style="margin-top:6px">Beat each rival on their home court to unlock the next. Short sets, standard scoring.</p><div class="ladder">`;
    RIVALS.forEach((r, i) => { html += UI.rungHtml(r, i, i < rung ? 'done' : i === rung ? 'next' : 'locked', false); });
    html += `</div><div class="row-label">Difficulty</div>` + UI.chips('cdiff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], SAVE.quick.difficulty);
    const target = Math.min(rung, RIVALS.length - 1);
    html += `<div style="margin-top:16px"><button class="btn primary" id="go-career">Play ${RIVALS[target].name.split(' ')[0]} <small>${COURTS[RIVALS[target].court].name.toUpperCase()}</small></button></div>`;
    UI.open(html, root => {
      let pickI = target;
      root.querySelectorAll('.rung').forEach(b => b.onclick = () => {
        const i = +b.dataset.i; if (i > rung) return;
        SFX.click(); pickI = i;
        root.querySelectorAll('.rung').forEach(x => x.classList.toggle('sel', +x.dataset.i === i));
        $('go-career').innerHTML = `Play ${RIVALS[i].name.split(' ')[0]} <small>${COURTS[RIVALS[i].court].name.toUpperCase()}</small>`;
      });
      UI.bindChips(root, 'cdiff', v => { SAVE.quick.difficulty = v; persist(); });
      $('go-career').onclick = () => { SFX.click(); UI.close(); GAME.startMatch({ court: RIVALS[pickI].court, rival: RIVALS[pickI], format: 'short', difficulty: SAVE.quick.difficulty, career: pickI, tod: SAVE.settings.tod }); };
    });
  },
  quick() {
    const q = SAVE.quick;
    let html = UI.head('Quick Match', 'Pick your court');
    html += UI.courtCards(q.court);
    html += `<div class="row-label">Opponent</div><div class="ladder" id="q-rivals">`;
    RIVALS.forEach((r, i) => { html += UI.rungHtml(r, i, '', r.id === q.rival); });
    html += `</div><div class="row-label">Difficulty</div>` + UI.chips('qdiff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], q.difficulty);
    html += `<div class="row-label">Length</div>` + UI.chips('qfmt', Object.entries(FORMATS).map(([k, f]) => [k, f.label]), q.format);
    html += `<div class="row-label">Time of day</div>` + UI.chips('qtod', [['day', 'Afternoon'], ['dusk', 'Golden hour'], ['night', 'Under lights']], q.tod);
    html += `<div style="margin-top:18px"><button class="btn clay" id="go-quick">Walk on court <small>START</small></button></div>`;
    UI.open(html, root => {
      UI.bindCourts(root, v => { q.court = v; persist(); GAME.previewCourt(v, q.tod); });
      root.querySelectorAll('#q-rivals .rung').forEach(b => b.onclick = () => { SFX.click(); q.rival = RIVALS[+b.dataset.i].id; persist(); root.querySelectorAll('#q-rivals .rung').forEach(x => x.classList.toggle('sel', x === b)); });
      UI.bindChips(root, 'qdiff', v => { q.difficulty = v; persist(); });
      UI.bindChips(root, 'qfmt', v => { q.format = v; persist(); });
      UI.bindChips(root, 'qtod', v => { q.tod = v; persist(); GAME.setTOD(v); });
      $('go-quick').onclick = () => { SFX.click(); UI.close(); GAME.startMatch({ court: q.court, rival: RIVALS.find(r => r.id === q.rival), format: q.format, difficulty: q.difficulty, tod: q.tod }); };
    });
  },
  settings(fromPause) {
    const s = SAVE.settings;
    let html = UI.head('Settings', 'Club preferences');
    const row = (title, sub, chips) => `<div class="toggle-row" style="flex-wrap:wrap"><div><b>${title}</b><i>${sub}</i></div>${chips}</div>`;
    html += row('Game speed', 'How fast the ball travels', UI.chips('speed', [['relaxed', 'Relaxed'], ['normal', 'Normal'], ['pro', 'Pro']], s.speed));
    html += row('Movement help', 'Steers your run to the sweet spot. Also sets how forgiving swing timing is', UI.chips('assist', [['off', 'Pro'], ['assist', 'Assist'], ['auto', 'Auto-run']], s.assist));
    html += row('Shot guides', 'Bounce ring, sweet spot, timing ring', UI.chips('guides', [['true', 'On'], ['false', 'Off']], s.guides));
    html += row('Graphics', 'Auto lowers detail if your phone runs warm', UI.chips('quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Battery saver']], s.quality));
    html += row('Retro pixels', 'A chunky old-school filter', UI.chips('pixel', [['0', 'Off'], ['1', 'Fine'], ['2', 'Chunky']], s.pixel));
    html += row('Haptics', 'Feel every strike in your hand', UI.chips('haptics', [['true', 'On'], ['false', 'Off']], s.haptics));
    html += row('Camera', 'Diorama corner or behind the baseline', UI.chips('cam', [['diorama', 'Diorama'], ['low', 'Low corner'], ['behind', 'Behind']], s.cam));
    html += row('Sound', 'Ball, crowd and ambience', UI.chips('sfx', [['true', 'On'], ['false', 'Off']], s.sfx));
    html += row('Umpire voice', 'Score calls from the chair', UI.chips('voice', [['true', 'On'], ['false', 'Off']], s.voice));
    html += `<div style="margin-top:16px"><button class="btn ghost" id="set-reset">Reset ladder progress <small>CAN'T UNDO</small></button></div>`;
    UI.open(html, root => {
      const set = (k, conv) => UI.bindChips(root, k, v => { s[k] = conv ? conv(v) : v; persist(); GAME.applySettings(); });
      set('speed'); set('assist'); set('guides', v => v === 'true'); set('quality'); set('pixel', v => +v); set('haptics', v => v === 'true'); set('cam'); set('sfx', v => v === 'true'); set('voice', v => v === 'true');
      // two taps instead of a system dialog (dialogs don't show inside the iOS app)
      let armed = false;
      $('set-reset').onclick = () => {
        SFX.click();
        if (!armed) { armed = true; $('set-reset').innerHTML = 'Tap again to reset the ladder <small>SURE?</small>'; setTimeout(() => { armed = false; const b = $('set-reset'); if (b) b.innerHTML = "Reset ladder progress <small>CAN'T UNDO</small>"; }, 3000); return; }
        SAVE.career.rung = 0; persist(); UI.showTitle(); $('set-reset').innerHTML = 'Ladder reset <small>DONE</small>'; armed = false;
      };
    });
    if (fromPause) UI.onClose = () => UI.pause();
  },
  how() {
    let html = UI.head('How to play', 'Read it, run, swing');
    html += `<div class="how">
      <div><kbd>STICK</kbd><span>Drag anywhere on the left half to run. The <b>yellow ring</b> marks the sweet spot: stand there and the ball arrives at the top of its bounce.</span></div>
      <div><kbd>SWING</kbd><span>Your player swings <b>the moment you tap</b>. Watch the <b>timing ring</b> close around your feet and tap as it turns gold, with the ball just in front of you. Early contact pulls the ball across your body, late contact pushes it wide and short.</span></div>
      <div><kbd>TOPSPIN</kbd><span>Fast, dipping drive that kicks up off the bounce.</span></div>
      <div><kbd>SLICE</kbd><span>Low, skidding backspin. Hold the stick <b>toward yourself</b> while slicing for a drop shot.</span></div>
      <div><kbd>LOB</kbd><span>High and deep over a player at the net.</span></div>
      <div><kbd>AIM</kbd><span>The stick direction at contact steers the ball: left/right for angle, toward the net for deep, back for short.</span></div>
      <div><kbd>SERVE</kbd><span>Tap any shot button to toss, tap again at the very top of the toss (the ring turns gold). TOPSPIN = flat bomb, SLICE = swinging slice, LOB = safe kick serve. Slide along the baseline before the toss, aim with the stick during it.</span></div>
      <div><kbd>PERFECT</kbd><span>Perfect timing plus good footwork = a gold PERFECT shot with extra pace and pin-point accuracy. You will feel it in your hand too.</span></div>
      <div><kbd>KEYS</kbd><span>WASD / arrows to move. J or Space topspin, K slice, L lob. Esc pauses. Gamepads work too.</span></div>
      <div><kbd>SURFACES</kbd><span>Clay grips: high, slow bounce. Grass skids low and fast. Hard is honest.</span></div>
    </div>
    <p class="lede" style="margin-top:16px;font-size:11px">Netcord is made by TNQ Nexus. Every island, player, sound and line of game code was made for this game. 3D rendering by three.js (MIT License, © three.js authors).</p>`;
    UI.open(html);
  },
  pause() {
    GAME.paused = true;
    let html = UI.head('Paused', 'Take a breather', false);
    html += `<div style="display:grid;gap:8px;margin-top:14px">
      <button class="btn primary" id="p-resume">Resume</button>
      <button class="btn ghost" id="p-settings">Settings</button>
      <button class="btn ghost" id="p-how">How to play</button>
      <button class="btn ghost" id="p-restart">Restart match</button>
      <button class="btn clay" id="p-quit">Leave the court</button></div>`;
    UI.open(html, () => {
      $('p-resume').onclick = () => { SFX.click(); UI.close(); GAME.paused = false; };
      $('p-settings').onclick = () => { SFX.click(); UI.settings(true); };
      $('p-how').onclick = () => { SFX.click(); UI.how(); UI.onClose = () => UI.pause(); };
      $('p-restart').onclick = () => { SFX.click(); UI.close(); GAME.paused = false; GAME.startMatch(GAME.lastCfg); };
      $('p-quit').onclick = () => { SFX.click(); UI.close(); GAME.paused = false; GAME.toTitle(); };
    });
  },
  results(m, winner, unlocked) {
    const me = m.P[0], op = m.P[1], won = winner === 0;
    const sets = m.score.sets.map(s => `${s[0]}–${s[1]}`).join('  ');
    const pct = c => c.stats.firstTotal ? Math.round(100 * c.stats.firstIn / c.stats.firstTotal) + '%' : '–';
    const rows = [['Aces', me.stats.aces, op.stats.aces], ['Double faults', me.stats.df, op.stats.df], ['Winners', me.stats.winners, op.stats.winners], ['Errors', me.stats.errors, op.stats.errors], ['1st serve in', pct(me), pct(op)], ['Perfect hits', me.stats.perfect, '–'], ['Points won', me.stats.points, op.stats.points]];
    let html = UI.head(won ? 'Game, set and match' : 'Match complete', won ? 'You win' : `${op.name.split(' ')[0]} wins`, false);
    html += `<div style="margin-top:8px;font:700 30px/1 var(--mono);color:var(--clay)">${sets}</div>`;
    if (unlocked) html += `<p class="lede" style="margin-top:8px;color:var(--ink)"><b>${unlocked}</b></p>`;
    html += `<div style="margin-top:14px;background:#13301f;color:#f4efe4;border-radius:16px;padding:12px 14px;font:500 12px/1 var(--mono)">
      <div style="display:flex;justify-content:space-between;color:#86b394;letter-spacing:.14em;font-size:10px;padding-bottom:8px;border-bottom:1px solid #24503a"><span>STAT</span><span>YOU · ${op.short}</span></div>
      ${rows.map(r => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1d4230"><span style="color:#cfe0d4">${r[0]}</span><span><b style="color:#ffd84d">${r[1]}</b> · ${r[2]}</span></div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:7px 0"><span style="color:#cfe0d4">Longest rally</span><span><b style="color:#ffd84d">${m.longest}</b> shots</span></div>
    </div>`;
    const nextRung = m.cfg.career != null && won && SAVE.career.rung < RIVALS.length;
    html += `<div style="display:grid;gap:8px;margin-top:14px">
      ${nextRung ? `<button class="btn primary" id="r-next">Next rival: ${RIVALS[SAVE.career.rung].name.split(' ')[0]}</button>` : ''}
      <button class="btn ${nextRung ? 'ghost' : 'primary'}" id="r-again">${won ? 'Play again' : 'Rematch'}</button>
      <button class="btn clay" id="r-menu">Back to the clubhouse</button></div>`;
    UI.open(html, () => {
      if (nextRung) $('r-next').onclick = () => { SFX.click(); UI.close(); const r = RIVALS[SAVE.career.rung]; GAME.startMatch({ court: r.court, rival: r, format: 'short', difficulty: SAVE.quick.difficulty, career: SAVE.career.rung, tod: SAVE.settings.tod }); };
      $('r-again').onclick = () => { SFX.click(); UI.close(); GAME.startMatch(GAME.lastCfg); };
      $('r-menu').onclick = () => { SFX.click(); UI.close(); GAME.toTitle(); };
    });
  }
};
