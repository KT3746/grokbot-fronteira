/* FRONTEIRA — loop, movimento, render ¾ / obliquo */
const FronteiraGame = (() => {
  const PLAYER_R = 11;
  const SPEED = 118;
  const Y_SCALE = 0.55; // foreshortening — visão mais horizontal
  const CHAR_H = 28;

  let canvas, ctx;
  let running = false;
  let paused = false;
  let lastT = 0;
  let camX = 0, camY = 0;
  let player = { x: 0, y: 0 };
  let dayT = 0;
  let state = null;
  let near = null;
  let won = false;
  let reducedMotion = false;
  let bobT = 0;
  let dust = [];

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
    bobT = 0;
    initDust();
  }

  function initDust() {
    dust = [];
    if (reducedMotion) return;
    for (let i = 0; i < 18; i++) {
      dust.push({
        x: Math.random(),
        y: Math.random(),
        s: 0.6 + Math.random() * 1.4,
        sp: 0.015 + Math.random() * 0.03,
        a: 0.08 + Math.random() * 0.12,
      });
    }
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

  /* ——— projection ——— */
  function w2s(wx, wy) {
    return { x: wx - camX, y: wy * Y_SCALE - camY };
  }

  function updateCamera() {
    const { w, h } = FronteiraWorld.worldPixelSize();
    const vw = canvas.width;
    const vh = canvas.height;
    const projH = h * Y_SCALE;
    // follow player; bias slightly down so facades stay visible above feet
    camX = player.x - vw * 0.5;
    camY = player.y * Y_SCALE - vh * 0.58;
    const padTop = 40;
    camX = Math.max(0, Math.min(camX, Math.max(0, w - vw)));
    camY = Math.max(-padTop, Math.min(camY, Math.max(-padTop, projH - vh + 20)));
  }

  function dayTint() {
    const t = dayT % 1;
    if (t < 0.35) return { r: 255, g: 210, b: 150, a: 0.04 + t * 0.03 };
    if (t < 0.65) return { r: 255, g: 248, b: 230, a: 0.02 };
    return { r: 220, g: 140, b: 80, a: 0.05 + (t - 0.65) * 0.12 };
  }

  /* ——— ground ——— */
  function hash2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function drawSky() {
    const vh = canvas.height;
    const vw = canvas.width;
    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.42);
    g.addColorStop(0, '#6a8aaa');
    g.addColorStop(0.35, '#87a0b8');
    g.addColorStop(0.7, '#b8a888');
    g.addColorStop(1, '#c4a574');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh * 0.42);

    // distant hills / scrub silhouette (parallax)
    const baseY = vh * 0.34;
    ctx.fillStyle = '#5a4a38';
    ctx.beginPath();
    ctx.moveTo(0, baseY + 40);
    for (let x = 0; x <= vw + 40; x += 28) {
      const wx = (x + camX * 0.25) * 0.04;
      const hy = baseY - 18 - Math.sin(wx) * 14 - Math.sin(wx * 0.37) * 8;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(vw, baseY + 50);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4a5a32';
    ctx.beginPath();
    ctx.moveTo(0, baseY + 55);
    for (let x = 0; x <= vw + 40; x += 22) {
      const wx = (x + camX * 0.4) * 0.06;
      const hy = baseY + 8 - Math.abs(Math.sin(wx * 1.3)) * 12;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(vw, baseY + 70);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    const { TILE, ground, W, H } = FronteiraWorld;
    const th = TILE * Y_SCALE;
    const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const y0 = Math.max(0, Math.floor((camY / Y_SCALE) / TILE) - 1);
    const x1 = Math.min(W - 1, Math.ceil((camX + canvas.width) / TILE) + 1);
    const y1 = Math.min(H - 1, Math.ceil(((camY + canvas.height) / Y_SCALE) / TILE) + 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = ground[y][x];
        const p = w2s(x * TILE, y * TILE);
        const n = hash2(x, y);
        let c0, c1;
        if (t === 1) { c0 = '#b89868'; c1 = '#a88858'; }
        else if (t === 2) { c0 = '#5a6a3a'; c1 = '#4a5a2e'; }
        else if (t === 3) { c0 = '#3a6080'; c1 = '#2a5070'; }
        else if (t === 4) { c0 = '#a88858'; c1 = '#987848'; }
        else { c0 = '#9a7a52'; c1 = '#8a6a42'; }

        ctx.fillStyle = n > 0.5 ? c0 : c1;
        ctx.fillRect(p.x, p.y, TILE + 0.6, th + 0.6);

        // ruts on roads
        if (t === 4 && n > 0.55) {
          ctx.strokeStyle = 'rgba(60,40,20,0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x + 4, p.y + th * 0.35);
          ctx.lineTo(p.x + TILE - 4, p.y + th * 0.4);
          ctx.stroke();
        }
        // plaza grit
        if (t === 1 && (x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(80,55,30,0.12)';
          ctx.fillRect(p.x + 6 + n * 8, p.y + th * 0.3, 2, 1.5);
        }
        // grass tufts
        if (t === 2 || (t === 0 && n > 0.82)) {
          ctx.strokeStyle = n > 0.5 ? '#6a7a3a' : '#4a5a28';
          ctx.lineWidth = 1.2;
          const gx = p.x + 6 + n * (TILE - 12);
          const gy = p.y + th * 0.7;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx - 2, gy - 5 - n * 3);
          ctx.moveTo(gx + 2, gy);
          ctx.lineTo(gx + 3, gy - 4);
          ctx.stroke();
        }
      }
    }
  }

  /* ——— buildings ——— */
  function paintSign(sx, sy, text) {
    const tw = Math.min(90, text.length * 6.2 + 14);
    ctx.fillStyle = 'rgba(45, 28, 18, 0.82)';
    ctx.strokeStyle = 'rgba(196, 165, 116, 0.55)';
    ctx.lineWidth = 1.2;
    roundRect(sx - tw / 2, sy - 14, tw, 16, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2e6d4';
    ctx.font = '600 10px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy - 6);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPlankWall(x, y, w, h, base, dark) {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    // planks
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    for (let yy = y + 6; yy < y + h - 2; yy += 7) {
      ctx.beginPath();
      ctx.moveTo(x + 1, yy);
      ctx.lineTo(x + w - 1, yy);
      ctx.stroke();
    }
    // side shade
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + w - 6, y, 6, h);
  }

  function drawWindow(x, y, glow) {
    ctx.fillStyle = '#2a1c14';
    ctx.fillRect(x, y, 12, 14);
    ctx.fillStyle = glow || 'rgba(232, 184, 106, 0.55)';
    ctx.fillRect(x + 2, y + 2, 8, 10);
    ctx.strokeStyle = '#5c3d2e';
    ctx.strokeRect(x, y, 12, 14);
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 6, y + 14);
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x + 12, y + 7);
    ctx.stroke();
  }

  function drawRoof(x, y, w, thick, color, edge) {
    // overhang roof with thickness
    ctx.fillStyle = edge || '#2a1a10';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 8);
    ctx.lineTo(x + w / 2, y - thick);
    ctx.lineTo(x + w + 8, y + 8);
    ctx.lineTo(x + w + 8, y + 14);
    ctx.lineTo(x + w / 2, y - thick + 8);
    ctx.lineTo(x - 8, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color || '#3d2a1f';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 8);
    ctx.lineTo(x + w / 2, y - thick);
    ctx.lineTo(x + w + 8, y + 8);
    ctx.closePath();
    ctx.fill();
  }

  function drawBuildingFacade(s) {
    if (!s.label || s.label.startsWith('cerca') || s.label.startsWith('poco')) return;

    const foot = w2s(s.x, s.y + s.h);
    const topL = w2s(s.x, s.y);
    const topR = w2s(s.x + s.w, s.y);
    const facadeH = s.facade || 72;
    const wallTop = foot.y - facadeH;
    const wallW = s.w;
    const wallX = foot.x; // left at footprint x (same as world x offset)

    // ground shadow under building
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(wallX + wallW / 2, foot.y + 4, wallW * 0.48, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const style = s.style || s.label;
    let wall = '#6a4a32';
    let wallDark = 'rgba(30,18,10,0.25)';
    let roofC = '#3d2a1f';
    let roofEdge = '#2a1a10';
    let name = '';
    let glow = 'rgba(232,184,106,0.5)';

    if (style === 'capela') {
      wall = '#c8b8a0';
      wallDark = 'rgba(80,60,40,0.2)';
      roofC = '#4a3a48';
      roofEdge = '#2a2230';
      name = 'Capela';
      glow = 'rgba(200,210,230,0.45)';
    } else if (style === 'cantina') {
      wall = '#7a4838';
      name = 'Cantina';
    } else if (style === 'armazem') {
      wall = '#5c3d2e';
      name = 'Armazém';
    } else if (style === 'estabulo') {
      wall = '#6a5838';
      roofC = '#4a3820';
      name = 'Estábulo';
    } else if (style === 'casa') {
      wall = '#8a6a48';
      name = 'Casa';
    }

    drawPlankWall(wallX, wallTop, wallW, facadeH, wall, wallDark);

    // porch posts
    if (style === 'cantina' || style === 'armazem' || style === 'casa') {
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(wallX + 10, wallTop + facadeH - 28, 5, 28);
      ctx.fillRect(wallX + wallW - 15, wallTop + facadeH - 28, 5, 28);
      ctx.fillStyle = '#5c3d2e';
      ctx.fillRect(wallX + 6, wallTop + facadeH - 30, wallW - 12, 5);
    }

    // door
    const dw = Math.min(28, wallW * 0.22);
    const dx = wallX + wallW / 2 - dw / 2;
    const dy = wallTop + facadeH - 36;
    ctx.fillStyle = '#1e120c';
    ctx.fillRect(dx, dy, dw, 36);
    ctx.fillStyle = '#c4a574';
    ctx.beginPath();
    ctx.arc(dx + dw - 6, dy + 18, 2, 0, Math.PI * 2);
    ctx.fill();

    // windows
    if (style === 'capela') {
      drawWindow(wallX + wallW * 0.22, wallTop + 28, glow);
      drawWindow(wallX + wallW * 0.72 - 12, wallTop + 28, glow);
      // cross
      ctx.fillStyle = '#3d2a1f';
      const cx = wallX + wallW / 2;
      const cy = wallTop + 14;
      ctx.fillRect(cx - 2, cy - 10, 4, 22);
      ctx.fillRect(cx - 8, cy - 2, 16, 4);
    } else if (style === 'estabulo') {
      // wide open stable doors look
      ctx.fillStyle = 'rgba(20,12,8,0.55)';
      ctx.fillRect(wallX + 18, wallTop + facadeH - 40, wallW - 36, 40);
      // fence rails on facade
      ctx.strokeStyle = '#4a3828';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ry = wallTop + 22 + i * 12;
        ctx.beginPath();
        ctx.moveTo(wallX + 8, ry);
        ctx.lineTo(wallX + wallW - 8, ry);
        ctx.stroke();
      }
    } else {
      drawWindow(wallX + wallW * 0.18, wallTop + 22, glow);
      drawWindow(wallX + wallW * 0.78 - 12, wallTop + 22, glow);
      if (wallW > 180) drawWindow(wallX + wallW * 0.48 - 6, wallTop + 22, glow);
    }

    // cantina sign board
    if (style === 'cantina') {
      ctx.fillStyle = '#3d2a1f';
      ctx.fillRect(wallX + wallW / 2 - 36, wallTop + 10, 72, 18);
      ctx.strokeStyle = '#c4a574';
      ctx.strokeRect(wallX + wallW / 2 - 36, wallTop + 10, 72, 18);
      ctx.fillStyle = '#e8c990';
      ctx.font = '700 11px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CANTINA', wallX + wallW / 2, wallTop + 23);
    }

    const roofThick = style === 'capela' ? 28 : 22;
    drawRoof(wallX, wallTop, wallW, roofThick, roofC, roofEdge);

    if (name && style !== 'cantina') {
      paintSign(wallX + wallW / 2, wallTop - roofThick - 6, name);
    }

    // shallow roof top ellipse hint (¾ “top” of building)
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(wallX + wallW / 2, wallTop - roofThick + 4, wallW * 0.35, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFence(s) {
    const p0 = w2s(s.x, s.y);
    const p1 = w2s(s.x + s.w, s.y + s.h);
    const x = Math.min(p0.x, w2s(s.x, s.y + s.h).x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(w2s(s.x + s.w, s.y).x - p0.x) || s.w;
    const h = Math.max(10, Math.abs(p1.y - p0.y));

    if (s.w > s.h) {
      // horizontal rail
      ctx.fillStyle = '#6a4a32';
      ctx.fillRect(p0.x, p0.y - 14, s.w, 4);
      ctx.fillRect(p0.x, p0.y - 6, s.w, 4);
      for (let i = 0; i < s.w; i += 28) {
        ctx.fillRect(p0.x + i, p0.y - 18, 5, 22);
      }
    } else {
      ctx.fillStyle = '#6a4a32';
      for (let i = 0; i < s.h; i += 20) {
        const pp = w2s(s.x, s.y + i);
        ctx.fillRect(pp.x, pp.y - 18, 5, 22);
      }
      ctx.fillRect(p0.x - 2, p0.y - 14, 9, 4);
      const pb = w2s(s.x, s.y + s.h);
      ctx.fillRect(p0.x - 2, (p0.y + pb.y) / 2 - 6, 9, 4);
    }
  }

  function drawWell() {
    const { TILE } = FronteiraWorld;
    const cx = 20.5 * TILE;
    const cy = 14.8 * TILE;
    const p = w2s(cx, cy);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // stone ring (¾: ellipse + front wall)
    ctx.fillStyle = '#6a6860';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a5850';
    ctx.fillRect(p.x - 24, p.y - 2, 48, 16);
    ctx.fillStyle = '#7a7870';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 2, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // water
    ctx.fillStyle = '#3a6a88';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 2, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!reducedMotion) {
      const shimmer = 0.35 + Math.sin(bobT * 2.2) * 0.15;
      ctx.fillStyle = `rgba(180,220,240,${shimmer})`;
      ctx.beginPath();
      ctx.ellipse(p.x - 4, p.y - 3, 5, 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // posts + crank crossbar
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(p.x - 22, p.y - 36, 5, 36);
    ctx.fillRect(p.x + 17, p.y - 36, 5, 36);
    ctx.fillStyle = '#3d2a1f';
    ctx.fillRect(p.x - 24, p.y - 38, 48, 6);
    // bucket hint
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(p.x - 5, p.y - 20, 10, 8);
    ctx.strokeStyle = '#2a1c14';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 36);
    ctx.lineTo(p.x, p.y - 20);
    ctx.stroke();

    paintSign(p.x, p.y - 48, 'Poço');
  }

  /* ——— characters ——— */
  function drawChar(wx, wy, palette, isPlayer) {
    const p = w2s(wx, wy);
    const bob = (!reducedMotion && running && !paused) ? Math.sin(bobT * 6 + wx * 0.01) * 1.2 : 0;
    const feetY = p.y;
    const baseY = feetY - bob;

    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x, feetY + 2, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const skin = palette.skin || '#c4a07a';
    const shirt = palette.shirt || palette.color || '#4a6a7a';
    const pants = palette.pants || '#3a3428';
    const hat = palette.hat || '#3d2a1f';

    // legs
    ctx.fillStyle = pants;
    ctx.fillRect(p.x - 6, baseY - 12, 5, 12);
    ctx.fillRect(p.x + 1, baseY - 12, 5, 12);
    // boots
    ctx.fillStyle = '#2a1c14';
    ctx.fillRect(p.x - 7, baseY - 2, 6, 3);
    ctx.fillRect(p.x + 1, baseY - 2, 6, 3);

    // torso
    ctx.fillStyle = shirt;
    ctx.fillRect(p.x - 8, baseY - 24, 16, 14);
    // arms
    ctx.fillStyle = skin;
    ctx.fillRect(p.x - 11, baseY - 22, 4, 10);
    ctx.fillRect(p.x + 7, baseY - 22, 4, 10);

    // head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(p.x, baseY - 30, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // hat
    ctx.fillStyle = hat;
    ctx.fillRect(p.x - 10, baseY - 34, 20, 4);
    ctx.fillRect(p.x - 6, baseY - 40, 12, 7);

    if (isPlayer) {
      // scarf / accent
      ctx.fillStyle = '#c4a574';
      ctx.fillRect(p.x - 5, baseY - 24, 10, 3);
    }
  }

  function drawNameplate(wx, wy, name) {
    const p = w2s(wx, wy);
    paintSign(p.x, p.y - CHAR_H - 8, name);
  }

  function drawHorseshoe(it) {
    if (it.collected) return;
    const p = w2s(it.x + it.w / 2, it.y + it.h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c4a574';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.fillStyle = '#a88858';
    ctx.fillRect(p.x - 8, p.y + 2, 4, 4);
    ctx.fillRect(p.x + 4, p.y + 2, 4, 4);
  }

  function drawDust() {
    if (reducedMotion || !dust.length) return;
    const vw = canvas.width;
    const vh = canvas.height;
    for (const d of dust) {
      d.y -= d.sp * 0.016;
      d.x += Math.sin(bobT + d.y * 10) * 0.0004;
      if (d.y < 0) { d.y = 1; d.x = Math.random(); }
      ctx.fillStyle = `rgba(220,190,150,${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x * vw, d.y * vh * 0.7 + vh * 0.15, d.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    const vw = canvas.width;
    const vh = canvas.height;
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(0, 0, vw, vh);

    drawSky();
    drawGround();

    // depth-sorted drawables by world feet Y
    const list = [];

    for (const s of FronteiraWorld.solids) {
      if (s.label && s.label.startsWith('cerca')) {
        list.push({ y: s.y + s.h, draw: () => drawFence(s) });
      } else if (s.label && s.label.startsWith('poco')) {
        // well drawn once via center
      } else if (s.label) {
        list.push({ y: s.y + s.h, draw: () => drawBuildingFacade(s) });
      }
    }

    list.push({ y: 14.8 * FronteiraWorld.TILE + 20, draw: drawWell });

    for (const it of FronteiraWorld.interactables) {
      if (it.kind === 'item') {
        list.push({ y: it.y + it.h, draw: () => drawHorseshoe(it) });
      }
    }

    for (const n of FronteiraWorld.npcs) {
      list.push({
        y: n.y,
        draw: () => {
          drawChar(n.x, n.y, n, false);
          drawNameplate(n.x, n.y, n.name);
        },
      });
    }

    list.push({
      y: player.y,
      draw: () => {
        drawChar(player.x, player.y, {
          skin: '#d2b090',
          shirt: '#4a6a7a',
          pants: '#3a3a48',
          hat: '#3d2a1f',
        }, true);
      },
    });

    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    drawDust();

    const tint = dayTint();
    if (tint.a > 0) {
      ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
      ctx.fillRect(0, 0, vw, vh);
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
          if (!reducedMotion) {
            dayT += dt * 0.012;
            bobT += dt;
          }
          updateNear();
          if (FronteiraInput.consumeInteract()) tryInteract();
        } else if (FronteiraInput.consumeInteract()) {
          FronteiraUI.advanceDialog();
        }
        updateCamera();
      }
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
