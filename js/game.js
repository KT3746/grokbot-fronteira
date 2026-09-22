/* FRONTEIRA — Three.js 3ª pessoa baixo-poli (canyon street) */
const FronteiraGame = (() => {
  const PLAYER_R = 0.55;
  const SPEED = 9.5;
  const TURN = 4.2;
  const CAM_DIST = 7.5;
  const CAM_HEIGHT = 3.4;
  const LOOK_AHEAD = 10;
  const FOG_COLOR = 0xb8a070;

  let canvas, renderer, scene, camera, sun, clock;
  let playerRoot, playerMeshes;
  let npcRoots = {};
  let markerRoots = {};
  let running = false, paused = false, won = false;
  let state = null, near = null;
  let zoneName = '', zoneFade = 0;
  let reducedMotion = false;
  let shadowsOn = true;
  let player = { x: 0, z: 0, ang: 0, moving: false };
  let camPos = new THREE.Vector3();
  let lookPos = new THREE.Vector3();
  let _tmp = new THREE.Vector3();
  let windowTex = null;
  let roadMat, dirtMat, asphaltMat;
  let wagonGroup;

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
    // camera-relative: up = forward along facing
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
    const cols = 4, rows = 8;
    const mw = 18, mh = 22;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random() < (litChance || 0.12);
        g.fillStyle = lit ? '#c4a040' : '#1a120c';
        const x = 10 + col * 28;
        const y = 12 + row * 30;
        g.fillRect(x, y, mw, mh);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeRoadTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3a3c';
    g.fillRect(0, 0, 128, 512);
    // yellow edges
    g.fillStyle = '#c4a020';
    g.fillRect(4, 0, 6, 512);
    g.fillRect(118, 0, 6, 512);
    // white dashed center
    g.fillStyle = '#e8e8e0';
    for (let y = 0; y < 512; y += 48) {
      g.fillRect(58, y + 8, 12, 28);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 12);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
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

  function boxMesh(w, h, d, material, cast, receive) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.castShadow = !!cast;
    m.receiveShadow = !!receive;
    return m;
  }

  function makePerson(palette) {
    const g = new THREE.Group();
    const pants = matColor(palette.pants);
    const torso = matColor(palette.torso);
    const head = matColor(palette.head);
    const hat = matColor(palette.hat);
    const legL = boxMesh(0.35, 0.85, 0.35, pants, true, false);
    legL.position.set(-0.2, 0.425, 0);
    const legR = boxMesh(0.35, 0.85, 0.35, pants, true, false);
    legR.position.set(0.2, 0.425, 0);
    const body = boxMesh(0.85, 0.95, 0.5, torso, true, false);
    body.position.set(0, 1.25, 0);
    const hd = boxMesh(0.45, 0.45, 0.45, head, true, false);
    hd.position.set(0, 1.95, 0);
    const brim = boxMesh(0.85, 0.1, 0.75, hat, true, false);
    brim.position.set(0, 2.18, 0);
    const crown = boxMesh(0.5, 0.28, 0.5, hat, true, false);
    crown.position.set(0, 2.35, 0);
    g.add(legL, legR, body, hd, brim, crown);
    g.userData.legs = [legL, legR];
    return g;
  }

  function makeWagon() {
    const g = new THREE.Group();
    const wood = matColor(0x5c3d2e);
    const dark = matColor(0x2a1c14);
    const bed = boxMesh(2.2, 0.8, 3.4, wood, true, true);
    bed.position.y = 0.9;
    const rail = boxMesh(2.3, 0.5, 0.15, dark, true, false);
    rail.position.set(0, 1.5, 1.6);
    const rail2 = rail.clone(); rail2.position.z = -1.6;
    const wheel = (x, z) => {
      const w = boxMesh(0.25, 0.9, 0.9, dark, true, false);
      w.position.set(x, 0.45, z);
      return w;
    };
    g.add(bed, rail, rail2, wheel(-1.1, 1.1), wheel(1.1, 1.1), wheel(-1.1, -1.1), wheel(1.1, -1.1));
    return g;
  }

  function addBuilding(x, z, w, d, h, color, style) {
    const group = new THREE.Group();
    const tex = makeWindowTexture(color, style === 'capela' ? 0.05 : 0.14);
    tex.repeat.set(Math.max(1, w / 8), Math.max(1, h / 10));
    const wallMat = matColor(color, { map: tex });
    const plain = matColor(color);
    const topMat = matColor(0x3d2a1f);
    // Box materials: +x -x +y -y +z -z
    const mats = [wallMat, wallMat, topMat, plain, wallMat, wallMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x + w / 2, h / 2, z + d / 2);
    const roof = boxMesh(w + 0.4, 0.35, d + 0.4, topMat, true, false);
    roof.position.set(x + w / 2, h + 0.15, z + d / 2);
    group.add(mesh, roof);

    if (style === 'capela') {
      const crossV = boxMesh(0.35, 3.2, 0.35, matColor(0x2a2218), true, false);
      crossV.position.set(x + w / 2, h + 2.2, z + d / 2);
      const crossH = boxMesh(2.2, 0.35, 0.35, matColor(0x2a2218), true, false);
      crossH.position.set(x + w / 2, h + 3.2, z + d / 2);
      group.add(crossV, crossH);
    }
    if (style === 'cantina' || style === 'armazem' || style === 'estabulo') {
      const sign = boxMesh(Math.min(6, w * 0.6), 1.0, 0.2, matColor(0x3a2418), true, false);
      sign.position.set(x + w / 2, h * 0.55, z + d + 0.2);
      group.add(sign);
    }
    scene.add(group);
    return group;
  }

  function buildWorld() {
    // dirt/ochre ground plane
    dirtMat = matColor(0x9a7a52);
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(200, 280), dirtMat);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0, 70);
    dirt.receiveShadow = true;
    scene.add(dirt);

    // sidewalks
    const walkMat = matColor(0x8a8070);
    const walkL = new THREE.Mesh(new THREE.PlaneGeometry(4, 220), walkMat);
    walkL.rotation.x = -Math.PI / 2;
    walkL.position.set(-(FronteiraWorld.ROAD_HALF + 2), 0.02, 70);
    walkL.receiveShadow = true;
    const walkR = walkL.clone();
    walkR.position.x = FronteiraWorld.ROAD_HALF + 2;
    scene.add(walkL, walkR);

    // asphalt road with dashed lines
    const roadTex = makeRoadTexture();
    asphaltMat = new THREE.MeshLambertMaterial({ map: roadTex, flatShading: true });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(FronteiraWorld.ROAD_HALF * 2, 220), asphaltMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.04, 70);
    road.receiveShadow = true;
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
    const water = boxMesh(3.5, 0.2, 3.5, matColor(0x2a4550), false, false);
    water.position.y = 1.5;
    const postL = boxMesh(0.3, 2.4, 0.3, matColor(0x3a2a1c), true, false);
    postL.position.set(-2, 2.4, 0);
    const postR = postL.clone(); postR.position.x = 2;
    const bar = boxMesh(4.4, 0.25, 0.25, matColor(0x2a1c14), true, false);
    bar.position.y = 3.5;
    well.add(base, water, postL, postR, bar);
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

    // scrub cones at south edge
    for (let i = 0; i < 12; i++) {
      const trunk = boxMesh(0.4, 1.2, 0.4, matColor(0x4a3828), true, false);
      const leaf = boxMesh(1.6, 1.8, 1.6, matColor(0x4a6a38), true, false);
      leaf.position.y = 1.8;
      const g = new THREE.Group();
      g.add(trunk, leaf);
      g.position.set(-20 + (i % 6) * 8, 0, -22 - ((i / 6) | 0) * 6);
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

  function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.018);

    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 280);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = shadowsOn;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const amb = new THREE.AmbientLight(0xc4b090, 0.45);
    scene.add(amb);
    sun = new THREE.DirectionalLight(0xffe0b0, 1.35);
    sun.position.set(-40, 55, 20);
    sun.castShadow = shadowsOn;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    scene.add(sun.target);

    clock = new THREE.Clock();
    buildWorld();
  }

  function syncPlayerVisual(dt) {
    playerRoot.position.set(player.x, 0, player.z);
    playerRoot.rotation.y = player.ang;
    // simple walk: alternate legs
    if (player.moving && !reducedMotion) {
      const t = clock.elapsedTime * 10;
      playerRoot.userData.legs[0].position.z = Math.sin(t) * 0.15;
      playerRoot.userData.legs[1].position.z = Math.sin(t + Math.PI) * 0.15;
    } else {
      playerRoot.userData.legs[0].position.z = 0;
      playerRoot.userData.legs[1].position.z = 0;
    }
    // NPCs face player
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
    const k = 1 - Math.exp(-(reducedMotion ? 8 : 6) * dt);
    camPos.lerp(desired, k);
    lookPos.set(
      player.x + s * LOOK_AHEAD,
      1.4,
      player.z + c * LOOK_AHEAD
    );
    camera.position.copy(camPos);
    camera.lookAt(lookPos);
    sun.target.position.set(player.x, 0, player.z);
    sun.target.updateMatrixWorld();
  }

  function drawZoneOverlay() {
    // zone title drawn via DOM hint-bar style — use a dedicated approach on canvas overlay after render
    // We'll draw with 2D context on top if needed; for simplicity use hint when zone fades
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
    lookPos.set(player.x, 1.4, player.z + LOOK_AHEAD);
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
    // mobile: still enable shadows but smaller map already set
    const isMobile = window.matchMedia('(max-width: 900px)').matches || ('ontouchstart' in window);
    shadowsOn = true;
    if (isMobile) {
      // keep shadows but lower res already 1024
    }
    if (typeof THREE === 'undefined') {
      console.error('THREE não carregou');
      return;
    }
    setupThree();
    resize();
    window.addEventListener('resize', resize);
    spawn();
    // render idle canyon on menu
    requestAnimationFrame(frame);
  }

  return { init, start, pause, resume, stopToMenu, tryInteract, get running() { return running; } };
})();
