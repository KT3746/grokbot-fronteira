/* FRONTEIRA — teclado + D-pad + joystick analógico (wave4) + Interagir */
export const FronteiraInput = (() => {
  const keys = Object.create(null);
  const touchDirs = { up: false, down: false, left: false, right: false };
  const DIR_VEC = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const CODE_TO_KEY = {
    KeyW: 'w', ArrowUp: 'arrowup',
    KeyS: 's', ArrowDown: 'arrowdown',
    KeyA: 'a', ArrowLeft: 'arrowleft',
    KeyD: 'd', ArrowRight: 'arrowright',
    KeyE: 'e',
    Space: ' ',
    Escape: 'escape',
  };

  /* Wave4 — joystick flutuante: arraste em qualquer ponto da metade esquerda. */
  const JOY_R = 52;
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let joyBase = null, joyKnob = null;

  let interactQueued = false;
  let pauseQueued = false;

  function keyFromEvent(e) {
    if (e.code && CODE_TO_KEY[e.code]) return CODE_TO_KEY[e.code];
    const k = (e.key || '').toLowerCase();
    if (k === 'spacebar') return ' ';
    return k;
  }

  function pressDir(d, btn) {
    if (!DIR_VEC[d]) return;
    touchDirs[d] = true;
    if (btn) btn.classList.add('is-down');
  }

  function releaseDir(d, btn) {
    if (!DIR_VEC[d]) return;
    touchDirs[d] = false;
    if (btn) btn.classList.remove('is-down');
  }

  function bindPad(btn) {
    const d = btn.dataset.dir;
    if (!d) return;

    const onPointer = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pressDir(d, btn);
      try { btn.setPointerCapture(ev.pointerId); } catch (_) {}
    };
    const offPointer = (ev) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      releaseDir(d, btn);
    };

    btn.addEventListener('pointerdown', onPointer);
    btn.addEventListener('pointerup', offPointer);
    btn.addEventListener('pointercancel', offPointer);
    btn.addEventListener('lostpointercapture', () => releaseDir(d, btn));

    btn.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pressDir(d, btn);
    }, { passive: false });
    btn.addEventListener('touchend', (ev) => {
      ev.preventDefault();
      releaseDir(d, btn);
    }, { passive: false });
    btn.addEventListener('touchcancel', () => releaseDir(d, btn));

    btn.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      pressDir(d, btn);
    });
    btn.addEventListener('mouseup', (ev) => {
      ev.preventDefault();
      releaseDir(d, btn);
    });
    btn.addEventListener('mouseleave', () => {
      if (touchDirs[d]) releaseDir(d, btn);
    });
  }

  function joyRender() {
    if (!joyBase || !joyKnob) return;
    joyKnob.style.transform = `translate(calc(-50% + ${joy.x * JOY_R}px), calc(-50% + ${joy.y * JOY_R}px))`;
  }

  function joyUpdate(cx, cy) {
    let dx = cx - joy.ox, dy = cy - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
    let nx = dx / JOY_R, ny = dy / JOY_R;
    // zona morta pequena
    if (Math.hypot(nx, ny) < 0.12) { nx = 0; ny = 0; }
    // zona morta lateral: andar reto sem girar por tremida do dedo
    if (Math.abs(nx) < 0.2) nx = 0;
    joy.x = nx; joy.y = ny;
    joyRender();
  }

  function joyEnd() {
    joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
    if (joyBase) { joyBase.classList.add('hidden'); joyBase.classList.remove('is-active'); }
  }

  function bindJoystick() {
    const zone = document.getElementById('joy-zone');
    joyBase = document.getElementById('joy-base');
    joyKnob = document.getElementById('joy-knob');
    if (!zone || !joyBase) return;
    zone.addEventListener('pointerdown', (e) => {
      if (joy.active) return;
      e.preventDefault();
      const r = zone.getBoundingClientRect();
      joy.active = true; joy.id = e.pointerId;
      joy.ox = e.clientX; joy.oy = e.clientY;
      joy.x = 0; joy.y = 0;
      joyBase.style.left = (e.clientX - r.left) + 'px';
      joyBase.style.top = (e.clientY - r.top) + 'px';
      joyBase.classList.remove('hidden');
      joyBase.classList.add('is-active');
      joyRender();
      try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    });
    zone.addEventListener('pointermove', (e) => {
      if (!joy.active || e.pointerId !== joy.id) return;
      e.preventDefault();
      joyUpdate(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (!joy.active || (e && e.pointerId !== joy.id)) return;
      joyEnd();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  function bind() {
    window.addEventListener('keydown', (e) => {
      const k = keyFromEvent(e);
      keys[k] = true;
      if (e.code) keys['code:' + e.code] = true;
      if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === ' ' || k === 'e') {
        e.preventDefault();
      }
      if (k === ' ' || k === 'e') interactQueued = true;
      if (k === 'escape') pauseQueued = true;
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const k = keyFromEvent(e);
      keys[k] = false;
      if (e.code) keys['code:' + e.code] = false;
    });

    const blockScroll = (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('.overlay')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', blockScroll, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

    document.querySelectorAll('.pad[data-dir]').forEach(bindPad);
    bindJoystick();

    const actBtn = document.getElementById('btn-interact');
    if (actBtn) {
      let downAt = 0;
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = performance.now();
        if (now - downAt < 40) return;
        downAt = now;
        actBtn.classList.add('is-down');
        interactQueued = true;
        try { if (e.pointerId != null) actBtn.setPointerCapture(e.pointerId); } catch (_) {}
      };
      const up = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        actBtn.classList.remove('is-down');
      };
      actBtn.addEventListener('pointerdown', down);
      actBtn.addEventListener('pointerup', up);
      actBtn.addEventListener('pointercancel', up);
      actBtn.addEventListener('touchstart', down, { passive: false });
      actBtn.addEventListener('touchend', up, { passive: false });
      actBtn.addEventListener('mousedown', down);
      actBtn.addEventListener('mouseup', up);
    }
  }

  function consumeInteract() {
    if (!interactQueued) return false;
    interactQueued = false;
    return true;
  }

  function consumePause() {
    if (!pauseQueued) return false;
    pauseQueued = false;
    return true;
  }

  function releaseAllDirs() {
    touchDirs.up = touchDirs.down = touchDirs.left = touchDirs.right = false;
    document.querySelectorAll('.pad.is-down').forEach((b) => b.classList.remove('is-down'));
    joyEnd();
  }

  function movement() {
    if (joy.active && (joy.x || joy.y)) return { x: joy.x, y: joy.y, analog: true };
    let x = 0, y = 0;
    const up = touchDirs.up || keys['w'] || keys['arrowup'] || keys['code:KeyW'] || keys['code:ArrowUp'];
    const down = touchDirs.down || keys['s'] || keys['arrowdown'] || keys['code:KeyS'] || keys['code:ArrowDown'];
    const left = touchDirs.left || keys['a'] || keys['arrowleft'] || keys['code:KeyA'] || keys['code:ArrowLeft'];
    const right = touchDirs.right || keys['d'] || keys['arrowright'] || keys['code:KeyD'] || keys['code:ArrowRight'];
    if (left) x -= 1;
    if (right) x += 1;
    if (up) y -= 1;
    if (down) y += 1;
    if (x && y) { const inv = 1 / Math.SQRT2; x *= inv; y *= inv; }
    return { x, y };
  }

  return { bind, consumeInteract, consumePause, movement, releaseAllDirs };
})();
