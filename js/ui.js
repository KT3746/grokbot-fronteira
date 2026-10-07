/* FRONTEIRA - overlays, HUD, diálogos + wave2/3 meta/tracker/toast/inv */
export const FronteiraUI = (() => {
  const els = {};
  const META_KEY = 'fronteira-daily-meta-v1';
  const ZONE_TOTAL = 6;
  const BEST_KEY = 'fronteira-best-day-v1';

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function loadBest() {
    try {
      const v = parseFloat(localStorage.getItem(BEST_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (_) { return 0; }
  }

  function init() {
    [
      'hud', 'hud-objective', 'hint-bar', 'touch', 'explore-tip', 'juice-fx',
      'quest-toast', 'obj-tracker', 'obj-count', 'compass', 'compass-needle', 'compass-quest',
      'zone-chip', 'inv-strip', 'obj-dist', 'day-timer', 'win-time', 'radar-blip', 'mini-radar',
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
    const best = loadBest();
    const bestTxt = best ? ` · melhor dia ${fmtTime(best)}` : '';
    if (!meta.bestZones && !meta.talks) {
      return best ? `Melhor dia ${fmtTime(best)}` : 'Hoje · ainda sem recordes';
    }
    return `Hoje · zonas ${meta.bestZones}/${ZONE_TOTAL} · falas ${meta.talks}${bestTxt}`;
  }

  /** Wave4 - cronômetro do dia no HUD. */
  function setDayTimer(sec) {
    if (els['day-timer']) els['day-timer'].textContent = '⏱ ' + fmtTime(sec);
  }

  /** Wave4 - salva melhor tempo; retorna { best, isNew, prev }. */
  function recordDayTime(raw) {
    const sec = Math.floor(raw || 0);
    const prev = Math.floor(loadBest());
    const isNew = sec > 0 && (!prev || sec < prev);
    if (isNew) {
      try { localStorage.setItem(BEST_KEY, String(sec)); } catch (_) { /* ok */ }
    }
    return { best: isNew ? sec : prev, isNew, prev };
  }

  /** Wave4 - distância ao objetivo (m) no HUD. */
  function setQuestDistance(dist, label) {
    const el = els['obj-dist'];
    if (!el) return;
    if (dist == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const m = Math.max(0, Math.round(dist));
    const txt = m <= 2 ? 'aqui' : `${m} m`;
    el.textContent = label ? `${label} · ${txt}` : txt;
    el.classList.toggle('is-near', m <= 6);
  }


  /** Wave5 - mini-radar: blip relativo ao jogador (frente = cima). */
  function setRadar(relX, relZ, visible, near) {
    const blip = els['radar-blip'];
    if (!blip) return;
    if (!visible) {
      blip.classList.add('hidden');
      blip.classList.remove('is-near');
      return;
    }
    blip.classList.remove('hidden');
    blip.classList.toggle('is-near', !!near);
    // relX = direita, relZ = frente (já no espaço do jogador, -1..1)
    const R = 14; // px do centro
    const x = Math.max(-1, Math.min(1, relX || 0)) * R;
    const y = Math.max(-1, Math.min(1, -(relZ || 0))) * R; // frente sobe no HUD
    blip.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Wave5 - toast de zona descoberta (titulo central). */
  function flashZoneTitle(name) {
    let el = document.getElementById('zone-title');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zone-title';
      const app = document.getElementById('app');
      if (app) app.appendChild(el);
    }
    if (!el || !name) return;
    el.textContent = name;
    el.classList.remove('is-show');
    void el.offsetWidth;
    el.style.opacity = '1';
    el.classList.add('is-show');
    clearTimeout(flashZoneTitle._t);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flashZoneTitle._t = setTimeout(() => {
      el.classList.remove('is-show');
      el.style.opacity = '0';
    }, reduced ? 900 : 1600);
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

  /** Wave3 - chip de local persistente no HUD. */
  function setZone(name) {
    const el = els['zone-chip'];
    if (el) el.textContent = name || 'Rua Principal';
  }

  /** Wave3 - inventário: itens carregados (encomenda / ferradura / balde). */
  function setInventory(flags) {
    const f = flags || {};
    const map = {
      package: !!(f.hasPackage && !f.deliveredPackage),
      horseshoe: !!(f.hasHorseshoe && !f.returnedShoe),
      water: !!(f.hasWater && !f.deliveredWater),
    };
    Object.keys(map).forEach((key) => {
      const slot = document.querySelector(`.inv-slot[data-item="${key}"]`);
      if (slot) slot.classList.toggle('is-on', map[key]);
    });
  }

  /**
   * Wave3 - seta dourada na bússola aponta ao objetivo.
   * relativeDeg: ângulo em graus (0 = frente do personagem).
   */
  function setQuestArrow(relativeDeg, visible, near) {
    const arrow = els['compass-quest'];
    if (!arrow) return;
    if (!visible) {
      arrow.classList.add('hidden');
      arrow.classList.remove('is-near');
      return;
    }
    arrow.classList.remove('hidden');
    arrow.classList.toggle('is-near', !!near);
    const deg = relativeDeg || 0;
    arrow.style.transform = `translate(-50%, -50%) rotate(${deg}deg) translateY(-15px)`;
  }

  /** Wave3 - vibração curta (Android / Web Vibration). */
  function haptic(pattern) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern == null ? 18 : pattern);
      }
    } catch (_) { /* ok */ }
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
    setQuestArrow(0, false);
    setQuestDistance(null);
    setRadar(0, 0, false);
    setInventory({});
    setZone('Rua Principal');
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

  function showWin(summary, sec, rec) {
    if (els['win-summary']) els['win-summary'].textContent = summary || 'Tarefas: 3/3';
    const wt = els['win-time'];
    if (wt) {
      let txt = `Tempo do dia · ${fmtTime(sec)}`;
      if (rec && rec.isNew) txt += rec.prev ? ` · NOVO RECORDE (antes ${fmtTime(rec.prev)})` : ' · NOVO RECORDE';
      else if (rec && rec.best) txt += ` · recorde ${fmtTime(rec.best)}`;
      wt.textContent = txt;
      wt.classList.toggle('is-record', !!(rec && rec.isNew));
    }
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
    haptic([28, 40, 28]);
  }

  function on(id, ev, fn) {
    const el = els[id] || document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  return {
    init, show, hide, setHudVisible, setTouchVisible, setObjective, setHint,
    setInteractReady, showMenu, showTip, hideOverlays, showPause, hidePause,
    showExploreTip, hideExploreTip, juice, questCompleteFlash,
    setQuestProgress, setCompass, setQuestArrow, setZone, setInventory, haptic,
    recordZoneDiscover, recordTalk, refreshDailyMeta,
    setDayTimer, recordDayTime, setQuestDistance, setRadar, flashZoneTitle,
    showDialog, advanceDialog, showWin, updateMuteLabels, on, get els() { return els; },
  };
})();
