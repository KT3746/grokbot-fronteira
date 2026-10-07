/* FRONTEIRA - boot (ES module) */
import { FronteiraAudio } from './audio.js?v=202610070445';
import { FronteiraInput } from './input.js?v=202610070445';
import { FronteiraUI } from './ui.js?v=202610070445';
import { FronteiraGame } from './game.js?v=202610070445';

const canvas = document.getElementById('game');
FronteiraUI.init();
FronteiraInput.bind();
FronteiraGame.init(canvas);

const muted = FronteiraAudio.loadMute();
FronteiraUI.updateMuteLabels(muted);
FronteiraAudio.setMuted(muted);

const TIP_KEY = 'fronteira_tip';
let tipSeen = false;
try { tipSeen = localStorage.getItem(TIP_KEY) === '1'; } catch (_) {}

function unlockAudio() {
  FronteiraAudio.unlock();
}

function toggleMute() {
  unlockAudio();
  const m = !FronteiraAudio.isMuted();
  FronteiraAudio.setMuted(m);
  FronteiraUI.updateMuteLabels(m);
}

function markTipSeen() {
  if (tipSeen) return;
  tipSeen = true;
  try { localStorage.setItem(TIP_KEY, '1'); } catch (_) {}
  FronteiraUI.hideExploreTip();
}

/** First-minute PT-BR tip: dismiss on first move/interact; once via localStorage. */
function armExploreTip() {
  if (tipSeen) {
    FronteiraUI.hideExploreTip();
    return;
  }
  FronteiraUI.showExploreTip();
  const started = performance.now();
  const MAX_MS = 60_000;

  const onDismiss = () => {
    markTipSeen();
    cleanup();
  };

  const tick = () => {
    if (tipSeen) return;
    if (performance.now() - started > MAX_MS) {
      markTipSeen();
      cleanup();
      return;
    }
    const m = FronteiraInput.movement();
    if (Math.hypot(m.x, m.y) > 0.05) {
      onDismiss();
      return;
    }
    tipRaf = requestAnimationFrame(tick);
  };

  let tipRaf = requestAnimationFrame(tick);
  const tipEl = document.getElementById('explore-tip');
  const onTipTap = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onDismiss();
  };
  if (tipEl) tipEl.addEventListener('pointerdown', onTipTap);

  // Interact (E / button) also dismisses
  const interactWatch = setInterval(() => {
    if (tipSeen) { clearInterval(interactWatch); return; }
    // consumeInteract is owned by game loop - watch movement + tip tap primarily;
    // game.js also calls notifyInteract for dismiss.
  }, 500);

  function cleanup() {
    cancelAnimationFrame(tipRaf);
    clearInterval(interactWatch);
    if (tipEl) tipEl.removeEventListener('pointerdown', onTipTap);
  }

  // Expose dismiss for game interact / move hook
  FronteiraGame.onFirstInteract = onDismiss;
}

function beginPlay() {
  unlockAudio();
  // Skip blocking how-to; in-game first-minute tip covers explore guidance.
  FronteiraGame.start();
  armExploreTip();
}

FronteiraUI.on('btn-play', 'click', beginPlay);
FronteiraUI.on('btn-tip-ok', 'click', () => {
  markTipSeen();
  FronteiraGame.start();
  // tip already seen - no armExploreTip
});
FronteiraUI.on('btn-pause', 'click', () => {
  if (FronteiraGame.running) {
    FronteiraGame.pause();
    try { FronteiraAudio.suspend(); } catch (_) { /* ok */ }
    try { FronteiraInput.releaseAllDirs(); } catch (_) { /* ok */ }
  }
});
FronteiraUI.on('btn-resume', 'click', () => {
  try { FronteiraAudio.resume(); } catch (_) { /* ok */ }
  FronteiraGame.resume();
});
FronteiraUI.on('btn-restart', 'click', () => {
  FronteiraUI.hidePause();
  FronteiraGame.start();
  armExploreTip();
});
FronteiraUI.on('btn-menu', 'click', () => FronteiraGame.stopToMenu());
FronteiraUI.on('btn-mute', 'click', toggleMute);
FronteiraUI.on('btn-mute-menu', 'click', toggleMute);
FronteiraUI.on('btn-dialog-next', 'click', () => FronteiraUI.advanceDialog());
/* Wave3 - toque em qualquer lugar do diálogo avança (mobile). */
(() => {
  const dlg = document.getElementById('screen-dialog');
  if (!dlg) return;
  dlg.addEventListener('pointerdown', (e) => {
    if (dlg.classList.contains('hidden')) return;
    const t = e.target;
    if (t && t.id === 'btn-dialog-next') return;
    if (t && t.closest && t.closest('#btn-dialog-next')) return;
    e.preventDefault();
    FronteiraUI.advanceDialog();
  });
})();
FronteiraUI.on('btn-win-again', 'click', () => {
  FronteiraGame.start();
  armExploreTip();
});
FronteiraUI.on('btn-win-menu', 'click', () => FronteiraGame.stopToMenu());

FronteiraUI.showMenu();

/* Aba/app oculta mid-jogo: pausa + suspende áudio (mesmo bar ECO/MERCADINHO). */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    /* Continuar na pausa: áudio só volta com resume / Continuar. */
    return;
  }
  try { FronteiraAudio.suspend(); } catch (_) { /* ok */ }
  if (FronteiraGame.running) {
    FronteiraGame.pause();
    try { FronteiraInput.releaseAllDirs(); } catch (_) { /* ok */ }
  }
});
