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
  /* the tap cue: an approach circle that closes onto a fixed ring where the
     ball will be met, turning gold (and pulsing the shot buttons) on the beat */
  cue(pos, k, good) {
    const el = $('cue');
    if (!pos || (GAME.match && GAME.match.cfg.demo)) { if (this._cueOn) { el.classList.remove('on', 'good'); this._cueOn = false; this._cueGood = false; document.querySelectorAll('.shot.now').forEach(b => b.classList.remove('now')); } return; }
    const v = GAME.project(pos.x, pos.y, pos.z);
    el.style.transform = `translate(${v.x}px,${v.y}px)`;
    el.style.setProperty('--s', (1 + 1.6 * clamp(k, 0, 1)).toFixed(3));
    if (!this._cueOn) { el.classList.add('on'); this._cueOn = true; }
    if (good !== this._cueGood) { this._cueGood = good; el.classList.toggle('good', good); document.querySelectorAll('.shot').forEach(b => b.classList.toggle('now', good)); }
  },
  pressed(kind) { const b = $(kind === 'top' ? 'b-top' : kind === 'slice' ? 'b-slice' : 'b-lob'); if (!b) return; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); },
  actionLabel(main, sub) { $('b-top-label').textContent = main; $('b-top-sub').textContent = sub; },

  /* ---------- sheets ----------
     Every sheet is laid out for a phone held sideways (about 844x390 points,
     as small as 667x375): two columns, the main action in the header, and
     nothing that needs scrolling. */
  open(html, onMount, cls = '') {
    const card = $('sheet-card');
    card.className = 'card panel ' + cls;
    card.innerHTML = html; $('sheet').classList.remove('hidden');
    card.scrollTop = 0;
    card.querySelectorAll('[data-close]').forEach(x => x.onclick = () => { SFX.click(); UI.close(); });
    if (onMount) onMount(card);
  },
  close() { $('sheet').classList.add('hidden'); if (UI.onClose) { const f = UI.onClose; UI.onClose = null; f(); } },
  head(eyebrow, title, close = true, action = '') {
    return `<div class="sheet-head"><div class="ttl"><div class="eyebrow">${eyebrow}</div><div class="h2">${title}</div></div><div class="acts">${action}${close ? '<button class="x" data-close aria-label="Close">✕</button>' : ''}</div></div>`;
  },
  chips(name, opts, cur) { return `<div class="chips" data-group="${name}">` + opts.map(([v, l]) => `<button class="chip ${String(v) === String(cur) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('') + '</div>'; },
  bindChips(root, name, cb) {
    const g = root.querySelector(`[data-group="${name}"]`); if (!g) return;
    g.querySelectorAll('.chip').forEach(b => b.onclick = () => { SFX.click(); g.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
  },
  courtCards(cur) {
    return '<div class="courts" data-group="court">' + Object.values(COURTS).map(c => `<button class="court-card ${c.id === cur ? 'on' : ''}" data-v="${c.id}"><div class="sw" style="background:${c.swatch}"></div><b>${c.short}</b><i>${c.tag}</i></button>`).join('') + '</div>';
  },
  bindCourts(root, cb) { root.querySelectorAll('.court-card').forEach(b => b.onclick = () => { SFX.click(); root.querySelectorAll('.court-card').forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); }); },
  rungHtml(r, i, state, sel, mini) {
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    const st = state === 'done' ? 'BEATEN' : state === 'next' ? 'NEXT UP' : state === 'locked' ? 'LOCKED' : COURTS[r.court].short;
    return `<button class="rung ${state} ${sel ? 'sel' : ''} ${mini ? 'mini' : ''}" data-i="${i}"><span class="av" style="background:${hex(r.shirt)};--skin:${hex(r.skin)}"></span><span class="nm"><b>${mini ? r.name.split(' ')[0] : (i + 1) + '. ' + r.name}</b><i>${mini ? COURTS[r.court].short : r.style}</i></span>${mini ? '' : `<span class="st">${st}</span>`}</button>`;
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
    const target = Math.min(rung, RIVALS.length - 1);
    const goLabel = i => `Play ${RIVALS[i].name.split(' ')[0]} <small>${COURTS[RIVALS[i].court].short.toUpperCase()}</small>`;
    let html = UI.head('The Club Ladder', rung >= RIVALS.length ? 'Club champion' : 'Climb the ladder', true, `<button class="btn primary go" id="go-career">${goLabel(target)}</button>`);
    html += `<div class="ladder two">`;
    RIVALS.forEach((r, i) => { html += UI.rungHtml(r, i, i < rung ? 'done' : i === rung ? 'next' : 'locked', false); });
    html += `</div><div class="inline-row"><span class="row-label">Difficulty</span>` + UI.chips('cdiff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], SAVE.quick.difficulty) + `<span class="note">Beat each rival on their home court to unlock the next.</span></div>`;
    UI.open(html, root => {
      let pickI = target;
      root.querySelectorAll('.rung').forEach(b => b.onclick = () => {
        const i = +b.dataset.i; if (i > rung) return;
        SFX.click(); pickI = i;
        root.querySelectorAll('.rung').forEach(x => x.classList.toggle('sel', +x.dataset.i === i));
        $('go-career').innerHTML = goLabel(i);
      });
      UI.bindChips(root, 'cdiff', v => { SAVE.quick.difficulty = v; persist(); });
      $('go-career').onclick = () => { SFX.click(); UI.close(); GAME.startMatch({ court: RIVALS[pickI].court, rival: RIVALS[pickI], format: 'short', difficulty: SAVE.quick.difficulty, career: pickI, tod: SAVE.settings.tod }); };
    }, 'wide');
  },
  quick() {
    const q = SAVE.quick;
    let html = UI.head('Quick Match', 'Pick your court', true, `<button class="btn clay go" id="go-quick">Walk on court <small>START</small></button>`);
    html += `<div class="cols"><div class="col">${UI.courtCards(q.court)}<div class="row-label">Opponent</div><div class="ladder three" id="q-rivals">`;
    RIVALS.forEach((r, i) => { html += UI.rungHtml(r, i, '', r.id === q.rival, true); });
    html += `</div></div><div class="col">`;
    html += `<div class="row-label">Difficulty</div>` + UI.chips('qdiff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], q.difficulty);
    html += `<div class="row-label">Length</div>` + UI.chips('qfmt', Object.entries(FORMATS).map(([k, f]) => [k, f.label]), q.format);
    html += `<div class="row-label">Time of day</div>` + UI.chips('qtod', [['day', 'Afternoon'], ['dusk', 'Golden hour'], ['night', 'Under lights']], q.tod);
    html += `</div></div>`;
    UI.open(html, root => {
      UI.bindCourts(root, v => { q.court = v; persist(); GAME.previewCourt(v, q.tod); });
      root.querySelectorAll('#q-rivals .rung').forEach(b => b.onclick = () => { SFX.click(); q.rival = RIVALS[+b.dataset.i].id; persist(); root.querySelectorAll('#q-rivals .rung').forEach(x => x.classList.toggle('sel', x === b)); });
      UI.bindChips(root, 'qdiff', v => { q.difficulty = v; persist(); });
      UI.bindChips(root, 'qfmt', v => { q.format = v; persist(); });
      UI.bindChips(root, 'qtod', v => { q.tod = v; persist(); GAME.setTOD(v); });
      $('go-quick').onclick = () => { SFX.click(); UI.close(); GAME.startMatch({ court: q.court, rival: RIVALS.find(r => r.id === q.rival), format: q.format, difficulty: q.difficulty, tod: q.tod }); };
    }, 'wide');
  },
  settings(fromPause) {
    const s = SAVE.settings;
    let html = UI.head('Settings', 'Club preferences');
    const row = (title, chips) => `<div class="set-row"><b>${title}</b>${chips}</div>`;
    html += `<div class="set-grid">`;
    html += row('Game speed', UI.chips('speed', [['relaxed', 'Relaxed'], ['normal', 'Normal'], ['pro', 'Pro']], s.speed));
    html += row('Movement help', UI.chips('assist', [['off', 'Pro'], ['assist', 'Assist'], ['auto', 'Auto-run']], s.assist));
    html += row('Shot guides', UI.chips('guides', [['true', 'On'], ['false', 'Off']], s.guides));
    html += row('Graphics', UI.chips('quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Saver']], s.quality));
    html += row('Retro pixels', UI.chips('pixel', [['0', 'Off'], ['1', 'Fine'], ['2', 'Chunky']], s.pixel));
    html += row('Camera', UI.chips('cam', [['diorama', 'Diorama'], ['low', 'Low'], ['behind', 'Behind']], s.cam));
    html += row('Haptics', UI.chips('haptics', [['true', 'On'], ['false', 'Off']], s.haptics));
    html += row('Sound', UI.chips('sfx', [['true', 'On'], ['false', 'Off']], s.sfx));
    html += row('Umpire voice', UI.chips('voice', [['true', 'On'], ['false', 'Off']], s.voice));
    html += `<div class="set-row"><button class="btn ghost slim" id="set-tut">Replay tutorial</button><button class="btn ghost slim" id="set-reset">Reset ladder</button></div>`;
    html += `</div><p class="note">Assist and Auto-run also make swing and serve timing more forgiving. Shot guides show the tap circle and the bounce ring.</p>`;
    UI.open(html, root => {
      const set = (k, conv) => UI.bindChips(root, k, v => { s[k] = conv ? conv(v) : v; persist(); GAME.applySettings(); });
      set('speed'); set('assist'); set('guides', v => v === 'true'); set('quality'); set('pixel', v => +v); set('haptics', v => v === 'true'); set('cam'); set('sfx', v => v === 'true'); set('voice', v => v === 'true');
      $('set-tut').onclick = () => { SFX.click(); UI.onClose = null; UI.close(); if (GAME.match && !GAME.match.cfg.demo) { GAME.paused = false; GAME.toTitle(); } GAME.startTutorial(); };
      // two taps instead of a system dialog (dialogs don't show inside the iOS app)
      let armed = false;
      $('set-reset').onclick = () => {
        SFX.click();
        if (!armed) { armed = true; $('set-reset').textContent = 'Tap again to reset'; setTimeout(() => { armed = false; const b = $('set-reset'); if (b) b.textContent = 'Reset ladder'; }, 3000); return; }
        SAVE.career.rung = 0; persist(); UI.showTitle(); $('set-reset').textContent = 'Ladder reset'; armed = false;
      };
    }, 'wide');
    if (fromPause) UI.onClose = () => UI.pause();
  },
  how(page = 0) {
    const pages = [
      ['Run and swing', [
        ['MOVE', 'Drag anywhere on the left half to run. The <b>yellow ring</b> on the court is the spot to stand.'],
        ['TAP', 'A circle closes onto where you will meet the ball. <b>Tap any shot button when it turns gold</b> and says TAP. Early pulls the ball across, late pushes it wide.'],
        ['AIM', 'The stick at contact steers the ball: left or right for angle, toward the net for deep, back for short.'],
        ['PERFECT', 'Gold timing plus good footwork gives a PERFECT shot with extra pace and pin-point accuracy.']]],
      ['Your shots', [
        ['TOPSPIN', 'Fast, dipping drive that kicks up off the bounce. Your everyday shot.'],
        ['SLICE', 'Low, skidding backspin. Hold the stick <b>toward yourself</b> while slicing for a drop shot.'],
        ['LOB', 'High and deep over a player at the net.'],
        ['COURTS', 'Clay grips: high, slow bounce. Grass skids low and fast. Hard is honest.']]],
      ['Serve and more', [
        ['SERVE', 'Tap once to toss. A circle closes on the ball: <b>tap again when it turns gold</b> at the top. TOPSPIN is a flat bomb, SLICE swings wide, LOB is a safe kick serve.'],
        ['PLACE', 'Slide along the baseline before the toss, aim with the stick during it.'],
        ['KEYS', 'WASD or arrows to move. J or Space topspin, K slice, L lob. Esc pauses. Gamepads work too.'],
        ['ABOUT', 'Netcord is made by TNQ Nexus. 3D rendering by three.js (MIT License).']]]
    ];
    const n = pages.length, P = pages[page];
    let html = UI.head(`How to play · ${page + 1} / ${n}`, P[0]);
    html += `<div class="how">` + P[1].map(([k, t]) => `<div><kbd>${k}</kbd><span>${t}</span></div>`).join('') + `</div>`;
    html += `<div class="pager"><button class="btn ghost slim" id="how-prev" ${page === 0 ? 'disabled' : ''}>Back</button><span class="dots">${pages.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</span><button class="btn primary slim" id="how-next">${page === n - 1 ? 'Got it' : 'Next'}</button></div>`;
    const keep = UI.onClose; UI.onClose = null;
    UI.open(html, root => {
      UI.onClose = keep;
      $('how-prev').onclick = () => { if (page > 0) { SFX.click(); UI.how(page - 1); } };
      $('how-next').onclick = () => { SFX.click(); if (page < n - 1) UI.how(page + 1); else UI.close(); };
      let x0 = null;
      root.ontouchstart = e => { x0 = e.touches[0].clientX; };
      root.ontouchend = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -50 && page < n - 1) UI.how(page + 1); else if (dx > 50 && page > 0) UI.how(page - 1); };
    }, 'wide');
  },
  pause() {
    GAME.paused = true;
    let html = UI.head('Paused', 'Take a breather', false);
    html += `<div class="pause-grid">
      <button class="btn primary span" id="p-resume">Resume</button>
      <button class="btn ghost" id="p-settings">Settings</button>
      <button class="btn ghost" id="p-how">How to play</button>
      <button class="btn ghost" id="p-restart">Restart match</button>
      <button class="btn clay" id="p-quit">Leave the court</button></div>`;
    UI.open(html, () => {
      $('p-resume').onclick = () => { SFX.click(); UI.close(); GAME.paused = false; };
      $('p-settings').onclick = () => { SFX.click(); UI.settings(true); };
      $('p-how').onclick = () => { SFX.click(); UI.onClose = () => UI.pause(); UI.how(); };
      $('p-restart').onclick = () => { SFX.click(); UI.close(); GAME.paused = false; GAME.startMatch(GAME.lastCfg); };
      $('p-quit').onclick = () => { SFX.click(); UI.close(); GAME.paused = false; GAME.toTitle(); };
    }, 'narrow');
  },
  results(m, winner, unlocked) {
    const me = m.P[0], op = m.P[1], won = winner === 0;
    const sets = m.score.sets.map(s => `${s[0]}–${s[1]}`).join('  ');
    const pct = c => c.stats.firstTotal ? Math.round(100 * c.stats.firstIn / c.stats.firstTotal) + '%' : '–';
    const rows = [['Aces', me.stats.aces, op.stats.aces], ['Double faults', me.stats.df, op.stats.df], ['Winners', me.stats.winners, op.stats.winners], ['Errors', me.stats.errors, op.stats.errors], ['1st serve in', pct(me), pct(op)], ['Perfect hits', me.stats.perfect, '–'], ['Points won', me.stats.points, op.stats.points], ['Longest rally', m.longest, '']];
    const nextRung = m.cfg.career != null && won && SAVE.career.rung < RIVALS.length;
    let html = UI.head(won ? 'Game, set and match' : 'Match complete', won ? 'You win' : `${op.name.split(' ')[0]} wins`, false);
    html += `<div class="cols"><div class="col">
      <div class="score-big">${sets}</div>
      ${unlocked ? `<p class="lede" style="color:var(--ink)"><b>${unlocked}</b></p>` : ''}
      <div class="stack">
      ${nextRung ? `<button class="btn primary" id="r-next">Next rival: ${RIVALS[SAVE.career.rung].name.split(' ')[0]}</button>` : ''}
      <button class="btn ${nextRung ? 'ghost' : 'primary'}" id="r-again">${won ? 'Play again' : 'Rematch'}</button>
      <button class="btn clay" id="r-menu">Back to the clubhouse</button></div></div>
      <div class="col"><div class="stats"><div class="sh"><span>STAT</span><span>YOU · ${op.short}</span></div>
      ${rows.map(r => `<div><span>${r[0]}</span><span><b>${r[1]}</b>${r[2] === '' ? ' shots' : ' · ' + r[2]}</span></div>`).join('')}</div></div></div>`;
    UI.open(html, () => {
      if (nextRung) $('r-next').onclick = () => { SFX.click(); UI.close(); const r = RIVALS[SAVE.career.rung]; GAME.startMatch({ court: r.court, rival: r, format: 'short', difficulty: SAVE.quick.difficulty, career: SAVE.career.rung, tod: SAVE.settings.tod }); };
      $('r-again').onclick = () => { SFX.click(); UI.close(); GAME.startMatch(GAME.lastCfg); };
      $('r-menu').onclick = () => { SFX.click(); UI.close(); GAME.toTitle(); };
    }, 'wide');
  }
  ,
  /* first-launch cards: move, tap on the gold, serve */
  onboard(page = 0) {
    const cards = [
      ['Run to the ball', 'Drag anywhere on the left half of the screen to run. A yellow ring on the court shows the best spot to stand.', '<i class="pad"></i><i class="knob"></i>'],
      ['Tap on the gold', 'A circle closes onto the spot where you meet the ball. Tap any shot button the moment it turns gold and says TAP.', '<i class="apr"></i><i class="tgt"></i><span class="tap">TAP</span>'],
      ['Toss, then tap at the top', 'To serve, tap once to toss. Tap again when the circle over the ball turns gold, right at the top of the toss.', '<i class="sring"></i><i class="sball"></i>']
    ];
    const n = cards.length, C = cards[page], last = page === n - 1;
    let html = UI.head(`Welcome to Netcord · ${page + 1} / ${n}`, page === 0 ? 'Three quick tips' : C[0], false, `<button class="btn ghost slim" id="ob-skip">Skip</button>`);
    html += `<div class="onb"><div class="art">${C[2]}</div><div>${page === 0 ? `<h3>${C[0]}</h3>` : ''}<p>${C[1]}</p></div></div>`;
    html += `<div class="pager"><button class="btn ghost slim" id="ob-prev" ${page === 0 ? 'disabled' : ''}>Back</button><span class="dots">${cards.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</span><button class="btn ${last ? 'clay' : 'primary'} slim" id="ob-next">${last ? 'Try a practice rally' : 'Next'}</button></div>`;
    const done = () => { SAVE.flags.intro = true; persist(); };
    UI.open(html, root => {
      $('ob-skip').onclick = () => { SFX.click(); done(); UI.close(); };
      $('ob-prev').onclick = () => { if (page > 0) { SFX.click(); UI.onboard(page - 1); } };
      $('ob-next').onclick = () => { SFX.unlock(); SFX.click(); if (!last) return UI.onboard(page + 1); done(); UI.close(); GAME.startTutorial(); };
      let x0 = null;
      root.ontouchstart = e => { x0 = e.touches[0].clientX; };
      root.ontouchend = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (dx < -50 && !last) UI.onboard(page + 1); else if (dx > 50 && page > 0) UI.onboard(page - 1); };
    }, 'wide');
  },
  tutorialDone(onPlay, onMenu) {
    let html = UI.head('Practice complete', 'You are ready', false);
    html += `<p class="lede" style="color:var(--ink)">Nice hitting. Keep watching for the gold circle and tap on it. You can replay this practice any time from Settings.</p>
      <div class="pause-grid" style="margin-top:14px"><button class="btn clay span" id="td-play">Play your first match</button><button class="btn ghost span" id="td-menu">Back to the clubhouse</button></div>`;
    UI.open(html, () => { $('td-play').onclick = () => { SFX.click(); UI.close(); onPlay(); }; $('td-menu').onclick = () => { SFX.click(); UI.close(); onMenu(); }; }, 'narrow');
  }
};
