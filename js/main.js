/* FRONTEIRA — boot */
(function () {
  const canvas = document.getElementById('game');
  FronteiraUI.init();
  FronteiraInput.bind();
  FronteiraGame.init(canvas);

  const muted = FronteiraAudio.loadMute();
  FronteiraUI.updateMuteLabels(muted);
  FronteiraAudio.setMuted(muted);

  let tipSeen = false;
  try { tipSeen = localStorage.getItem('fronteira_tip') === '1'; } catch (_) {}

  function unlockAudio() {
    FronteiraAudio.unlock();
  }

  function toggleMute() {
    unlockAudio();
    const m = !FronteiraAudio.isMuted();
    FronteiraAudio.setMuted(m);
    FronteiraUI.updateMuteLabels(m);
  }

  function beginPlay() {
    unlockAudio();
    if (!tipSeen) {
      FronteiraUI.showTip();
      return;
    }
    FronteiraGame.start();
  }

  FronteiraUI.on('btn-play', 'click', beginPlay);
  FronteiraUI.on('btn-tip-ok', 'click', () => {
    tipSeen = true;
    try { localStorage.setItem('fronteira_tip', '1'); } catch (_) {}
    FronteiraGame.start();
  });
  FronteiraUI.on('btn-pause', 'click', () => {
    if (FronteiraGame.running) FronteiraGame.pause();
  });
  FronteiraUI.on('btn-resume', 'click', () => FronteiraGame.resume());
  FronteiraUI.on('btn-restart', 'click', () => {
    FronteiraUI.hidePause();
    FronteiraGame.start();
  });
  FronteiraUI.on('btn-menu', 'click', () => FronteiraGame.stopToMenu());
  FronteiraUI.on('btn-mute', 'click', toggleMute);
  FronteiraUI.on('btn-mute-menu', 'click', toggleMute);
  FronteiraUI.on('btn-dialog-next', 'click', () => FronteiraUI.advanceDialog());
  FronteiraUI.on('btn-win-again', 'click', () => FronteiraGame.start());
  FronteiraUI.on('btn-win-menu', 'click', () => FronteiraGame.stopToMenu());

  FronteiraUI.showMenu();
})();
