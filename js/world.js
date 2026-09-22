/* FRONTEIRA — layout canyon (rua principal) + NPCs/quests */
const FronteiraWorld = (() => {
  // Units ≈ meters. X = L/R, Z = ao longo da rua (norte+).
  const ROAD_HALF = 7;
  const BUILD_GAP = 0.4;

  // Named landmark footprints (collision AABBs in XZ). y unused for collision.
  // Continuous canyon fillers generated in game.js from streetSegments.
  const solids = [
    // Capela — fundo da rua (norte)
    { id: 'capela', x: -10, z: 155, w: 20, d: 14, h: 22, style: 'capela', label: 'Capela', color: 0xc8b8a0 },
    // Armazém — lado esquerdo
    { id: 'armazem', x: -28, z: 35, w: 16, d: 18, h: 16, style: 'armazem', label: 'Armazém', color: 0x8a6a48 },
    // Cantina — lado direito
    { id: 'cantina', x: 12, z: 55, w: 18, d: 16, h: 15, style: 'cantina', label: 'Cantina', color: 0x9a5848 },
    // Estábulo — sul-oeste, off main
    { id: 'estabulo', x: -30, z: -5, w: 22, d: 16, h: 12, style: 'estabulo', label: 'Estábulo', color: 0x8a7848 },
    // Casas
    { id: 'casa1', x: 12, z: 95, w: 14, d: 12, h: 13, style: 'casa', label: 'Casa', color: 0xa88860 },
    { id: 'casa2', x: -26, z: 95, w: 12, d: 12, h: 12, style: 'casa', label: 'Casa', color: 0x9a7a58 },
    // Poço collision ring (center open for interact)
    { id: 'poco-n', x: -3, z: 78, w: 6, d: 1.2, h: 1.2, style: 'poco', label: '', color: 0x666660 },
    { id: 'poco-s', x: -3, z: 84.8, w: 6, d: 1.2, h: 1.2, style: 'poco', label: '', color: 0x666660 },
    { id: 'poco-w', x: -3, z: 78, w: 1.2, d: 8, h: 1.2, style: 'poco', label: '', color: 0x666660 },
    { id: 'poco-e', x: 1.8, z: 78, w: 1.2, d: 8, h: 1.2, style: 'poco', label: '', color: 0x666660 },
  ];

  // Dense canyon filler buildings lining BOTH sides of the main street
  // Each: { side:'L'|'R', z, w, d, h, color }
  const canyon = [];
  const leftColors = [0xb8a078, 0xa89068, 0xc4a880, 0x9a8060, 0xb09070, 0x8a7050];
  const rightColors = [0xa88860, 0xb89870, 0x9a7858, 0xc0a070, 0x8a6848, 0xb49068];
  let z = -25;
  let i = 0;
  while (z < 170) {
    // skip gaps for named landmark frontages
    const skipL = (z > 30 && z < 55) || (z > 90 && z < 110) || (z > 150);
    const skipR = (z > 50 && z < 75) || (z > 90 && z < 110) || (z > 150);
    const depth = 10 + (i % 3) * 2;
    const height = 14 + (i % 5) * 3;
    const width = 11 + (i % 4) * 2;
    if (!skipL) {
      canyon.push({
        side: 'L', z, w: width, d: depth, h: height,
        color: leftColors[i % leftColors.length],
        x: -ROAD_HALF - 1.5 - width,
      });
    }
    if (!skipR) {
      canyon.push({
        side: 'R', z, w: width, d: depth, h: height + ((i % 2) ? 2 : 0),
        color: rightColors[i % rightColors.length],
        x: ROAD_HALF + 1.5,
      });
    }
    z += depth + BUILD_GAP;
    i++;
  }

  // Collision for canyon boxes
  for (const b of canyon) {
    solids.push({
      id: 'canyon_' + b.side + '_' + (b.z | 0),
      x: b.x, z: b.z, w: b.w, d: b.d, h: b.h,
      style: 'canyon', label: '', color: b.color,
    });
  }

  const interactables = [
    { id: 'door_armazem', x: -12, z: 42, w: 4, d: 4, kind: 'npc_link', npc: 'seu_ze', hint: 'Armazém do Seu Zé' },
    { id: 'door_cantina', x: 10, z: 62, w: 4, d: 4, kind: 'npc_link', npc: 'dona_clara', hint: 'Cantina da Dona Clara' },
    { id: 'door_estabulo', x: -10, z: 2, w: 4, d: 4, kind: 'npc_link', npc: 'tiao', hint: 'Estábulo do Tião' },
    { id: 'door_capela', x: 0, z: 152, w: 5, d: 4, kind: 'npc_link', npc: 'padre_elias', hint: 'Capela' },
    { id: 'poco', x: -0.5, z: 81, w: 5, d: 5, kind: 'well', hint: 'Poço da praça' },
    { id: 'ferradura', x: -18, z: -18, w: 3, d: 3, kind: 'item', item: 'ferradura', hint: 'Algo brilha no mato…', collected: false },
  ];

  const npcs = [
    {
      id: 'seu_ze', name: 'Seu Zé', x: -11, z: 44,
      shirt: 0xc45a20, pants: 0x1a1a1a, skin: 0xc4a07a, hat: 0x1a1410,
      place: 'Armazém',
      lines: {
        idle: ['Armazém cheio de poeira e café. O que precisa?', 'Encomenda da cantina tá pronta. Leva pra Dona Clara?'],
        quest_give: ['Leva esse embrulho pra cantina. Clara tá esperando o feijão e o açúcar.'],
        quest_done: ['Entregou? Bom. O povoado anda quando a gente anda.'],
        after: ['Se precisar de farinha, é comigo.'],
      },
    },
    {
      id: 'dona_clara', name: 'Dona Clara', x: 11, z: 63,
      shirt: 0x8a4040, pants: 0x2a2028, skin: 0xd4b090, hat: 0xc4a574,
      place: 'Cantina',
      lines: {
        idle: ['Cantina aberta. Café quente, conversa fria.', 'Tô esperando a encomenda do Zé…'],
        receive: ['Ah, a encomenda! Deus te pague, filho. Fica o cheiro de comida no ar.'],
        after: ['Senta quando quiser. Hoje o feijão rende.'],
        need_water: ['Rita pediu água limpa do poço. Se puder buscar…'],
      },
    },
    {
      id: 'tiao', name: 'Tião', x: -12, z: 4,
      shirt: 0x5a5840, pants: 0x2c2c22, skin: 0xb89068, hat: 0x4a3828,
      place: 'Estábulo',
      lines: {
        idle: ['Cavalo sem ferradura não vai longe.', 'Perdi uma ferradura perto do mato, ao sul. Viu?'],
        found: ['Essa mesmo! Agora o bicho anda sem coxear. Valeu.'],
        after: ['Estábulo em ordem. Obrigado pela ajuda.'],
      },
    },
    {
      id: 'padre_elias', name: 'Padre Elias', x: 0, z: 153,
      shirt: 0x2a2a30, pants: 0x1a1a20, skin: 0xc8a888, hat: 0x2a2a32,
      place: 'Capela',
      lines: {
        idle: ['A capela é sombra no sol. Entre em paz.', 'Ajude o próximo — o dia fica mais leve.'],
        bless: ['Que o caminho te guarde, viajante.'],
      },
    },
    {
      id: 'rita', name: 'Rita', x: 4, z: 82,
      shirt: 0x6a5058, pants: 0x3a3038, skin: 0xd0a878, hat: 0xd4b890,
      place: 'Praça',
      lines: {
        idle: ['O poço tá bom hoje. Água clara.', 'Leva um balde pra Dona Clara? A cantina precisa.'],
        got_water: ['Levou água? Clara vai ficar feliz.'],
        thanks: ['Obrigada. A praça fica melhor com gente prestativa.'],
        after: ['Sol quente, sombra curta. Cuida da sede.'],
      },
    },
  ];

  const quests = [
    { id: 'entrega', title: 'Leve a encomenda à cantina' },
    { id: 'ferradura', title: 'Ache a ferradura do Tião' },
    { id: 'agua', title: 'Leve água do poço à cantina' },
  ];

  const spawn = { x: 0, z: 18, ang: 0 }; // looking +Z down the canyon

  const bounds = { minX: -40, maxX: 40, minZ: -30, maxZ: 175 };

  function aabbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
  }

  function collides(box) {
    // box: {x,z,w,d}
    if (box.x < bounds.minX || box.x + box.w > bounds.maxX ||
        box.z < bounds.minZ || box.z + box.d > bounds.maxZ) return true;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (aabbOverlap(box, { x: s.x, z: s.z, w: s.w, d: s.d })) return true;
    }
    return false;
  }

  function nearInteract(px, pz, pr) {
    const box = { x: px - pr, z: pz - pr, w: pr * 2, d: pr * 2 };
    let best = null, bestD = 1e9;
    for (const it of interactables) {
      if (it.kind === 'item' && it.collected) continue;
      const ib = { x: it.x, z: it.z, w: it.w, d: it.d };
      if (!aabbOverlap(box, ib)) continue;
      const cx = it.x + it.w / 2, cz = it.z + it.d / 2;
      const d = (cx - px) * (cx - px) + (cz - pz) * (cz - pz);
      if (d < bestD) { bestD = d; best = { type: 'spot', ref: it }; }
    }
    for (const n of npcs) {
      const nb = { x: n.x - 1.2, z: n.z - 1.2, w: 2.4, d: 2.4 };
      if (!aabbOverlap(box, nb)) continue;
      const d = (n.x - px) * (n.x - px) + (n.z - pz) * (n.z - pz);
      if (d < bestD) { bestD = d; best = { type: 'npc', ref: n }; }
    }
    return best;
  }

  function resetItems() {
    for (const it of interactables) {
      if (it.kind === 'item') it.collected = false;
    }
  }

  function zoneAt(x, z) {
    if (z > 145) return 'Capela';
    if (x < -8 && z > 30 && z < 55) return 'Armazém';
    if (x > 8 && z > 50 && z < 75) return 'Cantina';
    if (z < 10 && x < -5) return 'Estábulo';
    if (z > 70 && z < 95) return 'Praça';
    return 'Rua Principal';
  }

  return {
    ROAD_HALF, solids, canyon, interactables, npcs, quests, spawn, bounds,
    collides, nearInteract, resetItems, zoneAt, aabbOverlap,
  };
})();
