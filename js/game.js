/* FRONTEIRA — loop, movimento, render, missões */
const FronteiraGame = (() => {
  const PLAYER_R = 11;
  const SPEED = 118; // px/s

  let canvas, ctx;
  let running = false;
  let paused = false;
  let lastT = 0;
  let camX = 0, camY = 0;
  let player = { x: 0, y: 0 };
  let dayT = 0; // 0..1 tint cycle while playing
  let state = null;
  let near = null;
  let won = false;
  let reducedMotion = false;

  function freshState() {
    return {
      flags: {
        talkedZe: false,
        hasPackage: false,
        deliveredPackage: false,
        talkedTiao: false,
        hasHorseshoe: false,
        returnedShoe: false,
        talkedRita: false,
        hasWater: false,
        deliveredWater: false,
      },
      questDone: { entrega: false, ferradura: false, agua: false },
      activeFocus: 'entrega',
    };
  }

  function spawn() {
    const { TILE } = FronteiraWorld;
    player.x = 21 * TILE;
    player.y = 18 * TILE;
    FronteiraWorld.resetItems();
    state = freshState();
    dayT = 0.18;
    won = false;
    near = null;
  }

  function objectiveText() {
    const f = state.flags;
    const qd = state.questDone;
    if (!qd.entrega) {
      if (!f.talkedZe) return 'Fale com Seu Zé no armazém';
      if (f.hasPackage && !f.deliveredPackage) return 'Entregue a encomenda na cantina';
    }
    if (!qd.ferradura) {
      if (!f.talkedTiao) return 'Fale com Tião no estábulo';
      if (f.talkedTiao && !f.hasHorseshoe) return 'Ache a ferradura no mato ao sul';
      if (f.hasHorseshoe && !f.returnedShoe) return 'Devolva a ferradura ao Tião';
    }
    if (!qd.agua) {
      if (!f.talkedRita) return 'Fale com Rita na praça';
      if (f.talkedRita && !f.hasWater) return 'Encha o balde no poço';
      if (f.hasWater && !f.deliveredWater) return 'Leve a água à Dona Clara';
    }
    return 'Dia tranquilo — explore o povoado';
  }

  function countDone() {
    let n = 0;
    if (state.questDone.entrega) n++;
    if (state.questDone.ferradura) n++;
    if (state.questDone.agua) n++;
    return n;
  }

  function checkWin() {
    if (won) return;
    if (countDone() >= 3) {
      won = true;
      running = false;
      FronteiraAudio.questDone();
      FronteiraUI.showWin('Tarefas: 3/3 — o sertão respira.');
    }
  }

  function markQuest(id) {
    if (state.questDone[id]) return;
    state.questDone[id] = true;
    FronteiraAudio.questDone();
    FronteiraUI.setObjective(objectiveText());
    checkWin();
  }

  function talkNpc(npc) {
    const f = state.flags;
    const lines = [];
    let after = null;

    if (npc.id === 'seu_ze') {
      if (!f.talkedZe) {
        lines.push(...npc.lines.quest_give);
        after = () => {
          f.talkedZe = true;
          f.hasPackage = true;
          FronteiraUI.setObjective(objectiveText());
        };
      } else if (f.deliveredPackage) {
        lines.push(...npc.lines.after);
      } else if (f.hasPackage) {
        lines.push('Ainda com o embrulho? A cantina fica a leste da praça.');
      } else {
        lines.push(...npc.lines.idle);
      }
    } else if (npc.id === 'dona_clara') {
      if (f.hasPackage && !f.deliveredPackage) {
        lines.push(...npc.lines.receive);
        after = () => {
          f.hasPackage = false;
          f.deliveredPackage = true;
          markQuest('entrega');
        };
      } else if (f.hasWater && !f.deliveredWater) {
        lines.push('Água do poço! Rita mandou bem. Obrigada.');
        after = () => {
          f.hasWater = false;
          f.deliveredWater = true;
          markQuest('agua');
        };
      } else if (f.deliveredPackage && !f.talkedRita) {
        lines.push(...npc.lines.need_water);
      } else if (f.deliveredWater) {
        lines.push(...npc.lines.after);
      } else {
        lines.push(...npc.lines.idle);
      }
    } else if (npc.id === 'tiao') {
      if (!f.talkedTiao) {
        lines.push(...npc.lines.idle);
        after = () => {
          f.talkedTiao = true;
          FronteiraUI.setObjective(objectiveText());
        };
      } else if (f.hasHorseshoe && !f.returnedShoe) {
        lines.push(...npc.lines.found);
        after = () => {
          f.hasHorseshoe = false;
          f.returnedShoe = true;
          markQuest('ferradura');
        };
      } else if (f.returnedShoe) {
        lines.push(...npc.lines.after);
      } else {
        lines.push('A ferradura deve estar no mato, ao sul do estábulo.');
      }
    } else if (npc.id === 'padre_elias') {
      lines.push(...npc.lines.idle);
      lines.push(...npc.lines.bless);
    } else if (npc.id === 'rita') {
      if (!f.talkedRita) {
        lines.push(...npc.lines.idle);
        after = () => {
          f.talkedRita = true;
          FronteiraUI.setObjective(objectiveText());
        };
      } else if (f.deliveredWater) {
        lines.push(...npc.lines.thanks);
        lines.push(...npc.lines.after);
      } else if (f.hasWater) {
        lines.push(...npc.lines.got_water);
      } else {
        lines.push('O poço fica bem no meio da praça. Enche o balde aí.');
      }
    } else {
      lines.push('…');
    }

    FronteiraAudio.interactChime();
    FronteiraUI.showDialog(npc.name, lines, after);
  }

  function useSpot(spot) {
    const f = state.flags;
    if (spot.kind === 'npc_link') {
      const npc = FronteiraWorld.npcs.find((n) => n.id === spot.npc);
      if (npc) talkNpc(npc);
      return;
    }
    if (spot.kind === 'well') {
      if (f.talkedRita && !f.hasWater && !f.deliveredWater) {
        FronteiraAudio.interactChime();
        FronteiraUI.showDialog('Poço', [
          'Você enche o balde. A água vem fria, cheirando a barro bom.',
        ], () => {
          f.hasWater = true;
          FronteiraUI.setObjective(objectiveText());
        });
      } else if (f.hasWater) {
        FronteiraUI.showDialog('Poço', ['O balde já está cheio.']);
        FronteiraAudio.interactChime();
      } else if (f.deliveredWater) {
        FronteiraUI.showDialog('Poço', ['Água clara. O dia já foi servido.']);
        FronteiraAudio.interactChime();
      } else {
        FronteiraUI.showDialog('Poço', [
          'Poço da praça. Rita costuma mandar gente buscar água.',
        ]);
        FronteiraAudio.interactChime();
      }
      return;
    }
    if (spot.kind === 'item' && spot.item === 'ferradura') {
      if (spot.collected) return;
      if (!f.talkedTiao) {
        FronteiraUI.showDialog('Mato', [
          'Uma ferradura no chão… talvez alguém do estábulo precise.',
        ]);
        FronteiraAudio.interactChime();
        return;
      }
      spot.collected = true;
      f.hasHorseshoe = true;
      FronteiraAudio.interactChime();
      FronteiraUI.showDialog('Ferradura', [
        'Você achou a ferradura perdida do Tião.',
      ], () => FronteiraUI.setObjective(objectiveText()));
    }
  }

  function tryInteract() {
    if (!near) return;
    if (near.type === 'npc') talkNpc(near.ref);
    else if (near.type === 'spot') useSpot(near.ref);
  }

  function move(dt) {
    const m = FronteiraInput.movement();
    if (!m.x && !m.y) return;
    const dist = SPEED * dt;
    const tryX = player.x + m.x * dist;
    const tryY = player.y + m.y * dist;
    const box = (x, y) => ({ x: x - PLAYER_R, y: y - PLAYER_R + 2, w: PLAYER_R * 2, h: PLAYER_R * 2 - 2 });

    if (!FronteiraWorld.collides(box(tryX, player.y))) player.x = tryX;
    if (!FronteiraWorld.collides(box(player.x, tryY))) player.y = tryY;

    FronteiraAudio.footstep();
  }

  function updateNear() {
    near = FronteiraWorld.nearInteract(player.x, player.y, 28);
    let hint = '';
    if (near) {
      if (near.type === 'npc') hint = near.ref.name + ' — Interagir';
      else hint = (near.ref.hint || 'Interagir') + ' — Interagir';
    }
    FronteiraUI.setHint(hint, !!near);
    FronteiraUI.setInteractReady(!!near);
  }

  function updateCamera() {
    const { w, h } = FronteiraWorld.worldPixelSize();
    const vw = canvas.width;
    const vh = canvas.height;
    camX = player.x - vw / 2;
    camY = player.y - vh / 2;
    camX = Math.max(0, Math.min(camX, w - vw));
    camY = Math.max(0, Math.min(camY, h - vh));
  }

  function dayTint() {
    // morning → noon → late afternoon
    const t = dayT % 1;
    if (t < 0.35) return { r: 255, g: 220, b: 160, a: 0.06 + t * 0.05 };
    if (t < 0.65) return { r: 255, g: 250, b: 230, a: 0.03 };
    return { r: 220, g: 140, b: 80, a: 0.08 + (t - 0.65) * 0.2 };
  }

  function drawGround() {
    const { TILE, ground, W, H } = FronteiraWorld;
    const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const x1 = Math.min(W - 1, Math.ceil((camX + canvas.width) / TILE) + 1);
    const y1 = Math.min(H - 1, Math.ceil((camY + canvas.height) / TILE) + 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = ground[y][x];
        const px = x * TILE - camX;
        const py = y * TILE - camY;
        let c = '#9a7a52';
        if (t === 1) c = '#b89868';
        else if (t === 2) c = '#5a6a3a';
        else if (t === 3) c = '#4a7088';
        else if (t === 4) c = '#a88858';
        ctx.fillStyle = c;
        ctx.fillRect(px, py, TILE + 0.5, TILE + 0.5);
        // subtle grit
        if ((x + y) % 3 === 0) {
          ctx.fillStyle = 'rgba(60,40,20,0.08)';
          ctx.fillRect(px + 4, py + 6, 3, 2);
        }
      }
    }
  }

  function drawBuilding(s) {
    const px = s.x - camX;
    const py = s.y - camY;
    if (s.label && s.label.startsWith('cerca')) {
      ctx.fillStyle = '#6a4a32';
      ctx.fillRect(px, py, s.w, s.h);
      return;
    }
    if (s.label && s.label.startsWith('poco')) {
      ctx.fillStyle = '#5a5048';
      ctx.fillRect(px, py, s.w, s.h);
      return;
    }
    // building body
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(px, py, s.w, s.h);
    // roof
    ctx.fillStyle = '#3d2a1f';
    ctx.beginPath();
    ctx.moveTo(px - 4, py + 10);
    ctx.lineTo(px + s.w / 2, py - 18);
    ctx.lineTo(px + s.w + 4, py + 10);
    ctx.closePath();
    ctx.fill();
    // door
    ctx.fillStyle = '#2a1c14';
    const dw = Math.min(28, s.w * 0.28);
    ctx.fillRect(px + s.w / 2 - dw / 2, py + s.h - 36, dw, 36);
    // label
    const names = {
      capela: 'Capela', armazem: 'Armazém', cantina: 'Cantina',
      estabulo: 'Estábulo', casa1: 'Casa', casa2: 'Casa',
    };
    if (names[s.label]) {
      ctx.fillStyle = 'rgba(242,230,212,0.85)';
      ctx.font = '600 11px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(names[s.label], px + s.w / 2, py + 18);
    }
  }

  function drawNpcs() {
    for (const n of FronteiraWorld.npcs) {
      const px = n.x - camX;
      const py = n.y - camY;
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n.hat || '#3a2818';
      ctx.fillRect(px - 10, py - 16, 20, 7);
      ctx.fillStyle = '#f2e6d4';
      ctx.font = '600 10px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.name, px, py - 20);
    }
  }

  function drawItems() {
    for (const it of FronteiraWorld.interactables) {
      if (it.kind !== 'item' || it.collected) continue;
      const px = it.x + it.w / 2 - camX;
      const py = it.y + it.h / 2 - camY;
      ctx.fillStyle = '#c4a574';
      ctx.beginPath();
      ctx.ellipse(px, py, 8, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c3d2e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const px = player.x - camX;
    const py = player.y - camY;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, py + 10, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = '#4a6a7a';
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    // hat brim
    ctx.fillStyle = '#3d2a1f';
    ctx.fillRect(px - 13, py - 12, 26, 5);
    ctx.fillRect(px - 7, py - 18, 14, 8);
  }

  function drawWellCenter() {
    const { TILE } = FronteiraWorld;
    const cx = 20.5 * TILE - camX;
    const cy = 14.8 * TILE - camY;
    ctx.fillStyle = '#3a5a6a';
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a5048';
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  function render() {
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGround();
    drawWellCenter();
    for (const s of FronteiraWorld.solids) {
      if (s.label && s.label.startsWith('poco')) continue;
      drawBuilding(s);
    }
    // poco rims last-ish
    for (const s of FronteiraWorld.solids) {
      if (s.label && s.label.startsWith('poco')) drawBuilding(s);
    }
    drawItems();
    drawNpcs();
    drawPlayer();

    const tint = dayTint();
    if (tint.a > 0) {
      ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function frame(t) {
    if (!canvas) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;

    if (running && !paused && !won) {
      if (FronteiraInput.consumePause()) {
        pause();
      } else {
        const dialogOpen = !document.getElementById('screen-dialog').classList.contains('hidden');
        if (!dialogOpen) {
          move(dt);
          if (!reducedMotion) dayT += dt * 0.012;
          updateNear();
          if (FronteiraInput.consumeInteract()) tryInteract();
        } else if (FronteiraInput.consumeInteract()) {
          FronteiraUI.advanceDialog();
        }
        updateCamera();
      }
    } else if (!running && !won) {
      // still draw if on menu? menu covers
    }

    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    updateCamera();
  }

  function start() {
    spawn();
    running = true;
    paused = false;
    won = false;
    FronteiraUI.hideOverlays();
    FronteiraUI.setHudVisible(true);
    FronteiraUI.setTouchVisible(true);
    FronteiraUI.setObjective(objectiveText());
    FronteiraInput.releaseAllDirs();
    lastT = performance.now();
  }

  function pause() {
    if (!running || won) return;
    paused = true;
    FronteiraUI.showPause();
  }

  function resume() {
    paused = false;
    FronteiraUI.hidePause();
    FronteiraInput.releaseAllDirs();
    lastT = performance.now();
  }

  function stopToMenu() {
    running = false;
    paused = false;
    won = false;
    FronteiraUI.showMenu();
  }

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resize();
    window.addEventListener('resize', resize);
    spawn();
    updateCamera();
    requestAnimationFrame(frame);
  }

  return { init, start, pause, resume, stopToMenu, tryInteract, get running() { return running; } };
})();
