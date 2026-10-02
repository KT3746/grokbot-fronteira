/* FRONTEIRA — overlays, HUD, diálogos + wave2 meta/tracker/toast */
export const FronteiraUI = (() => {
  const els = {};
  const META_KEY = 'fronteira-daily-meta-v1';
  const ZONE_TOTAL = 6;

  function init() {
    [
      'hud', 'hud-objective', 'hint-bar', 'touch', 'explore-tip', 'juice-fx',
      'quest-toast', 'obj-tracker', 'obj-count', 'compass', 'compass-needle',
      'daily-meta', 'daily-meta-win',
      'screen-menu', 'screen-tip', 'screen-pause', 'screen-dialog', 'screen-win',
      'dialog-name', 'dialog-text', 'btn-dialog-next', 'pause-objective',
      'btn-play', 'btn-tip-ok', 'btn-resume', 'btn-restart', 'btn-menu',
      'btn-mute', 'btn-mute-menu', 'btn-pause', 'btn-win-again', 'btn-win-menu',
      'win-summary', 'btn-interact',
    ].forEach((id) => { els[id] = document.getElementById(id); });
    refreshDailyMeta();
  }

  function brtDayKey() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
    } catch (_) {
      const d = new Date(Date.now() - 3 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    }
  }

  function loadDailyMeta() {
    const day = brtDayKey();
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.day === day) {
          return {
            day,
            bestZones: Math.max(0, o.bestZones | 0),
            talks: Math.max(0, o.talks | 0),
            zones: Array.isArray(o.zones) ? o.zones.slice() : [],
          };
        }
      }
    } catch (_) { /* ok */ }
    return { day, bestZones: 0, talks: 0, zones: [] };
  }

  function saveDailyMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (_) { /* ok */ }
  }

  function formatDailyMeta(meta) {
    if (!meta.bestZones && !meta.talks) {
      return 'Hoje · ainda sem recordes';
    }
    return `Hoje · zonas ${meta.bestZones}/${ZONE_TOTAL} · falas ${meta.talks}`;
  }

  function refreshDailyMeta() {
    const meta = loadDailyMeta();
    const text = formatDailyMeta(meta);
    if (els['daily-meta']) els['daily-meta'].textContent = text;
    if (els['daily-meta-win']) els['daily-meta-win'].textContent = text;
  }

  /** Soft daily: max zonas descobertas + contagem de falas (PT-BR). */
  function recordZoneDiscover(zoneName) {
    if (!zoneName) return loadDailyMeta();
    const meta = loadDailyMeta();
    if (!meta.zones.includes(zoneName)) {
      meta.zones.push(zoneName);
    }
    meta.bestZones = Math.max(meta.bestZones, meta.zones.length);
    saveDailyMeta(meta);
    refreshDailyMeta();
    return meta;
  }

  function recordTalk() {
    const meta = loadDailyMeta();
    meta.talks += 1;
    saveDailyMeta(meta);
    refreshDailyMeta();
    return meta;
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
    const v = text || 'Explore o povoado';
    if (els['hud-objective']) els['hud-objective'].textContent = v;
    if (els['pause-objective']) els['pause-objective'].textContent = v;
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

  /** Progresso 0–3 no HUD (clareza mobile). */
  function setQuestProgress(doneMap) {
    const ids = ['entrega', 'ferradura', 'agua'];
    let n = 0;
    ids.forEach((id) => {
      const on = !!(doneMap && doneMap[id]);
      if (on) n++;
      const dot = document.querySelector(`.obj-dot[data-q="${id}"]`);
      if (dot) dot.classList.toggle('is-done', on);
    });
    if (els['obj-count']) els['obj-count'].textContent = `${n}/3`;
  }

  /** Bússola: player.ang 0 = olhando +Z (norte do povoado). */
  function setCompass(ang) {
    const needle = els['compass-needle'];
    if (!needle) return;
    const deg = (-(ang || 0) * 180) / Math.PI;
    needle.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
  }

  function showMenu() {
    hide('screen-tip'); hide('screen-pause'); hide('screen-dialog'); hide('screen-win');
    hide('explore-tip'); hide('quest-toast');
    show('screen-menu');
    setHudVisible(false);
    setTouchVisible(false);
    setHint('', false);
    refreshDailyMeta();
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
    if (els['pause-objective'] && els['hud-objective']) {
      els['pause-objective'].textContent = els['hud-objective'].textContent || 'Explore o povoado';
    }
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
    refreshDailyMeta();
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

  function showExploreTip() {
    show('explore-tip');
  }
  function hideExploreTip() {
    hide('explore-tip');
  }
  function juice(kind) {
    const fx = els['juice-fx'];
    if (!fx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    fx.classList.remove('is-flash', 'is-pop', 'is-quest');
    void fx.offsetWidth;
    const cls = kind === 'pop' ? 'is-pop' : (kind === 'quest' ? 'is-quest' : 'is-flash');
    fx.classList.add(cls);
    clearTimeout(juice._t);
    juice._t = setTimeout(() => {
      fx.classList.remove('is-flash', 'is-pop', 'is-quest');
    }, 700);
  }

  /** Toast de tarefa + flash; reduced-motion: toast estático sem animação. */
  function questCompleteFlash(label) {
    const toast = els['quest-toast'];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (toast) {
      toast.textContent = label ? `Tarefa concluída · ${label}` : 'Tarefa concluída';
      toast.classList.remove('hidden', 'is-show');
      void toast.offsetWidth;
      toast.classList.add('is-show');
      if (reduced) toast.classList.add('is-static');
      else toast.classList.remove('is-static');
      clearTimeout(questCompleteFlash._t);
      questCompleteFlash._t = setTimeout(() => {
        toast.classList.remove('is-show');
        toast.classList.add('hidden');
      }, reduced ? 1600 : 2200);
    }
    if (!reduced) juice('quest');
  }

  function on(id, ev, fn) {
    const el = els[id] || document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  return {
    init, show, hide, setHudVisible, setTouchVisible, setObjective, setHint,
    setInteractReady, showMenu, showTip, hideOverlays, showPause, hidePause,
    showExploreTip, hideExploreTip, juice, questCompleteFlash,
    setQuestProgress, setCompass,
    recordZoneDiscover, recordTalk, refreshDailyMeta,
    showDialog, advanceDialog, showWin, updateMuteLabels, on, get els() { return els; },
  };
})();
