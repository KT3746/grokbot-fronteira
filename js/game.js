/* FRONTEIRA — Three.js 3ª pessoa baixo-poli (canyon street) — visual premium */
import * as THREE from 'three';
import { FronteiraAudio } from './audio.js';
import { FronteiraWorld } from './world.js';
import { FronteiraInput } from './input.js';
import { FronteiraUI } from './ui.js';

export const FronteiraGame = (() => {
  const PLAYER_R = 0.55;
  const SPEED = 9.5;
  const TURN = 4.2;
  const CAM_DIST = 8.4;
  const CAM_HEIGHT = 3.9;
  const LOOK_AHEAD = 11.5;
  const CAM_FOV = 50;
  const FOG_COLOR = 0xb59a6c;

  let canvas, renderer, scene, camera, sun, hemi, clock;
  let playerRoot, playerMeshes;
  let npcRoots = {};
  let markerRoots = {};
  let running = false, paused = false, won = false;
  let state = null, near = null;
  let zoneName = '', zoneFade = 0;
  let reducedMotion = false;
  let shadowsOn = true;
  let isLowEnd = false;
  let player = { x: 0, z: 0, ang: 0, moving: false };
  let camPos, lookPos, _tmp;
  let windowTex = null;
  let roadMat, dirtMat, asphaltMat;
  let wagonGroup;
  let woodMatCache = {};

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
      else if (f.hasPackage) lines.push('Ainda com o embrulho? A cantina fica adiante à direita.');
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
      else lines.push('O poço fica no meio da praça, na rua. Enche o balde aí.');
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
      if (markerRoots.ferradura) markerRoots.ferradura.visible = false;
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
    const s = Math.sin(player.ang), c = Math.cos(player.ang);
    const wishX = (-m.y) * s + m.x * c;
    const wishZ = (-m.y) * c - m.x * s;
    const target = Math.atan2(wishX, wishZ);
    player.ang = angLerp(player.ang, target, Math.min(1, TURN * dt));
    const dist = SPEED * dt;
    const nx = player.x + wishX * dist;
    const nz = player.z + wishZ * dist;
    const box = (x, z) => ({ x: x - PLAYER_R, z: z - PLAYER_R, w: PLAYER_R * 2, d: PLAYER_R * 2 });
    if (!FronteiraWorld.collides(box(nx, player.z))) player.x = nx;
    if (!FronteiraWorld.collides(box(player.x, nz))) player.z = nz;
    FronteiraAudio.footstep();
  }

  function updateNear() {
    near = FronteiraWorld.nearInteract(player.x, player.z, 2.2);
    let hint = '';
    if (near) {
      if (near.type === 'npc') hint = near.ref.name + ' — Interagir';
      else hint = (near.ref.hint || 'Interagir') + ' — Interagir';
    }
    FronteiraUI.setHint(hint, !!near);
    FronteiraUI.setInteractReady(!!near);
  }

  function updateZone(dt) {
    const z = FronteiraWorld.zoneAt(player.x, player.z);
    if (z !== zoneName) { zoneName = z; zoneFade = 1.6; }
    else if (zoneFade > 0) zoneFade = Math.max(0, zoneFade - dt);
  }

  /* ——— textures ——— */
  function makeWindowTexture(baseHex, litChance) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const r = (baseHex >> 16) & 255, gg = (baseHex >> 8) & 255, b = baseHex & 255;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, 0, 128, 256);
    // subtle plaster noise
    for (let i = 0; i < 900; i++) {
      const n = (Math.random() * 28) | 0;
      const s = Math.random() < 0.5 ? -1 : 1;
      g.fillStyle = `rgba(${Math.max(0, r + s * n)},${Math.max(0, gg + s * n)},${Math.max(0, b + s * n)},0.18)`;
      g.fillRect((Math.random() * 128) | 0, (Math.random() * 256) | 0, 2, 2);
    }
    const cols = 4, rows = 8;
    const mw = 18, mh = 22;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random() < (litChance || 0.12);
        g.fillStyle = lit ? '#c4a040' : '#1a120c';
        const x = 10 + col * 28;
        const y = 12 + row * 30;
        g.fillRect(x, y, mw, mh);
        // thin frame
        g.strokeStyle = 'rgba(40,28,18,0.55)';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, mw - 1, mh - 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeNoiseTexture(baseHex, size, grain, opts) {
    opts = opts || {};
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const r = (baseHex >> 16) & 255, gg = (baseHex >> 8) & 255, b = baseHex & 255;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, 0, size, size);
    const img = g.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * grain;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.9));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.7));
    }
    g.putImageData(img, 0, 0);
    if (opts.dashes) {
      // asphalt road overlay: yellow edges + white dashed center
      g.fillStyle = '#c4a020';
      g.fillRect(4, 0, 6, size);
      g.fillRect(size - 10, 0, 6, size);
      g.fillStyle = '#e8e8e0';
      for (let y = 0; y < size; y += 48) {
        g.fillRect((size / 2) - 6, y + 8, 12, 28);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = opts.clampS ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
    return tex;
  }

  function makeRoadTexture() {
    // dedicated tall canvas so dashed center stays readable from chase cam
    const c = document.createElement('canvas');
    c.width = 128; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3a3c';
    g.fillRect(0, 0, 128, 512);
    const img = g.getImageData(0, 0, 128, 512);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.9));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.7));
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#c4a020';
    g.fillRect(4, 0, 6, 512);
    g.fillRect(118, 0, 6, 512);
    g.fillStyle = '#e8e8e0';
    for (let y = 0; y < 512; y += 48) {
      g.fillRect(58, y + 8, 12, 28);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 12);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeDirtTexture() {
    return makeNoiseTexture(0x9a7a52, 128, 36, { repeat: [18, 24] });
  }

  function makeWalkTexture() {
    return makeNoiseTexture(0x8a8070, 64, 20, { repeat: [2, 40] });
  }

  function matColor(hex, opts) {
    opts = opts || {};
    return new THREE.MeshLambertMaterial({
      color: hex,
      flatShading: true,
      map: opts.map || null,
      transparent: !!opts.transparent,
      opacity: opts.opacity != null ? opts.opacity : 1,
    });
  }

  function woodMat(hex) {
    const key = hex | 0;
    if (woodMatCache[key]) return woodMatCache[key];
    woodMatCache[key] = matColor(hex);
    return woodMatCache[key];
  }

  function boxMesh(w, h, d, material, cast, receive) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.castShadow = !!cast && shadowsOn;
    m.receiveShadow = !!receive && shadowsOn;
    return m;
  }

  function makePerson(palette) {
    const g = new THREE.Group();
    const pants = matColor(palette.pants);
    const torso = matColor(palette.torso);
    const head = matColor(palette.head);
    const hat = matColor(palette.hat);
    const boot = matColor(0x2a1c14);
    const arm = matColor(palette.torso);
    // boots
    const bootL = boxMesh(0.38, 0.22, 0.48, boot, true, false);
    bootL.position.set(-0.2, 0.11, 0.04);
    const bootR = boxMesh(0.38, 0.22, 0.48, boot, true, false);
    bootR.position.set(0.2, 0.11, 0.04);
    const legL = boxMesh(0.34, 0.82, 0.34, pants, true, false);
    legL.position.set(-0.2, 0.52, 0);
    const legR = boxMesh(0.34, 0.82, 0.34, pants, true, false);
    legR.position.set(0.2, 0.52, 0);
    const body = boxMesh(0.88, 0.98, 0.52, torso, true, false);
    body.position.set(0, 1.28, 0);
    // shoulders / arms for silhouette
    const armL = boxMesh(0.28, 0.72, 0.28, arm, true, false);
    armL.position.set(-0.58, 1.22, 0);
    const armR = boxMesh(0.28, 0.72, 0.28, arm, true, false);
    armR.position.set(0.58, 1.22, 0);
    const hd = boxMesh(0.46, 0.46, 0.46, head, true, false);
    hd.position.set(0, 1.98, 0);
    const brim = boxMesh(0.9, 0.1, 0.78, hat, true, false);
    brim.position.set(0, 2.2, 0);
    const crown = boxMesh(0.52, 0.3, 0.52, hat, true, false);
    crown.position.set(0, 2.38, 0);
    g.add(bootL, bootR, legL, legR, body, armL, armR, hd, brim, crown);
    g.userData.legs = [legL, legR];
    return g;
  }

  function makeWagon() {
    const g = new THREE.Group();
    const wood = woodMat(0x5c3d2e);
    const dark = woodMat(0x2a1c14);
    const iron = matColor(0x3a3834);
    const bed = boxMesh(2.2, 0.75, 3.4, wood, true, true);
    bed.position.y = 0.95;
    const railF = boxMesh(2.3, 0.55, 0.14, dark, true, false);
    railF.position.set(0, 1.55, 1.65);
    const railB = railF.clone(); railB.position.z = -1.65;
    const railL = boxMesh(0.14, 0.55, 3.2, dark, true, false);
    railL.position.set(-1.1, 1.55, 0);
    const railR = railL.clone(); railR.position.x = 1.1;
    const yoke = boxMesh(0.35, 0.25, 1.6, dark, true, false);
    yoke.position.set(0, 1.05, 2.3);
    const wheel = (x, z) => {
      const w = boxMesh(0.22, 0.95, 0.95, iron, true, false);
      w.position.set(x, 0.48, z);
      return w;
    };
    g.add(bed, railF, railB, railL, railR, yoke,
      wheel(-1.15, 1.15), wheel(1.15, 1.15), wheel(-1.15, -1.15), wheel(1.15, -1.15));
    return g;
  }

  function makeBarrel() {
    const g = new THREE.Group();
    const wood = woodMat(0x6a4a32);
    const band = matColor(0x2a2418);
    const body = boxMesh(0.7, 0.95, 0.7, wood, true, true);
    body.position.y = 0.48;
    const b1 = boxMesh(0.74, 0.08, 0.74, band, true, false);
    b1.position.y = 0.25;
    const b2 = boxMesh(0.74, 0.08, 0.74, band, true, false);
    b2.position.y = 0.7;
    g.add(body, b1, b2);
    return g;
  }

  function makeHitchingPost() {
    const g = new THREE.Group();
    const wood = woodMat(0x4a3224);
    const post = boxMesh(0.18, 1.35, 0.18, wood, true, false);
    post.position.y = 0.68;
    const rail = boxMesh(1.6, 0.12, 0.12, wood, true, false);
    rail.position.y = 1.15;
    g.add(post, rail);
    return g;
  }

  function makeFenceSegment(len) {
    const g = new THREE.Group();
    const wood = woodMat(0x5a4030);
    const rail = boxMesh(len, 0.1, 0.1, wood, true, false);
    rail.position.y = 0.55;
    const rail2 = boxMesh(len, 0.1, 0.1, wood, true, false);
    rail2.position.y = 0.95;
    g.add(rail, rail2);
    const posts = Math.max(2, Math.round(len / 1.8) + 1);
    for (let i = 0; i < posts; i++) {
      const p = boxMesh(0.12, 1.15, 0.12, wood, true, false);
      p.position.set(-len / 2 + (i / (posts - 1)) * len, 0.58, 0);
      g.add(p);
    }
    return g;
  }

  function makeSignBoard(labelW, color) {
    const g = new THREE.Group();
    const board = boxMesh(labelW, 1.05, 0.18, woodMat(color || 0x3a2418), true, false);
    const trim = boxMesh(labelW + 0.15, 0.12, 0.2, woodMat(0x2a1810), true, false);
    trim.position.y = 0.55;
    const trimB = trim.clone(); trimB.position.y = -0.55;
    g.add(board, trim, trimB);
    return g;
  }

  function addBuilding(x, z, w, d, h, color, style) {
    const group = new THREE.Group();
    const tex = makeWindowTexture(color, style === 'capela' ? 0.05 : 0.14);
    tex.repeat.set(Math.max(1, w / 8), Math.max(1, h / 10));
    const wallMat = matColor(color, { map: tex });
    const plain = matColor(color);
    const topMat = woodMat(0x3d2a1f);
    const trimMat = woodMat(0x4a3224);
    const mats = [wallMat, wallMat, topMat, plain, wallMat, wallMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.castShadow = shadowsOn;
    mesh.receiveShadow = shadowsOn;
    mesh.position.set(x + w / 2, h / 2, z + d / 2);
    const roof = boxMesh(w + 0.5, 0.38, d + 0.5, topMat, true, false);
    roof.position.set(x + w / 2, h + 0.18, z + d / 2);
    group.add(mesh, roof);

    // wood baseboard trim
    const base = boxMesh(w + 0.15, 0.35, d + 0.15, trimMat, true, true);
    base.position.set(x + w / 2, 0.18, z + d / 2);
    group.add(base);

    // door recess on street-facing facade (toward road / - or + x depending)
    const doorMat = woodMat(0x2a1c14);
    const doorW = Math.min(2.2, w * 0.28);
    const doorH = Math.min(3.2, h * 0.38);
    // front door on +Z face for landmarks that face street from north/south,
    // for side buildings face toward road (inner X)
    let doorX = x + w / 2, doorZ = z + d + 0.12, doorRot = 0;
    if (style === 'canyon' || style === 'casa' || style === 'armazem' || style === 'cantina' || style === 'estabulo') {
      // face toward road center
      const cx = x + w / 2;
      if (cx < 0) {
        doorX = x + w + 0.12; doorZ = z + d * 0.45; doorRot = Math.PI / 2;
      } else {
        doorX = x - 0.12; doorZ = z + d * 0.45; doorRot = -Math.PI / 2;
      }
    }
    if (style === 'capela') {
      doorX = x + w / 2; doorZ = z - 0.12; doorRot = 0;
    }
    const recess = boxMesh(doorW + 0.35, doorH + 0.35, 0.35, trimMat, true, false);
    recess.position.set(doorX, doorH * 0.5 + 0.1, doorZ);
    if (doorRot) recess.rotation.y = doorRot;
    const door = boxMesh(doorW, doorH, 0.18, doorMat, true, false);
    door.position.set(doorX, doorH * 0.5 + 0.1, doorZ);
    if (doorRot) door.rotation.y = doorRot;
    group.add(recess, door);

    // awning over door for shops / casas
    if (style === 'armazem' || style === 'cantina' || style === 'casa' || style === 'canyon') {
      const awnMat = woodMat(style === 'cantina' ? 0x6a3030 : 0x5c4030);
      const awn = boxMesh(doorW + 1.6, 0.12, 1.4, awnMat, true, false);
      if (cxTowardRoad(x, w) < 0) {
        awn.position.set(x + w + 0.55, doorH + 0.55, z + d * 0.45);
      } else if (style !== 'capela') {
        awn.position.set(x - 0.55, doorH + 0.55, z + d * 0.45);
      }
      if (style === 'capela') {
        // skip
      } else {
        group.add(awn);
        // thin support poles
        const poleL = boxMesh(0.1, doorH * 0.55, 0.1, trimMat, true, false);
        const poleR = poleL.clone();
        if (cxTowardRoad(x, w) < 0) {
          poleL.position.set(x + w + 1.1, doorH * 0.35, z + d * 0.45 - 0.55);
          poleR.position.set(x + w + 1.1, doorH * 0.35, z + d * 0.45 + 0.55);
        } else {
          poleL.position.set(x - 1.1, doorH * 0.35, z + d * 0.45 - 0.55);
          poleR.position.set(x - 1.1, doorH * 0.35, z + d * 0.45 + 0.55);
        }
        group.add(poleL, poleR);
      }
    }

    if (style === 'capela') {
      // steeple block + cross
      const steeple = boxMesh(w * 0.28, 4.5, d * 0.28, plain, true, false);
      steeple.position.set(x + w / 2, h + 2.4, z + d / 2);
      const crossV = boxMesh(0.35, 3.4, 0.35, woodMat(0x2a2218), true, false);
      crossV.position.set(x + w / 2, h + 5.2, z + d / 2);
      const crossH = boxMesh(2.4, 0.35, 0.35, woodMat(0x2a2218), true, false);
      crossH.position.set(x + w / 2, h + 6.2, z + d / 2);
      // arched door hint (taller recess already) + steps
      const step = boxMesh(doorW + 1.2, 0.25, 1.2, matColor(0x7a7868), true, true);
      step.position.set(x + w / 2, 0.12, z - 0.7);
      group.add(steeple, crossV, crossH, step);
    }

    if (style === 'cantina' || style === 'armazem' || style === 'estabulo') {
      const signW = Math.min(7, w * 0.65);
      const sign = makeSignBoard(signW, style === 'cantina' ? 0x4a2018 : style === 'estabulo' ? 0x4a4030 : 0x3a2418);
      // hang on road-facing wall
      if (cxTowardRoad(x, w) < 0) {
        sign.position.set(x + w + 0.22, h * 0.62, z + d * 0.5);
        sign.rotation.y = Math.PI / 2;
      } else {
        sign.position.set(x - 0.22, h * 0.62, z + d * 0.5);
        sign.rotation.y = -Math.PI / 2;
      }
      group.add(sign);
      // landmark silhouette extras
      if (style === 'armazem') {
        const crate = boxMesh(1.4, 1.1, 1.4, woodMat(0x6a4a30), true, true);
        crate.position.set(x + w + 1.2, 0.55, z + d * 0.3);
        group.add(crate);
      }
      if (style === 'cantina') {
        const rail = boxMesh(w * 0.7, 0.9, 0.15, woodMat(0x3a2018), true, false);
        if (cxTowardRoad(x, w) > 0) {
          rail.position.set(x - 0.3, 0.9, z + d * 0.5);
        } else {
          rail.position.set(x + w + 0.3, 0.9, z + d * 0.5);
        }
        group.add(rail);
      }
      if (style === 'estabulo') {
        // open bay hint + loft
        const loft = boxMesh(w * 0.5, 0.3, d * 0.9, topMat, true, false);
        loft.position.set(x + w / 2, h + 0.55, z + d / 2);
        const hay = boxMesh(2.2, 1.0, 1.6, matColor(0xc4a050), true, true);
        hay.position.set(x + w + 1.4, 0.5, z + d * 0.5);
        group.add(loft, hay);
      }
    }

    scene.add(group);
    return group;
  }

  function cxTowardRoad(x, w) {
    return x + w / 2;
  }

  function placeProps() {
    // extra wagons
    const w3 = makeWagon();
    w3.position.set(-6.2, 0, 72);
    w3.rotation.y = 0.35;
    scene.add(w3);
    const w4 = makeWagon();
    w4.position.set(6.0, 0, 130);
    w4.rotation.y = Math.PI * 0.48;
    scene.add(w4);

    // barrels near landmarks / sidewalks (visual only — no collider)
    const barrelSpots = [
      [-9.5, 40], [-10.2, 46], [9.8, 58], [10.5, 66],
      [-9.0, 6], [0.5, 76], [-8.8, 98], [9.2, 100],
      [-9.5, 148], [5.5, 42],
    ];
    for (const [bx, bz] of barrelSpots) {
      const b = makeBarrel();
      b.position.set(bx, 0, bz);
      b.rotation.y = (bx * bz) * 0.01;
      scene.add(b);
    }

    // hitching posts near estábulo + praça
    const hitches = [
      [-8.5, 8], [-8.5, 12], [8.5, 78], [8.5, 86], [-8.5, 80],
    ];
    for (const [hx, hz] of hitches) {
      const h = makeHitchingPost();
      h.position.set(hx, 0, hz);
      scene.add(h);
    }

    // short fences along sidewalk outer edge (building side), sparse
    const rh = FronteiraWorld.ROAD_HALF;
    for (let fz = 15; fz < 145; fz += 18) {
      // skip landmark frontages roughly
      if ((fz > 30 && fz < 55) || (fz > 50 && fz < 75) || (fz > 90 && fz < 110)) continue;
      const fl = makeFenceSegment(4.5);
      fl.position.set(-(rh + 3.6), 0, fz);
      fl.rotation.y = Math.PI / 2;
      scene.add(fl);
      const fr = makeFenceSegment(4.5);
      fr.position.set(rh + 3.6, 0, fz + 6);
      fr.rotation.y = Math.PI / 2;
      scene.add(fr);
    }
  }

  function buildWorld() {
    // dirt/ochre ground with subtle noise
    const dirtTex = makeDirtTexture();
    dirtMat = new THREE.MeshLambertMaterial({ map: dirtTex, flatShading: true });
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(200, 280), dirtMat);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0, 70);
    dirt.receiveShadow = shadowsOn;
    scene.add(dirt);

    // sidewalks
    const walkTex = makeWalkTexture();
    const walkMat = new THREE.MeshLambertMaterial({ map: walkTex, flatShading: true });
    const walkL = new THREE.Mesh(new THREE.PlaneGeometry(4, 220), walkMat);
    walkL.rotation.x = -Math.PI / 2;
    walkL.position.set(-(FronteiraWorld.ROAD_HALF + 2), 0.02, 70);
    walkL.receiveShadow = shadowsOn;
    const walkR = walkL.clone();
    walkR.position.x = FronteiraWorld.ROAD_HALF + 2;
    scene.add(walkL, walkR);

    // asphalt road with dashed lines + noise
    const roadTex = makeRoadTexture();
    asphaltMat = new THREE.MeshLambertMaterial({ map: roadTex, flatShading: true });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(FronteiraWorld.ROAD_HALF * 2, 220), asphaltMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.04, 70);
    road.receiveShadow = shadowsOn;
    scene.add(road);

    // canyon fillers
    for (const b of FronteiraWorld.canyon) {
      addBuilding(b.x, b.z, b.w, b.d, b.h, b.color, 'canyon');
    }
    // named landmarks
    for (const s of FronteiraWorld.solids) {
      if (s.style === 'canyon' || s.style === 'poco') continue;
      addBuilding(s.x, s.z, s.w, s.d, s.h, s.color, s.style);
    }

    // well
    const well = new THREE.Group();
    const stone = matColor(0x6a6860);
    const base = boxMesh(5.5, 1.6, 5.5, stone, true, true);
    base.position.y = 0.8;
    const rim = boxMesh(5.8, 0.25, 5.8, matColor(0x5a5850), true, true);
    rim.position.y = 1.55;
    const water = boxMesh(3.5, 0.2, 3.5, matColor(0x2a4550), false, false);
    water.position.y = 1.45;
    const postL = boxMesh(0.3, 2.4, 0.3, woodMat(0x3a2a1c), true, false);
    postL.position.set(-2, 2.4, 0);
    const postR = postL.clone(); postR.position.x = 2;
    const bar = boxMesh(4.4, 0.25, 0.25, woodMat(0x2a1c14), true, false);
    bar.position.y = 3.5;
    const bucket = boxMesh(0.55, 0.55, 0.55, woodMat(0x5c3d2e), true, false);
    bucket.position.set(0, 2.6, 0);
    well.add(base, rim, water, postL, postR, bar, bucket);
    well.position.set(0, 0, 81);
    scene.add(well);

    // wagons (frontier stand-in for cars)
    wagonGroup = makeWagon();
    wagonGroup.position.set(5.5, 0, 40);
    wagonGroup.rotation.y = Math.PI * 0.5;
    scene.add(wagonGroup);
    const wagon2 = makeWagon();
    wagon2.position.set(-5.2, 0, 100);
    wagon2.rotation.y = -0.2;
    scene.add(wagon2);

    placeProps();

    // scrub cones at south edge
    for (let i = 0; i < 14; i++) {
      const trunk = boxMesh(0.4, 1.2, 0.4, woodMat(0x4a3828), true, false);
      const leaf = boxMesh(1.6, 1.8, 1.6, matColor(0x4a6a38), true, false);
      leaf.position.y = 1.8;
      const g = new THREE.Group();
      g.add(trunk, leaf);
      g.position.set(-22 + (i % 7) * 7, 0, -22 - ((i / 7) | 0) * 6);
      scene.add(g);
    }

    // horseshoe marker + beam
    const hs = new THREE.Group();
    const shoe = boxMesh(1.2, 0.25, 1.2, matColor(0xa88858), true, false);
    shoe.position.y = 0.2;
    const beam = boxMesh(0.6, 8, 0.6, matColor(0xc4a040, { transparent: true, opacity: 0.28 }), false, false);
    beam.position.y = 4;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.6, 16),
      new THREE.MeshBasicMaterial({ color: 0xc4a040, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    hs.add(shoe, beam, ring);
    const fit = FronteiraWorld.interactables.find((i) => i.id === 'ferradura');
    hs.position.set(fit.x + 1.5, 0, fit.z + 1.5);
    scene.add(hs);
    markerRoots.ferradura = hs;

    // NPCs
    for (const n of FronteiraWorld.npcs) {
      const root = makePerson({
        torso: n.shirt, pants: n.pants, head: n.skin, hat: n.hat,
      });
      root.position.set(n.x, 0, n.z);
      scene.add(root);
      npcRoots[n.id] = root;
    }

    // Player — orange torso like reference
    playerRoot = makePerson({
      torso: 0xd45520, pants: 0x141418, head: 0xc4a07a, hat: 0x1a1410,
    });
    scene.add(playerRoot);
  }

  function detectLowEnd() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const mobileUA = /android|iphone|ipad|ipod|mobile|opera mini|iemobile/.test(ua);
    const narrow = window.innerWidth <= 500;
    const dpr = window.devicePixelRatio || 1;
    const touch = 'ontouchstart' in window;
    return mobileUA || narrow || (touch && dpr >= 2 && window.innerWidth <= 900);
  }

  function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, isLowEnd ? 0.02 : 0.015);

    camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 280);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const dprCap = isLowEnd ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = shadowsOn;
    if (shadowsOn) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // warm fill + sky/ground hemisphere
    const amb = new THREE.AmbientLight(0xc4b090, 0.32);
    scene.add(amb);
    hemi = new THREE.HemisphereLight(0xd8c49a, 0x6a5038, 0.55);
    scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffe0b0, 1.45);
    sun.position.set(-45, 60, 18);
    sun.castShadow = shadowsOn;
    if (shadowsOn) {
      const mapSize = isLowEnd ? 512 : 1024;
      sun.shadow.mapSize.set(mapSize, mapSize);
      sun.shadow.camera.near = 5;
      sun.shadow.camera.far = 150;
      sun.shadow.camera.left = -45;
      sun.shadow.camera.right = 45;
      sun.shadow.camera.top = 45;
      sun.shadow.camera.bottom = -45;
      sun.shadow.bias = -0.001;
      sun.shadow.radius = isLowEnd ? 1 : 2;
    }
    scene.add(sun);
    scene.add(sun.target);

    // HUD chip: only with ?debug=1
    {
      const params = new URLSearchParams(window.location.search);
      const debug = params.get('debug') === '1';
      if (debug) document.body.classList.add('debug');
      let chip = document.getElementById('webgl-chip');
      if (!debug) {
        if (chip) chip.remove();
      } else {
        if (!chip) {
          chip = document.createElement('div');
          chip.id = 'webgl-chip';
          chip.setAttribute('aria-hidden', 'true');
          chip.style.cssText = 'position:absolute;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:6;font:600 10px/1.2 system-ui,sans-serif;letter-spacing:0.04em;color:rgba(242,230,212,0.75);background:rgba(30,18,12,0.65);border:1px solid rgba(196,165,116,0.35);border-radius:999px;padding:4px 8px;pointer-events:none;text-shadow:0 1px 1px #000;';
          const app = document.getElementById('app');
          if (app) app.appendChild(chip);
        }
        chip.textContent = 'WebGL · r160' + (isLowEnd ? ' · low' : '');
      }
    }

    clock = new THREE.Clock();
    buildWorld();
  }

  function syncPlayerVisual(dt) {
    playerRoot.position.set(player.x, 0, player.z);
    playerRoot.rotation.y = player.ang;
    if (player.moving && !reducedMotion) {
      const t = clock.elapsedTime * 10;
      playerRoot.userData.legs[0].position.z = Math.sin(t) * 0.15;
      playerRoot.userData.legs[1].position.z = Math.sin(t + Math.PI) * 0.15;
    } else {
      playerRoot.userData.legs[0].position.z = 0;
      playerRoot.userData.legs[1].position.z = 0;
    }
    for (const n of FronteiraWorld.npcs) {
      const root = npcRoots[n.id];
      if (!root) continue;
      root.lookAt(player.x, 1.2, player.z);
      root.rotation.x = 0; root.rotation.z = 0;
    }
  }

  function updateCamera(dt) {
    const s = Math.sin(player.ang), c = Math.cos(player.ang);
    const desired = _tmp.set(
      player.x - s * CAM_DIST,
      CAM_HEIGHT,
      player.z - c * CAM_DIST
    );
    const k = 1 - Math.exp(-(reducedMotion ? 8 : 5.5) * dt);
    camPos.lerp(desired, k);
    lookPos.set(
      player.x + s * LOOK_AHEAD,
      1.55,
      player.z + c * LOOK_AHEAD
    );
    camera.position.copy(camPos);
    camera.lookAt(lookPos);
    sun.target.position.set(player.x, 0, player.z);
    sun.target.updateMatrixWorld();
  }

  let zoneEl = null;
  function ensureZoneEl() {
    if (zoneEl) return;
    zoneEl = document.createElement('div');
    zoneEl.id = 'zone-title';
    zoneEl.style.cssText = 'position:absolute;left:50%;top:18%;transform:translate(-50%,-50%);font:800 28px system-ui,sans-serif;color:#f2e6d4;text-shadow:0 0 4px #000,0 2px 0 #000;pointer-events:none;z-index:4;opacity:0;letter-spacing:0.06em;';
    document.getElementById('app').appendChild(zoneEl);
  }

  function updateZoneEl() {
    ensureZoneEl();
    zoneEl.textContent = zoneName || '';
    zoneEl.style.opacity = String(Math.min(1, zoneFade));
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    if (running && !paused && !won) {
      if (FronteiraInput.consumePause()) pause();
      else {
        const dialogOpen = !document.getElementById('screen-dialog').classList.contains('hidden');
        if (!dialogOpen) {
          move(dt);
          updateNear();
          updateZone(dt);
          if (FronteiraInput.consumeInteract()) tryInteract();
        } else if (FronteiraInput.consumeInteract()) {
          FronteiraUI.advanceDialog();
        }
      }
    }
    syncPlayerVisual(dt);
    updateCamera(dt);
    updateZoneEl();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function spawn() {
    const sp = FronteiraWorld.spawn;
    player.x = sp.x; player.z = sp.z; player.ang = sp.ang; player.moving = false;
    FronteiraWorld.resetItems();
    if (markerRoots.ferradura) markerRoots.ferradura.visible = true;
    state = freshState();
    won = false; near = null;
    zoneName = ''; zoneFade = 0;
    camPos.set(player.x, CAM_HEIGHT, player.z - CAM_DIST);
    lookPos.set(player.x, 1.55, player.z + LOOK_AHEAD);
    camera.position.copy(camPos);
    camera.lookAt(lookPos);
  }

  function start() {
    spawn();
    running = true; paused = false; won = false;
    FronteiraUI.hideOverlays();
    FronteiraUI.setHudVisible(true);
    FronteiraUI.setTouchVisible(true);
    FronteiraUI.setObjective(objectiveText());
    FronteiraInput.releaseAllDirs();
    clock.getDelta();
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
    clock.getDelta();
  }
  function stopToMenu() {
    running = false; paused = false; won = false;
    FronteiraUI.showMenu();
  }

  function init(c) {
    canvas = c;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isLowEnd = detectLowEnd();
    // mobile / low-end: soft shadows at 512, or disable if very constrained
    shadowsOn = true;
    if (isLowEnd) {
      const veryLow = window.innerWidth <= 400 || (window.devicePixelRatio || 1) >= 3;
      if (veryLow && reducedMotion) shadowsOn = false;
    }
    if (!THREE || !THREE.WebGLRenderer) {
      console.error('THREE ESM não carregou');
      const panel = document.querySelector('#screen-menu .panel');
      if (panel) {
        const err = document.createElement('p');
        err.className = 'tagline';
        err.style.color = '#e85d4c';
        err.style.fontWeight = '700';
        err.textContent = 'Erro: Three.js (ESM) não carregou. Recarregue a página ou limpe o cache.';
        const tag = panel.querySelector('.tagline');
        if (tag) tag.replaceWith(err); else panel.appendChild(err);
        const play = panel.querySelector('#btn-play');
        if (play) play.disabled = true;
      }
      return;
    }
    camPos = new THREE.Vector3();
    lookPos = new THREE.Vector3();
    _tmp = new THREE.Vector3();
    setupThree();
    resize();
    window.addEventListener('resize', resize);
    spawn();
    requestAnimationFrame(frame);
  }

  return { init, start, pause, resume, stopToMenu, tryInteract, get running() { return running; } };
})();