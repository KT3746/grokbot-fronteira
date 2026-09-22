/* FRONTEIRA — loop + render sertão cinematográfico (¾) */
const FronteiraGame = (() => {
  const PLAYER_R = 11;
  const SPEED = 118;
  const Y_SCALE = 0.52;
  const CHAR_H = 36; // adult-ish screen height
  const SUN = { x: -0.72, y: 0.18 }; // light from upper-left → long rightward shadows

  let canvas, ctx;
  let running = false;
  let paused = false;
  let lastT = 0;
  let camX = 0, camY = 0;
  let player = { x: 0, y: 0, moving: false, facing: 1 };
  let dayT = 0;
  let state = null;
  let near = null;
  let won = false;
  let reducedMotion = false;
  let bobT = 0;
  let dust = [];
  let groundCache = null;
  let groundCacheKey = '';
  let grainPat = null;
  let walkPhase = 0;

  function freshState() {
    return {
      flags: {
        talkedZe: false, hasPackage: false, deliveredPackage: false,
        talkedTiao: false, hasHorseshoe: false, returnedShoe: false,
        talkedRita: false, hasWater: false, deliveredWater: false,
      },
      questDone: { entrega: false, ferradura: false, agua: false },
      activeFocus: 'entrega',
    };
  }

  function spawn() {
    const { TILE } = FronteiraWorld;
    player.x = 21 * TILE;
    player.y = 18 * TILE;
    player.moving = false;
    player.facing = 1;
    FronteiraWorld.resetItems();
    state = freshState();
    dayT = 0.42; // late afternoon bias
    won = false;
    near = null;
    bobT = 0;
    walkPhase = 0;
    initDust();
    groundCache = null;
  }

  function initDust() {
    dust = [];
    if (reducedMotion) return;
    for (let i = 0; i < 22; i++) {
      dust.push({
        x: Math.random(), y: Math.random(),
        s: 0.4 + Math.random() * 1.8,
        sp: 0.008 + Math.random() * 0.02,
        a: 0.04 + Math.random() * 0.07,
        drift: (Math.random() - 0.5) * 0.02,
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
        after = () => { f.talkedZe = true; f.hasPackage = true; FronteiraUI.setObjective(objectiveText()); };
      } else if (f.deliveredPackage) lines.push(...npc.lines.after);
      else if (f.hasPackage) lines.push('Ainda com o embrulho? A cantina fica a leste da praça.');
      else lines.push(...npc.lines.idle);
    } else if (npc.id === 'dona_clara') {
      if (f.hasPackage && !f.deliveredPackage) {
        lines.push(...npc.lines.receive);
        after = () => { f.hasPackage = false; f.deliveredPackage = true; markQuest('entrega'); };
      } else if (f.hasWater && !f.deliveredWater) {
        lines.push('Água do poço! Rita mandou bem. Obrigada.');
        after = () => { f.hasWater = false; f.deliveredWater = true; markQuest('agua'); };
      } else if (f.deliveredPackage && !f.talkedRita) lines.push(...npc.lines.need_water);
      else if (f.deliveredWater) lines.push(...npc.lines.after);
      else lines.push(...npc.lines.idle);
    } else if (npc.id === 'tiao') {
      if (!f.talkedTiao) {
        lines.push(...npc.lines.idle);
        after = () => { f.talkedTiao = true; FronteiraUI.setObjective(objectiveText()); };
      } else if (f.hasHorseshoe && !f.returnedShoe) {
        lines.push(...npc.lines.found);
        after = () => { f.hasHorseshoe = false; f.returnedShoe = true; markQuest('ferradura'); };
      } else if (f.returnedShoe) lines.push(...npc.lines.after);
      else lines.push('A ferradura deve estar no mato, ao sul do estábulo.');
    } else if (npc.id === 'padre_elias') {
      lines.push(...npc.lines.idle);
      lines.push(...npc.lines.bless);
    } else if (npc.id === 'rita') {
      if (!f.talkedRita) {
        lines.push(...npc.lines.idle);
        after = () => { f.talkedRita = true; FronteiraUI.setObjective(objectiveText()); };
      } else if (f.deliveredWater) {
        lines.push(...npc.lines.thanks);
        lines.push(...npc.lines.after);
      } else if (f.hasWater) lines.push(...npc.lines.got_water);
      else lines.push('O poço fica bem no meio da praça. Enche o balde aí.');
    } else lines.push('…');

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
        ], () => { f.hasWater = true; FronteiraUI.setObjective(objectiveText()); });
      } else if (f.hasWater) {
        FronteiraUI.showDialog('Poço', ['O balde já está cheio.']);
        FronteiraAudio.interactChime();
      } else if (f.deliveredWater) {
        FronteiraUI.showDialog('Poço', ['Água clara. O dia já foi servido.']);
        FronteiraAudio.interactChime();
      } else {
        FronteiraUI.showDialog('Poço', ['Poço da praça. Rita costuma mandar gente buscar água.']);
        FronteiraAudio.interactChime();
      }
      return;
    }
    if (spot.kind === 'item' && spot.item === 'ferradura') {
      if (spot.collected) return;
      if (!f.talkedTiao) {
        FronteiraUI.showDialog('Mato', ['Uma ferradura no chão… talvez alguém do estábulo precise.']);
        FronteiraAudio.interactChime();
        return;
      }
      spot.collected = true;
      f.hasHorseshoe = true;
      FronteiraAudio.interactChime();
      FronteiraUI.showDialog('Ferradura', ['Você achou a ferradura perdida do Tião.'],
        () => FronteiraUI.setObjective(objectiveText()));
    }
  }

  function tryInteract() {
    if (!near) return;
    if (near.type === 'npc') talkNpc(near.ref);
    else if (near.type === 'spot') useSpot(near.ref);
  }

  function move(dt) {
    const m = FronteiraInput.movement();
    player.moving = !!(m.x || m.y);
    if (!player.moving) return;
    if (m.x) player.facing = m.x > 0 ? 1 : -1;
    walkPhase += dt * 9;
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
    const vw = canvas.width, vh = canvas.height;
    const projH = h * Y_SCALE;
    camX = player.x - vw * 0.5;
    camY = player.y * Y_SCALE - vh * 0.6;
    const padTop = 56;
    camX = Math.max(0, Math.min(camX, Math.max(0, w - vw)));
    camY = Math.max(-padTop, Math.min(camY, Math.max(-padTop, projH - vh + 24)));
  }

  function duskFactor() {
    // 0 morning-ish … 1 deep dusk — dayT drives soft cycle
    const t = dayT % 1;
    if (t < 0.35) return 0.25 + t * 0.4;
    if (t < 0.55) return 0.45;
    return 0.45 + (t - 0.55) * 1.1;
  }

  /* ——— cached ground noise (performance) ——— */
  function hash2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function ensureGrain() {
    if (grainPat || reducedMotion) return;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 18;
    }
    g.putImageData(img, 0, 0);
    grainPat = ctx.createPattern(c, 'repeat');
  }

  function ensureGroundCache() {
    const { TILE, ground, W, H } = FronteiraWorld;
    const key = W + 'x' + H;
    if (groundCache && groundCacheKey === key) return;
    groundCacheKey = key;
    const c = document.createElement('canvas');
    c.width = W * TILE;
    c.height = Math.ceil(H * TILE * Y_SCALE) + 2;
    const g = c.getContext('2d');

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = ground[y][x];
        const px = x * TILE;
        const py = y * TILE * Y_SCALE;
        const th = TILE * Y_SCALE + 0.8;
        const n = hash2(x, y);
        const n2 = hash2(x + 3, y + 7);

        let base;
        if (t === 1) base = [168, 138, 98];      // plaza clay
        else if (t === 2) base = [78, 86, 52];   // dry scrub
        else if (t === 3) base = [42, 58, 62];   // well water footprint
        else if (t === 4) base = [140, 112, 78]; // road
        else base = [128, 100, 70];              // dirt

        // value noise patches
        const v = (n - 0.5) * 28 + (n2 - 0.5) * 12;
        const r = Math.max(0, Math.min(255, base[0] + v));
        const gg = Math.max(0, Math.min(255, base[1] + v * 0.85));
        const b = Math.max(0, Math.min(255, base[2] + v * 0.55));
        g.fillStyle = `rgb(${r|0},${gg|0},${b|0})`;
        g.fillRect(px, py, TILE + 0.5, th);

        // cracked earth / grit
        if (t !== 3 && n > 0.62) {
          g.strokeStyle = `rgba(40,28,16,${0.08 + n * 0.12})`;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(px + 3, py + th * 0.3);
          g.lineTo(px + 10 + n * 8, py + th * 0.55);
          g.stroke();
        }
        // road ruts
        if (t === 4) {
          g.strokeStyle = 'rgba(55,38,22,0.28)';
          g.lineWidth = 1.4;
          g.beginPath();
          g.moveTo(px + 2, py + th * 0.32);
          g.lineTo(px + TILE - 2, py + th * 0.38);
          g.moveTo(px + 2, py + th * 0.62);
          g.lineTo(px + TILE - 2, py + th * 0.68);
          g.stroke();
        }
        // plaza packed patches
        if (t === 1 && n2 > 0.7) {
          g.fillStyle = 'rgba(90,65,40,0.1)';
          g.beginPath();
          g.ellipse(px + 10 + n * 12, py + th * 0.45, 6 + n * 4, 2.5, 0, 0, Math.PI * 2);
          g.fill();
        }
        // sparse dry scrub tufts (baked)
        if (t === 2 || (t === 0 && n > 0.88)) {
          g.strokeStyle = n > 0.5 ? 'rgba(90,95,55,0.55)' : 'rgba(60,65,40,0.5)';
          g.lineWidth = 1.1;
          const gx = px + 5 + n * (TILE - 10);
          const gy = py + th * 0.72;
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx - 1.5, gy - 4 - n * 3);
          g.moveTo(gx + 2, gy);
          g.lineTo(gx + 3, gy - 3.5);
          g.stroke();
        }
      }
    }
    groundCache = c;
  }

  function drawGround() {
    ensureGroundCache();
    if (!groundCache) return;
    // groundCache is in foreshortened Y already (world x, foreshortened y)
    ctx.drawImage(groundCache, -camX, -camY);
  }

  /* ——— sky / atmosphere ——— */
  function drawSky() {
    const vw = canvas.width, vh = canvas.height;
    const dusk = duskFactor();
    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.48);
    // desaturated heat sky
    g.addColorStop(0, mixHex('#5a6a7a', '#6a5570', dusk * 0.35));
    g.addColorStop(0.4, mixHex('#8a9aaa', '#a89078', dusk * 0.45));
    g.addColorStop(0.75, mixHex('#b8a890', '#c49868', dusk * 0.5));
    g.addColorStop(1, mixHex('#c4a878', '#b87848', dusk * 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh * 0.48);

    // hazy sun disk
    const sx = vw * 0.18 - camX * 0.02;
    const sy = vh * (0.12 + dusk * 0.08);
    const rad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 70);
    rad.addColorStop(0, `rgba(255,210,140,${0.55 - dusk * 0.15})`);
    rad.addColorStop(0.35, `rgba(220,150,80,${0.22})`);
    rad.addColorStop(1, 'rgba(180,120,60,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(sx - 80, sy - 80, 160, 160);

    // distant mesas — soft silhouettes
    drawMesaBand(vw, vh * 0.30, camX * 0.18, '#4a4038', 22, 0.04);
    drawMesaBand(vw, vh * 0.34, camX * 0.32, '#3a3830', 16, 0.055);
    // near scrub line
    ctx.fillStyle = '#3a3a2e';
    ctx.beginPath();
    ctx.moveTo(0, vh * 0.40);
    for (let x = 0; x <= vw + 30; x += 20) {
      const wx = (x + camX * 0.45) * 0.05;
      const hy = vh * 0.36 - Math.abs(Math.sin(wx * 1.4)) * 10;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(vw, vh * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  function drawMesaBand(vw, baseY, parallax, color, amp, freq) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 50);
    for (let x = 0; x <= vw + 40; x += 24) {
      const wx = (x + parallax) * freq;
      const hy = baseY - 8 - Math.sin(wx) * amp - Math.sin(wx * 0.4) * (amp * 0.5);
      // flat-top mesa feel
      const mesa = Math.sin(wx * 0.7) > 0.55 ? amp * 0.6 : 0;
      ctx.lineTo(x, hy - mesa);
    }
    ctx.lineTo(vw, baseY + 60);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function mixHex(a, b, t) {
    const pa = hexToRgb(a), pb = hexToRgb(b);
    const r = (pa.r + (pb.r - pa.r) * t) | 0;
    const g = (pa.g + (pb.g - pa.g) * t) | 0;
    const bl = (pa.b + (pb.b - pa.b) * t) | 0;
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  /* ——— buildings ——— */
  function weatheredSign(sx, sy, text) {
    if (!text) return;
    const tw = Math.min(78, text.length * 5.4 + 12);
    ctx.fillStyle = 'rgba(48, 34, 22, 0.72)';
    ctx.strokeStyle = 'rgba(140, 110, 75, 0.35)';
    ctx.lineWidth = 1;
    roundRect(sx - tw / 2, sy - 11, tw, 13, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(210, 190, 160, 0.78)';
    ctx.font = '600 9px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy - 4.5);
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

  function longShadow(cx, cy, w, hScale) {
    // ground shadow stretched by sun direction
    const len = 18 + hScale * 0.22;
    ctx.fillStyle = 'rgba(20, 12, 6, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.45, cy);
    ctx.lineTo(cx + w * 0.45, cy);
    ctx.lineTo(cx + w * 0.45 - SUN.x * len * 40, cy + len);
    ctx.lineTo(cx - w * 0.45 - SUN.x * len * 40, cy + len);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlankFacade(x, y, w, h, wallRgb, lit) {
    // vertical value bands + horizontal plank lines
    for (let i = 0; i < w; i += 7) {
      const n = hash2(i + (x | 0), (y | 0));
      const shade = lit ? (n - 0.5) * 18 : (n - 0.5) * 10 - 18;
      const r = Math.max(0, Math.min(255, wallRgb[0] + shade));
      const g = Math.max(0, Math.min(255, wallRgb[1] + shade * 0.9));
      const b = Math.max(0, Math.min(255, wallRgb[2] + shade * 0.7));
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(x + i, y, Math.min(7, w - i), h);
    }
    ctx.strokeStyle = 'rgba(20,12,8,0.22)';
    ctx.lineWidth = 1;
    for (let yy = y + 5; yy < y + h - 2; yy += 6) {
      ctx.beginPath();
      ctx.moveTo(x + 1, yy + hash2(yy, x) * 1.2);
      ctx.lineTo(x + w - 1, yy);
      ctx.stroke();
    }
    // lit edge (sun side)
    ctx.fillStyle = `rgba(255,210,150,${0.06 + lit * 0.05})`;
    ctx.fillRect(x, y, 5, h);
    // shadow edge
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + w - 7, y, 7, h);
  }

  function drawDirtyWindow(x, y, dusk) {
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(x, y, 11, 13);
    const glow = 0.12 + dusk * 0.35;
    ctx.fillStyle = `rgba(210, 140, 70, ${glow})`;
    ctx.fillRect(x + 2, y + 2, 7, 9);
    ctx.strokeStyle = 'rgba(50,35,22,0.8)';
    ctx.strokeRect(x, y, 11, 13);
    ctx.beginPath();
    ctx.moveTo(x + 5.5, y); ctx.lineTo(x + 5.5, y + 13);
    ctx.moveTo(x, y + 6.5); ctx.lineTo(x + 11, y + 6.5);
    ctx.stroke();
    // dirt smear
    ctx.fillStyle = 'rgba(40,30,20,0.25)';
    ctx.fillRect(x + 1, y + 9, 9, 3);
  }

  function drawRoofCinematic(x, y, w, thick, dark, mid) {
    // thickness / eave shadow
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 10);
    ctx.lineTo(x + w / 2, y - thick);
    ctx.lineTo(x + w + 10, y + 10);
    ctx.lineTo(x + w + 10, y + 16);
    ctx.lineTo(x + w / 2, y - thick + 9);
    ctx.lineTo(x - 10, y + 16);
    ctx.closePath();
    ctx.fill();
    // face
    const grd = ctx.createLinearGradient(x, y - thick, x + w, y + 10);
    grd.addColorStop(0, mid);
    grd.addColorStop(0.5, dark);
    grd.addColorStop(1, '#1a100a');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 10);
    ctx.lineTo(x + w / 2, y - thick);
    ctx.lineTo(x + w + 10, y + 10);
    ctx.closePath();
    ctx.fill();
    // eave shadow on wall
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x, y + 10, w, 6);
  }

  function drawBuildingFacade(s) {
    if (!s.label || s.label.startsWith('cerca') || s.label.startsWith('poco')) return;

    const foot = w2s(s.x, s.y + s.h);
    const facadeH = s.facade || 96;
    const wallTop = foot.y - facadeH;
    const wallW = s.w;
    const wallX = foot.x;
    const dusk = duskFactor();
    const style = s.style || s.label;

    longShadow(wallX + wallW / 2, foot.y + 2, wallW, facadeH);

    let wall = [92, 68, 48];
    let roofDark = '#2a1c14';
    let roofMid = '#3d2a1f';
    let title = '';
    let thick = 26;

    if (style === 'capela') {
      wall = [168, 158, 142]; // whitewash / stone
      roofDark = '#2e2834';
      roofMid = '#4a4050';
      title = 'Capela';
      thick = 34;
    } else if (style === 'cantina') {
      wall = [96, 58, 48];
      title = 'Cantina';
    } else if (style === 'armazem') {
      wall = [78, 56, 40];
      title = 'Armazém';
    } else if (style === 'estabulo') {
      wall = [88, 72, 48];
      roofMid = '#3a2e1c';
      title = 'Estábulo';
      thick = 22;
    } else if (style === 'casa') {
      wall = [110, 88, 62];
      title = '';
    }

    drawPlankFacade(wallX, wallTop, wallW, facadeH, wall, true);

    // porch beam
    if (style === 'cantina' || style === 'armazem' || style === 'casa') {
      ctx.fillStyle = '#2a1c14';
      ctx.fillRect(wallX + 8, wallTop + facadeH - 32, 4, 32);
      ctx.fillRect(wallX + wallW - 12, wallTop + facadeH - 32, 4, 32);
      ctx.fillStyle = '#3d2a1f';
      ctx.fillRect(wallX + 4, wallTop + facadeH - 34, wallW - 8, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(wallX + 4, wallTop + facadeH - 29, wallW - 8, 3);
    }

    // doorway — dark interior void
    const dw = Math.min(26, wallW * 0.2);
    const dx = wallX + wallW / 2 - dw / 2;
    const dy = wallTop + facadeH - 38;
    const doorGrad = ctx.createLinearGradient(dx, dy, dx + dw, dy);
    doorGrad.addColorStop(0, '#0c0806');
    doorGrad.addColorStop(0.5, '#1a100c');
    doorGrad.addColorStop(1, '#0a0604');
    ctx.fillStyle = doorGrad;
    ctx.fillRect(dx, dy, dw, 38);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(dx - 2, dy, 2, 38);
    ctx.fillRect(dx + dw, dy, 2, 38);

    if (style === 'capela') {
      drawDirtyWindow(wallX + wallW * 0.2, wallTop + 34, dusk);
      drawDirtyWindow(wallX + wallW * 0.72 - 11, wallTop + 34, dusk);
      // solemn cross
      ctx.fillStyle = '#2a2218';
      const cx = wallX + wallW / 2, cy = wallTop + 18;
      ctx.fillRect(cx - 1.5, cy - 12, 3, 26);
      ctx.fillRect(cx - 8, cy - 2, 16, 3);
    } else if (style === 'estabulo') {
      ctx.fillStyle = 'rgba(8,6,4,0.65)';
      ctx.fillRect(wallX + 16, wallTop + facadeH - 44, wallW - 32, 44);
      ctx.strokeStyle = 'rgba(50,38,24,0.7)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const ry = wallTop + 26 + i * 14;
        ctx.beginPath();
        ctx.moveTo(wallX + 10, ry);
        ctx.lineTo(wallX + wallW - 10, ry);
        ctx.stroke();
      }
      // posts
      ctx.fillStyle = '#3a2a1c';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(wallX + 20 + i * ((wallW - 40) / 3), wallTop + facadeH - 48, 4, 48);
      }
    } else {
      drawDirtyWindow(wallX + wallW * 0.16, wallTop + 26, dusk);
      drawDirtyWindow(wallX + wallW * 0.78 - 11, wallTop + 26, dusk);
      if (wallW > 190) drawDirtyWindow(wallX + wallW * 0.48 - 5, wallTop + 26, dusk);
    }

    // hanging worn cantina sign
    if (style === 'cantina') {
      ctx.strokeStyle = 'rgba(40,28,18,0.7)';
      ctx.beginPath();
      ctx.moveTo(wallX + wallW / 2 - 20, wallTop + 8);
      ctx.lineTo(wallX + wallW / 2 - 18, wallTop + 18);
      ctx.moveTo(wallX + wallW / 2 + 20, wallTop + 8);
      ctx.lineTo(wallX + wallW / 2 + 18, wallTop + 18);
      ctx.stroke();
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(wallX + wallW / 2 - 32, wallTop + 16, 64, 16);
      ctx.strokeStyle = 'rgba(120,95,65,0.4)';
      ctx.strokeRect(wallX + wallW / 2 - 32, wallTop + 16, 64, 16);
      ctx.fillStyle = 'rgba(190,160,120,0.7)';
      ctx.font = '600 10px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CANTINA', wallX + wallW / 2, wallTop + 27);
    }

    drawRoofCinematic(wallX, wallTop, wallW, thick, roofDark, roofMid);

    if (title && style !== 'cantina') {
      weatheredSign(wallX + wallW / 2, wallTop - thick - 2, title);
    }
  }

  function drawFence(s) {
    const p0 = w2s(s.x, s.y);
    ctx.fillStyle = '#3a2a1c';
    if (s.w > s.h) {
      ctx.fillRect(p0.x, p0.y - 12, s.w, 3);
      ctx.fillRect(p0.x, p0.y - 5, s.w, 3);
      for (let i = 0; i < s.w; i += 26) {
        ctx.fillRect(p0.x + i, p0.y - 16, 4, 20);
      }
      // shadow
      ctx.fillStyle = 'rgba(20,12,6,0.2)';
      ctx.fillRect(p0.x, p0.y + 1, s.w, 3);
    } else {
      for (let i = 0; i < s.h; i += 18) {
        const pp = w2s(s.x, s.y + i);
        ctx.fillStyle = '#3a2a1c';
        ctx.fillRect(pp.x, pp.y - 16, 4, 20);
      }
    }
  }

  function drawWell() {
    const { TILE } = FronteiraWorld;
    const cx = 20.5 * TILE, cy = 14.8 * TILE;
    const p = w2s(cx, cy);

    longShadow(p.x, p.y + 4, 48, 40);

    // stone body with mortar variation
    for (let i = 0; i < 10; i++) {
      const n = hash2(i, 3);
      const shade = (n - 0.5) * 22;
      ctx.fillStyle = `rgb(${(90 + shade)|0},${(88 + shade)|0},${(78 + shade * 0.7)|0})`;
      const ang = (i / 10) * Math.PI * 2;
      // approximate ring blocks on front
      ctx.fillRect(p.x - 22 + (i % 5) * 9, p.y - 2 + ((i / 5) | 0) * 8, 8, 7);
    }
    ctx.fillStyle = '#5a584e';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 23, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4840';
    ctx.fillRect(p.x - 23, p.y - 1, 46, 14);
    ctx.fillStyle = '#6a6860';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 1, 23, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // dark water depth
    const wg = ctx.createRadialGradient(p.x, p.y - 1, 2, p.x, p.y - 1, 14);
    wg.addColorStop(0, '#2a4550');
    wg.addColorStop(0.6, '#1a3038');
    wg.addColorStop(1, '#0e181c');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 1, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!reducedMotion) {
      ctx.fillStyle = `rgba(160,190,200,${0.12 + Math.sin(bobT * 1.8) * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(p.x - 3, p.y - 2, 4, 1.5, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // posts + crossbar + rope + bucket
    ctx.fillStyle = '#2e2218';
    ctx.fillRect(p.x - 20, p.y - 34, 4, 34);
    ctx.fillRect(p.x + 16, p.y - 34, 4, 34);
    ctx.fillStyle = '#1e1610';
    ctx.fillRect(p.x - 22, p.y - 36, 44, 5);
    ctx.strokeStyle = 'rgba(60,45,30,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 34);
    ctx.lineTo(p.x, p.y - 16);
    ctx.stroke();
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(p.x - 5, p.y - 16, 10, 7);
    ctx.strokeStyle = 'rgba(20,12,8,0.5)';
    ctx.strokeRect(p.x - 5, p.y - 16, 10, 7);

    weatheredSign(p.x, p.y - 44, 'Poço');
  }

  /* ——— characters (adult proportions) ——— */
  function drawChar(wx, wy, palette, opts) {
    opts = opts || {};
    const p = w2s(wx, wy);
    const facing = opts.facing || 1;
    const moving = !!opts.moving;
    const breath = (!reducedMotion && running && !paused && !moving)
      ? Math.sin(bobT * 2.4 + wx * 0.02) * 0.6 : 0;
    const walk = moving && !reducedMotion ? Math.sin(walkPhase + (opts.phase || 0)) : 0;
    const feetY = p.y;

    // long soft ground shadow
    ctx.fillStyle = 'rgba(18, 10, 5, 0.32)';
    ctx.beginPath();
    ctx.ellipse(p.x - SUN.x * 8, feetY + 2, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(18, 10, 5, 0.14)';
    ctx.beginPath();
    ctx.ellipse(p.x - SUN.x * 16, feetY + 5, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const skin = palette.skin || '#b89570';
    const shirt = palette.shirt || '#5a4a3a';
    const pants = palette.pants || '#2e2a24';
    const hat = palette.hat || '#2a2218';
    const coat = palette.coat || null;

    const legSwing = walk * 3.5;
    // legs
    ctx.fillStyle = pants;
    ctx.fillRect(p.x - 5 + legSwing, feetY - 14, 4, 13);
    ctx.fillRect(p.x + 1 - legSwing, feetY - 14, 4, 13);
    ctx.fillStyle = '#1a140e';
    ctx.fillRect(p.x - 6 + legSwing, feetY - 2, 5, 2.5);
    ctx.fillRect(p.x + 1 - legSwing, feetY - 2, 5, 2.5);

    // torso (taller adult)
    const torsoTop = feetY - 28 + breath;
    ctx.fillStyle = coat || shirt;
    ctx.fillRect(p.x - 7, torsoTop, 14, 15);
    // vest / coat lapel hint
    if (opts.isPlayer || coat) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(p.x - 1, torsoTop, 2, 15);
    }
    // skirt suggestion for clara/rita
    if (palette.skirt) {
      ctx.fillStyle = palette.skirt;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, feetY - 16);
      ctx.lineTo(p.x + 8, feetY - 16);
      ctx.lineTo(p.x + 10, feetY - 6);
      ctx.lineTo(p.x - 10, feetY - 6);
      ctx.closePath();
      ctx.fill();
    }

    // arms
    const armSwing = walk * 2.5;
    ctx.fillStyle = skin;
    ctx.fillRect(p.x - 10, torsoTop + 2 + armSwing, 3.5, 11);
    ctx.fillRect(p.x + 6.5, torsoTop + 2 - armSwing, 3.5, 11);
    // sleeve cuffs
    ctx.fillStyle = shirt;
    ctx.fillRect(p.x - 10, torsoTop + 1, 3.5, 4);
    ctx.fillRect(p.x + 6.5, torsoTop + 1, 3.5, 4);

    // head (smaller vs body ~1:3.5)
    const hy = torsoTop - 7;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(p.x, hy, 5.2, 0, Math.PI * 2);
    ctx.fill();

    // wide-brim hat + crown shadow on face
    ctx.fillStyle = hat;
    ctx.beginPath();
    ctx.ellipse(p.x, hy - 3, 11, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 5, hy - 10, 10, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, hy - 1, 5, 1.5, 0, 0, Math.PI);
    ctx.fill();

    // hat cast shadow on shoulder
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(p.x - 7, torsoTop, 14, 3);
  }

  function npcPalette(n) {
    const base = {
      skin: n.skin, shirt: n.shirt, pants: n.pants, hat: n.hat, color: n.color,
    };
    if (n.id === 'dona_clara') { base.skirt = '#5a3840'; base.coat = null; }
    if (n.id === 'rita') { base.skirt = '#4a3840'; }
    if (n.id === 'seu_ze') { base.coat = '#4a3a2c'; }
    if (n.id === 'padre_elias') { base.coat = '#222228'; base.shirt = '#2a2a30'; }
    if (n.id === 'tiao') { base.coat = '#4a4838'; }
    return base;
  }

  function drawNameplate(wx, wy, name) {
    const p = w2s(wx, wy);
    weatheredSign(p.x, p.y - CHAR_H - 4, name);
  }

  function drawHorseshoe(it) {
    if (it.collected) return;
    const p = w2s(it.x + it.w / 2, it.y + it.h / 2);
    ctx.fillStyle = 'rgba(15,10,5,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a7048';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0.35, Math.PI - 0.35);
    ctx.stroke();
  }

  function drawDust() {
    if (reducedMotion || !dust.length) return;
    const vw = canvas.width, vh = canvas.height;
    // sparse dust columns (heat)
    for (const d of dust) {
      d.y -= d.sp * 0.016;
      d.x += d.drift * 0.016;
      if (d.y < 0) { d.y = 1; d.x = Math.random(); }
      if (d.x < 0 || d.x > 1) d.drift *= -1;
      ctx.fillStyle = `rgba(200,175,140,${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x * vw, vh * 0.2 + d.y * vh * 0.55, d.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function postProcess() {
    const vw = canvas.width, vh = canvas.height;
    const dusk = duskFactor();

    // cinematic color grade overlay
    ctx.fillStyle = `rgba(40, 22, 10, ${0.08 + dusk * 0.1})`;
    ctx.fillRect(0, 0, vw, vh);
    // cool shadow crush in corners via vignette
    const vig = ctx.createRadialGradient(vw * 0.5, vh * 0.45, vh * 0.2, vw * 0.5, vh * 0.5, vh * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.65, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(12, 6, 2, ${0.42 + dusk * 0.12})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, vw, vh);

    // warm highlight wash (sun side)
    const wash = ctx.createLinearGradient(0, 0, vw * 0.5, vh);
    wash.addColorStop(0, `rgba(255, 190, 120, ${0.04 + dusk * 0.03})`);
    wash.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, vw, vh);

    if (!reducedMotion) {
      ensureGrain();
      if (grainPat) {
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = grainPat;
        ctx.fillRect(0, 0, vw, vh);
        ctx.globalAlpha = 1;
      }
    }
  }

  function render() {
    const vw = canvas.width, vh = canvas.height;
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(0, 0, vw, vh);

    drawSky();
    drawGround();

    const list = [];

    for (const s of FronteiraWorld.solids) {
      if (s.label && s.label.startsWith('cerca')) {
        list.push({ y: s.y + s.h, draw: () => drawFence(s) });
      } else if (s.label && s.label.startsWith('poco')) {
        /* well once */
      } else if (s.label) {
        list.push({ y: s.y + s.h, draw: () => drawBuildingFacade(s) });
      }
    }

    list.push({ y: 14.8 * FronteiraWorld.TILE + 20, draw: drawWell });

    for (const it of FronteiraWorld.interactables) {
      if (it.kind === 'item') list.push({ y: it.y + it.h, draw: () => drawHorseshoe(it) });
    }

    FronteiraWorld.npcs.forEach((n, i) => {
      list.push({
        y: n.y,
        draw: () => {
          drawChar(n.x, n.y, npcPalette(n), { phase: i * 1.7 });
          drawNameplate(n.x, n.y, n.name);
        },
      });
    });

    list.push({
      y: player.y,
      draw: () => {
        drawChar(player.x, player.y, {
          skin: '#c4a07a',
          shirt: '#4a5548',
          pants: '#2a2a30',
          hat: '#2a2218',
          coat: '#3a4038',
        }, { isPlayer: true, moving: player.moving, facing: player.facing });
      },
    });

    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    drawDust();
    postProcess();
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
            dayT += dt * 0.01;
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
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    grainPat = null; // recreate for new ctx if needed
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
