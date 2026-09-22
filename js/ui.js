/* FRONTEIRA — overlays, HUD, diálogos */
const FronteiraUI = (() => {
  const els = {};

  function init() {
    [
      'hud', 'hud-objective', 'hint-bar', 'touch',
      'screen-menu', 'screen-tip', 'screen-pause', 'screen-dialog', 'screen-win',
      'dialog-name', 'dialog-text', 'btn-dialog-next',
      'btn-play', 'btn-tip-ok', 'btn-resume', 'btn-restart', 'btn-menu',
      'btn-mute', 'btn-mute-menu', 'btn-pause', 'btn-win-again', 'btn-win-menu',
      'win-summary', 'btn-interact',
    ].forEach((id) => { els[id] = document.getElementById(id); });
  }

  function show(id) {
    const el = els[id] || document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }
  function hide(id) {
    const el = els[id] || document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  function setHudVisible(v) {
    if (v) show('hud'); else hide('hud');
  }
  function setTouchVisible(v) {
    if (v) show('touch'); else hide('touch');
  }
  function setObjective(text) {
    if (els['hud-objective']) els['hud-objective'].textContent = text || 'Explore o povoado';
  }
  function setHint(text, visible) {
    const bar = els['hint-bar'];
    if (!bar) return;
    if (visible && text) {
      bar.textContent = text;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }
  function setInteractReady(on) {
    const b = els['btn-interact'];
    if (b) b.classList.toggle('can-use', !!on);
  }

  function showMenu() {
    hide('screen-tip'); hide('screen-pause'); hide('screen-dialog'); hide('screen-win');
    show('screen-menu');
    setHudVisible(false);
    setTouchVisible(false);
    setHint('', false);
  }
  function showTip() {
    hide('screen-menu');
    show('screen-tip');
  }
  function hideOverlays() {
    hide('screen-menu'); hide('screen-tip'); hide('screen-pause');
    hide('screen-dialog'); hide('screen-win');
  }
  function showPause() {
    show('screen-pause');
  }
  function hidePause() {
    hide('screen-pause');
  }

  let dialogQueue = [];
  let dialogName = '';
  let onDialogDone = null;

  function showDialog(name, lines, done) {
    dialogName = name || '';
    dialogQueue = Array.isArray(lines) ? lines.slice() : [String(lines)];
    onDialogDone = done || null;
    if (els['dialog-name']) els['dialog-name'].textContent = dialogName;
    advanceDialog();
    show('screen-dialog');
  }

  function advanceDialog() {
    if (!dialogQueue.length) {
      hide('screen-dialog');
      const cb = onDialogDone;
      onDialogDone = null;
      if (cb) cb();
      return false;
    }
    const line = dialogQueue.shift();
    if (els['dialog-text']) els['dialog-text'].textContent = line;
    if (els['btn-dialog-next']) {
      els['btn-dialog-next'].textContent = dialogQueue.length ? 'Continuar' : 'Fechar';
    }
    return true;
  }

  function showWin(summary) {
    if (els['win-summary']) els['win-summary'].textContent = summary || 'Tarefas: 3/3';
    show('screen-win');
    setTouchVisible(false);
  }

  function updateMuteLabels(muted) {
    const icon = muted ? '🔇' : '🔊';
    if (els['btn-mute']) {
      els['btn-mute'].textContent = icon;
      els['btn-mute'].setAttribute('aria-label', muted ? 'Som' : 'Mudo');
    }
    if (els['btn-mute-menu']) {
      els['btn-mute-menu'].textContent = muted ? 'Mudo: on' : 'Mudo: off';
    }
  }

  function on(id, ev, fn) {
    const el = els[id] || document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  return {
    init, show, hide, setHudVisible, setTouchVisible, setObjective, setHint,
    setInteractReady, showMenu, showTip, hideOverlays, showPause, hidePause,
    showDialog, advanceDialog, showWin, updateMuteLabels, on, get els() { return els; },
  };
})();
