/* FRONTEIRA — 3ª pessoa baixo-poli (perspectiva Canvas 2D) */
const FronteiraGame = (() => {
  const PLAYER_R = 11;
  const SPEED = 125;
  const TURN_SPEED = 3.2;
  const CAM_DIST = 62;
  const CAM_HEIGHT = 36;
  const LOOK_AHEAD = 55;
  const FOCAL = 320;
  const NEAR = 8;
  const FOG_START = 120;
  const FOG_END = 520;
  const FOG = { r: 196, g: 168, b: 120 }; // dusty sepia haze
  const SUN = { x: 0.55, y: -0.15, z: 0.35 }; // world dir for hard shadows

  let canvas, ctx;
  let running = false, paused = false, won = false;
  let lastT = 0, bobT = 0;
  let state = null, near = null;
  let reducedMotion = false;
  let zoneName = '', zoneFade = 0;
  let player = { x: 0, y: 0, ang: 0, moving: false };
  let cam = { x: 0, y: CAM_HEIGHT, z: 0, yaw: 0 };

  function freshState() {
    return {
      flags: {
        talkedZe: false, hasPackage: false, deliveredPackage: false,
        talkedTiao: false, hasHorseshoe: false, returnedShoe: false,
        talkedRita: false, hasWater: false, deliveredWater: false,
      },
      questDone: { entrega: false, ferradura: false, agua: false },
    };
  }

  function spawn() {
    const { TILE } = FronteiraWorld;
    player.x = 21 * TILE;
    player.y = 18 * TILE;
    player.ang = Math.PI; // face toward capela (north = -Y)
    player.moving = false;
    FronteiraWorld.resetItems();
    state = freshState();
    won = false;
    near = null;
    bobT = 0;
    zoneName = '';
    zoneFade = 0;
    syncCam(1);
  }

  function objectiveText() {
    const f = state.flags, qd = state.questDone;
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
      won = true; running = false;
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
      lines.push(...npc.lines.idle); lines.push(...npc.lines.bless);
    } else if (npc.id === 'rita') {
      if (!f.talkedRita) {
        lines.push(...npc.lines.idle);
        after = () => { f.talkedRita = true; FronteiraUI.setObjective(objectiveText()); };
      } else if (f.deliveredWater) { lines.push(...npc.lines.thanks); lines.push(...npc.lines.after); }
      else if (f.hasWater) lines.push(...npc.lines.got_water);
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
        FronteiraUI.showDialog('Poço', ['Você enche o balde. A água vem fria, cheirando a barro bom.'],
          () => { f.hasWater = true; FronteiraUI.setObjective(objectiveText()); });
      } else if (f.hasWater) {
        FronteiraUI.showDialog('Poço', ['O balde já está cheio.']); FronteiraAudio.interactChime();
      } else if (f.deliveredWater) {
        FronteiraUI.showDialog('Poço', ['Água clara. O dia já foi servido.']); FronteiraAudio.interactChime();
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
      spot.collected = true; f.hasHorseshoe = true;
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

  function angLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function move(dt) {
    const m = FronteiraInput.movement();
    const mag = Math.hypot(m.x, m.y);
    player.moving = mag > 0.05;
    if (!player.moving) return;

    // Camera-relative wish: up = forward along facing, left/right = strafe
    const s = Math.sin(player.ang), c = Math.cos(player.ang);
    // input y: -1 = up = forward
    const wishX = (-m.y) * s + m.x * c;
    const wishY = (-m.y) * c - m.x * s;
    const target = Math.atan2(wishX, wishY);
    player.ang = angLerp(player.ang, target, Math.min(1, TURN_SPEED * dt));

    const dist = SPEED * dt;
    const nx = player.x + wishX * dist;
    const ny = player.y + wishY * dist;
    const box = (x, y) => ({ x: x - PLAYER_R, y: y - PLAYER_R + 2, w: PLAYER_R * 2, h: PLAYER_R * 2 - 2 });
    if (!FronteiraWorld.collides(box(nx, player.y))) player.x = nx;
    if (!FronteiraWorld.collides(box(player.x, ny))) player.y = ny;
    FronteiraAudio.footstep();
  }

  function updateNear() {
    near = FronteiraWorld.nearInteract(player.x, player.y, 36);
    let hint = '';
    if (near) {
      if (near.type === 'npc') hint = near.ref.name + ' — Interagir';
      else hint = (near.ref.hint || 'Interagir') + ' — Interagir';
    }
    FronteiraUI.setHint(hint, !!near);
    FronteiraUI.setInteractReady(!!near);
  }

  function updateZone(dt) {
    const { TILE } = FronteiraWorld;
    const tx = player.x / TILE, ty = player.y / TILE;
    let z = 'Povoado';
    if (tx >= 16 && tx <= 24 && ty >= 12 && ty <= 18) z = 'Praça';
    else if (tx >= 4 && tx <= 12 && ty >= 10 && ty <= 17) z = 'Armazém';
    else if (tx >= 28 && tx <= 38 && ty >= 10 && ty <= 17) z = 'Cantina';
    else if (tx >= 5 && tx <= 15 && ty >= 20 && ty <= 28) z = 'Estábulo';
    else if (tx >= 16 && tx <= 26 && ty >= 3 && ty <= 9) z = 'Capela';
    else if (ty > 26 || tx < 4 || tx > 38) z = 'Beira do mato';
    if (z !== zoneName) { zoneName = z; zoneFade = 1.8; }
    else if (zoneFade > 0) zoneFade = Math.max(0, zoneFade - dt);
  }

  function syncCam(snap) {
    const s = Math.sin(player.ang), c = Math.cos(player.ang);
    const tx = player.x - s * CAM_DIST;
    const tz = player.y - c * CAM_DIST;
    const ty = CAM_HEIGHT;
    if (snap >= 1) {
      cam.x = tx; cam.z = tz; cam.y = ty; cam.yaw = player.ang;
    } else {
      const k = Math.min(1, snap);
      cam.x += (tx - cam.x) * k;
      cam.z += (tz - cam.z) * k;
      cam.y += (ty - cam.y) * k;
      cam.yaw = angLerp(cam.yaw, player.ang, k);
    }
  }

  /* ——— perspective ——— */
  function project(wx, wy, wz) {
    // world: x, height wy, depth wz (= map y)
    const dx = wx - cam.x;
    const dy = wy - cam.y;
    const dz = wz - cam.z;
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    // camera space: +X right, +Y up, +Z forward
    const rx = dx * c - dz * s;
    const rz = dx * s + dz * c;
    const ry = dy;
    if (rz <= NEAR) return null;
    const sc = FOCAL / rz;
    const vw = canvas.width, vh = canvas.height;
    return {
      x: vw * 0.5 + rx * sc,
      y: vh * 0.52 - ry * sc, // horizon slightly above center
      z: rz,
      sc,
    };
  }

  function fogAlpha(z) {
    if (z <= FOG_START) return 0;
    if (z >= FOG_END) return 1;
    return (z - FOG_START) / (FOG_END - FOG_START);
  }

  function shadeColor(hex, face, fog) {
    // face: 0 top, 1 sun-lit side, 2 front, 3 shade side
    const mul = face === 0 ? 1.08 : face === 1 ? 1.0 : face === 2 ? 0.78 : 0.55;
    const n = parseInt(hex.slice(1), 16);
    let r = ((n >> 16) & 255) * mul;
    let g = ((n >> 8) & 255) * mul;
    let b = (n & 255) * mul;
    r = r + (FOG.r - r) * fog;
    g = g + (FOG.g - g) * fog;
    b = b + (FOG.b - b) * fog;
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  function fillPoly(pts, color) {
    if (pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function avgZ(pts) {
    let s = 0, n = 0;
    for (const p of pts) { if (p) { s += p.z; n++; } }
    return n ? s / n : 1e9;
  }

  /* ——— ground (perspective strips) ——— */
  function drawSky() {
    const vw = canvas.width, vh = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.55);
    g.addColorStop(0, '#c4a878');
    g.addColorStop(0.55, '#b89868');
    g.addColorStop(1, '#a88858');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  function drawGroundPlane() {
    const { TILE, ground, W, H } = FronteiraWorld;
    // Sample ground quads in a window around player for performance
    const reach = 18;
    const cx = Math.floor(player.x / TILE);
    const cy = Math.floor(player.y / TILE);
    const faces = [];

    for (let ty = cy - reach; ty <= cy + reach; ty++) {
      for (let tx = cx - reach; tx <= cx + reach; tx++) {
        if (ty < 0 || tx < 0 || ty >= H || tx >= W) continue;
        const t = ground[ty][tx];
        let col = '#8a6a48';
        if (t === 1) col = '#a88860';
        else if (t === 2) col = '#5a6840';
        else if (t === 3) col = '#3a5058';
        else if (t === 4) col = '#6a5a48';

        const x0 = tx * TILE, z0 = ty * TILE;
        const x1 = x0 + TILE, z1 = z0 + TILE;
        const p00 = project(x0, 0, z0);
        const p10 = project(x1, 0, z0);
        const p11 = project(x1, 0, z1);
        const p01 = project(x0, 0, z1);
        if (!p00 || !p10 || !p11 || !p01) continue;
        const z = (p00.z + p10.z + p11.z + p01.z) * 0.25;
        if (z > FOG_END) continue;
        const fog = fogAlpha(z);
        faces.push({
          z,
          pts: [p00, p10, p11, p01],
          color: shadeColor(col, 0, fog * 0.85),
          road: t === 4,
          x0, z0,
        });
      }
    }
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) {
      fillPoly(f.pts, f.color);
      if (f.road) {
        // dashed center line when roughly aligned
        const mid = project(f.x0 + TILE * 0.5, 0.5, f.z0 + TILE * 0.5);
        if (mid && ((f.x0 / TILE) | 0) % 2 === 0) {
          const a = project(f.x0 + TILE * 0.45, 0.4, f.z0 + 4);
          const b = project(f.x0 + TILE * 0.55, 0.4, f.z0 + TILE - 4);
          if (a && b && fogAlpha(mid.z) < 0.7) {
            ctx.strokeStyle = `rgba(210,190,150,${0.45 * (1 - fogAlpha(mid.z))})`;
            ctx.lineWidth = Math.max(1, mid.sc * 0.8);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    }
  }

  /* ——— boxes ——— */
  function boxFaces(x, y0, z, w, h, d, color, opts) {
    opts = opts || {};
    const out = [];
    // 8 corners
    const corners = [
      [x, y0, z], [x + w, y0, z], [x + w, y0, z + d], [x, y0, z + d],
      [x, y0 + h, z], [x + w, y0 + h, z], [x + w, y0 + h, z + d], [x, y0 + h, z + d],
    ];
    const P = corners.map((c) => project(c[0], c[1], c[2]));
    const faces = [
      { idx: [4, 5, 6, 7], face: 0 }, // top
      { idx: [0, 1, 5, 4], face: 2 }, // -Z
      { idx: [3, 2, 6, 7], face: 2 }, // +Z
      { idx: [0, 3, 7, 4], face: 3 }, // -X
      { idx: [1, 2, 6, 5], face: 1 }, // +X sunnier
    ];
    // choose lit side by sun
    for (const f of faces) {
      const pts = f.idx.map((i) => P[i]);
      if (pts.some((p) => !p)) continue;
      // backface: skip if average screen cross roughly wrong — simple: use cam-space normal via z of center
      const zAvg = avgZ(pts);
      const fog = fogAlpha(zAvg);
      let face = f.face;
      // sun bias: +X more lit
      if (f.idx[0] === 1) face = 1;
      if (f.idx[0] === 0 && f.idx[1] === 3) face = 3;
      out.push({
        z: zAvg,
        pts,
        color: shadeColor(color, face, fog),
        kind: 'box',
      });
    }

    // hard ground shadow (flat projected parallelogram)
    if (!opts.noShadow) {
      const sx = SUN.x * 40, sz = SUN.z * 40;
      const sc = [
        [x + sx, 0.2, z + sz],
        [x + w + sx, 0.2, z + sz],
        [x + w + sx, 0.2, z + d + sz],
        [x + sx, 0.2, z + d + sz],
      ].map((c) => project(c[0], c[1], c[2]));
      if (!sc.some((p) => !p)) {
        const zAvg = avgZ(sc) + 0.5;
        const fog = fogAlpha(zAvg);
        const a = 0.45 * (1 - fog * 0.7);
        out.push({
          z: zAvg + 0.01,
          pts: sc,
          color: `rgba(15,8,4,${a})`,
          kind: 'shadow',
        });
      }
    }
    return out;
  }

  function windowGrid(x, y0, z, w, h, d, color) {
    // paint dark window rects on the camera-facing wall (approximate: both long faces)
    const faces = [];
    const cols = Math.max(2, Math.floor(w / 28));
    const rows = Math.max(2, Math.floor(h / 32));
    const inset = 10;
    // front (+Z) and -Z walls
    for (const side of [0, 1]) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = x + inset + col * ((w - inset * 2) / cols) + 4;
          const wy = y0 + inset + row * ((h - inset * 2) / rows) + 4;
          const ww = Math.max(6, (w - inset * 2) / cols - 10);
          const wh = Math.max(8, (h - inset * 2) / rows - 10);
          const zz = side === 0 ? z + d + 0.5 : z - 0.5;
          const p0 = project(wx, wy, zz);
          const p1 = project(wx + ww, wy, zz);
          const p2 = project(wx + ww, wy + wh, zz);
          const p3 = project(wx, wy + wh, zz);
          if (!p0 || !p1 || !p2 || !p3) continue;
          const zAvg = avgZ([p0, p1, p2, p3]);
          const fog = fogAlpha(zAvg);
          faces.push({
            z: zAvg - 0.2,
            pts: [p0, p1, p2, p3],
            color: shadeColor('#1a120c', 3, fog),
            kind: 'win',
          });
        }
      }
    }
    return faces;
  }

  function signSlab(cx, y, cz, text, color) {
    const w = Math.min(70, text.length * 8 + 16);
    const h = 14, d = 4;
    const faces = boxFaces(cx - w / 2, y, cz, w, h, d, color || '#3a2a1c', { noShadow: true });
    return faces;
  }

  function drawLowPolyPerson(wx, wz, ang, palette, isPlayer) {
    const faces = [];
    const s = Math.sin(ang), c = Math.cos(ang);
    // local offsets → world
    function lp(lx, ly, lz) {
      return {
        x: wx + lx * c + lz * s,
        y: ly,
        z: wz - lx * s + lz * c,
      };
    }
    const parts = [
      // legs
      { o: lp(-4, 0, -2), w: 5, h: 14, d: 5, col: palette.pants },
      { o: lp(2, 0, -2), w: 5, h: 14, d: 5, col: palette.pants },
      // torso
      { o: lp(-7, 14, -4), w: 14, h: 16, d: 8, col: palette.torso },
      // head
      { o: lp(-4.5, 30, -3.5), w: 9, h: 9, d: 8, col: palette.head },
      // hat brim
      { o: lp(-8, 38, -6), w: 16, h: 2, d: 14, col: palette.hat },
      // hat crown
      { o: lp(-5, 40, -4), w: 10, h: 5, d: 9, col: palette.hat },
    ];
    for (const p of parts) {
      faces.push(...boxFaces(p.o.x, p.o.y, p.o.z, p.w, p.h, p.d, p.col, { noShadow: !isPlayer }));
    }
    // player gets one hard shadow under feet
    if (isPlayer) {
      faces.push(...boxFaces(wx - 10, 0.1, wz - 8, 20, 0.2, 16, '#1a1008', { noShadow: true }).map((f) => {
        f.color = 'rgba(10,6,2,0.4)';
        f.z += 0.5;
        return f;
      }));
    }
    return faces;
  }

  function gatherScene() {
    const faces = [];

    // buildings
    for (const s of FronteiraWorld.solids) {
      if (!s.label || s.label.startsWith('cerca') || s.label.startsWith('poco')) continue;
      const h = s.height3d || 100;
      const col = s.color || '#8a6a48';
      faces.push(...boxFaces(s.x, 0, s.y, s.w, h, s.h, col));
      faces.push(...windowGrid(s.x, 0, s.y, s.w, h, s.h, col));

      // distinct sign slabs
      const style = s.style || s.label;
      const cx = s.x + s.w / 2;
      const cz = s.y + s.h + 2;
      if (style === 'cantina') faces.push(...signSlab(cx, h * 0.55, cz, 'CANTINA', '#3a2418'));
      if (style === 'armazem') faces.push(...signSlab(cx, h * 0.55, cz, 'ARMAZEM', '#2a1c10'));
      if (style === 'capela') {
        // simple cross on top
        faces.push(...boxFaces(cx - 2, h, s.y + s.h / 2 - 2, 4, 28, 4, '#2a2218', { noShadow: true }));
        faces.push(...boxFaces(cx - 10, h + 16, s.y + s.h / 2 - 2, 20, 4, 4, '#2a2218', { noShadow: true }));
      }
      if (style === 'estabulo') faces.push(...signSlab(cx, h * 0.5, cz, 'ESTABULO', '#3a3020'));
    }

    // fences as thin boxes
    for (const s of FronteiraWorld.solids) {
      if (!s.label || !s.label.startsWith('cerca')) continue;
      faces.push(...boxFaces(s.x, 0, s.y, Math.max(4, s.w), 18, Math.max(4, s.h), '#4a3828'));
    }

    // well
    {
      const { TILE } = FronteiraWorld;
      const cx = 20.5 * TILE, cz = 14.8 * TILE;
      faces.push(...boxFaces(cx - 18, 0, cz - 18, 36, 22, 36, '#6a6860'));
      faces.push(...boxFaces(cx - 12, 22, cz - 12, 24, 2, 24, '#3a5058', { noShadow: true }));
      faces.push(...boxFaces(cx - 16, 22, cz - 2, 4, 28, 4, '#3a2a1c', { noShadow: true }));
      faces.push(...boxFaces(cx + 12, 22, cz - 2, 4, 28, 4, '#3a2a1c', { noShadow: true }));
      faces.push(...boxFaces(cx - 16, 48, cz - 2, 32, 4, 4, '#2a1c14', { noShadow: true }));
    }

    // scrub trees (cone+trunk) near mato
    const { TILE, W, H, ground } = FronteiraWorld;
    const cx = Math.floor(player.x / TILE), cy = Math.floor(player.y / TILE);
    for (let ty = cy - 14; ty <= cy + 14; ty++) {
      for (let tx = cx - 14; tx <= cx + 14; tx++) {
        if (ty < 0 || tx < 0 || ty >= H || tx >= W) continue;
        if (ground[ty][tx] !== 2) continue;
        if ((tx * 13 + ty * 7) % 11 !== 0) continue;
        const x = tx * TILE + 10, z = ty * TILE + 10;
        faces.push(...boxFaces(x + 4, 0, z + 4, 6, 16, 6, '#4a3828', { noShadow: true }));
        // green block as foliage (cone approximated as stacked boxes)
        faces.push(...boxFaces(x, 14, z, 14, 18, 14, '#4a6a38'));
        faces.push(...boxFaces(x + 2, 30, z + 2, 10, 10, 10, '#3a5a2e', { noShadow: true }));
      }
    }

    // horseshoe marker
    for (const it of FronteiraWorld.interactables) {
      if (it.kind !== 'item' || it.collected) continue;
      faces.push(...boxFaces(it.x, 0, it.y, 14, 4, 14, '#a88858'));
      // mission beam
      faces.push(...boxFaces(it.x + 4, 0, it.y + 4, 6, 70, 6, '#c4a050', { noShadow: true }).map((f) => {
        f.color = 'rgba(210,170,70,0.28)';
        return f;
      }));
    }

    // interact beam near objective NPCs lightly — skip to avoid GTA vibe spam

    // NPCs
    for (const n of FronteiraWorld.npcs) {
      const pal = {
        torso: n.shirt || n.color || '#6a5038',
        pants: n.pants || '#2e2a24',
        head: n.skin || '#b89570',
        hat: n.hat || '#2a2218',
      };
      // face toward player roughly
      const ang = Math.atan2(player.x - n.x, player.y - n.y);
      faces.push(...drawLowPolyPerson(n.x, n.y, ang, pal, false));
    }

    // Player — behind cam so appears lower-center
    faces.push(...drawLowPolyPerson(player.x, player.y, player.ang, {
      torso: '#4a5a48',
      pants: '#1e1e24',
      head: '#c4a07a',
      hat: '#1a1610',
    }, true));

    return faces;
  }

  function drawZoneTitle() {
    if (zoneFade <= 0 || !zoneName) return;
    const a = Math.min(1, zoneFade);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '800 28px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,10,4,0.85)';
    ctx.fillStyle = '#f2e6d4';
    const x = canvas.width * 0.5, y = canvas.height * 0.22;
    ctx.strokeText(zoneName, x, y);
    ctx.fillText(zoneName, x, y);
    ctx.restore();
  }

  function render() {
    const vw = canvas.width, vh = canvas.height;
    drawSky();
    drawGroundPlane();

    const faces = gatherScene();
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) fillPoly(f.pts, f.color);

    // distance haze veil
    const haze = ctx.createLinearGradient(0, vh * 0.35, 0, vh * 0.55);
    haze.addColorStop(0, `rgba(${FOG.r},${FOG.g},${FOG.b},0.35)`);
    haze.addColorStop(1, `rgba(${FOG.r},${FOG.g},${FOG.b},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, vw, vh * 0.6);

    drawZoneTitle();
  }

  function frame(t) {
    if (!canvas) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;

    if (running && !paused && !won) {
      if (FronteiraInput.consumePause()) pause();
      else {
        const dialogOpen = !document.getElementById('screen-dialog').classList.contains('hidden');
        if (!dialogOpen) {
          move(dt);
          updateNear();
          updateZone(dt);
          if (!reducedMotion) bobT += dt;
          if (FronteiraInput.consumeInteract()) tryInteract();
        } else if (FronteiraInput.consumeInteract()) {
          FronteiraUI.advanceDialog();
        }
        syncCam(1 - Math.exp(-dt * 10));
      }
    } else {
      syncCam(0.2);
    }

    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
  }

  function start() {
    spawn();
    running = true; paused = false; won = false;
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
    running = false; paused = false; won = false;
    FronteiraUI.showMenu();
  }

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resize();
    window.addEventListener('resize', resize);
    spawn();
    requestAnimationFrame(frame);
  }

  return { init, start, pause, resume, stopToMenu, tryInteract, get running() { return running; } };
})();
