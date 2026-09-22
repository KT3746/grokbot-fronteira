/* FRONTEIRA — mapa, NPCs, interativos, missões (dados) */
const FronteiraWorld = (() => {
  const TILE = 32;
  const W = 42; // tiles
  const H = 32;

  // 0=chão, 1=poeira clara (praça), 2=mato, 3=água poço, 4=caminho
  const ground = [];
  for (let y = 0; y < H; y++) {
    ground[y] = [];
    for (let x = 0; x < W; x++) {
      let t = 0;
      if (x < 3 || x > W - 4 || y < 2 || y > H - 3) t = 2; // beira do mato
      // praça central
      if (x >= 16 && x <= 24 && y >= 12 && y <= 18) t = 1;
      // caminho cruz
      if ((x >= 8 && x <= 34 && (y === 15 || y === 16)) ||
          (y >= 6 && y <= 26 && (x === 20 || x === 21))) t = 4;
      ground[y][x] = t;
    }
  }
  // poço water tiles
  ground[14][20] = 3;
  ground[14][21] = 3;
  ground[15][20] = 3;
  ground[15][21] = 3;

  // Collision AABBs (world px): buildings, fences, well rim
  const solids = [
    // Capela (norte)
    { x: 17 * TILE, y: 3 * TILE, w: 8 * TILE, h: 5 * TILE, label: 'capela', style: 'capela', facade: 118, height3d: 140, color: '#c4b49a' },
    // Armazém (oeste)
    { x: 4 * TILE, y: 10 * TILE, w: 7 * TILE, h: 5.5 * TILE, label: 'armazem', style: 'armazem', facade: 100, height3d: 110, color: '#8a6a48' },
    // Cantina (leste)
    { x: 29 * TILE, y: 10 * TILE, w: 8 * TILE, h: 5.5 * TILE, label: 'cantina', style: 'cantina', facade: 100, height3d: 115, color: '#9a5848' },
    // Estábulo (sul-oeste)
    { x: 5 * TILE, y: 22 * TILE, w: 9 * TILE, h: 5.5 * TILE, label: 'estabulo', style: 'estabulo', facade: 92, height3d: 95, color: '#8a7848' },
    // Casas
    { x: 28 * TILE, y: 21 * TILE, w: 6 * TILE, h: 5 * TILE, label: 'casa1', style: 'casa', facade: 86, height3d: 90, color: '#a88860' },
    { x: 14 * TILE, y: 22 * TILE, w: 5 * TILE, h: 4 * TILE, label: 'casa2', style: 'casa', facade: 82, height3d: 85, color: '#9a7a58' },
    // Cerca estábulo (aberto ao norte)
    { x: 4 * TILE, y: 21 * TILE, w: 11 * TILE, h: 10, label: 'cerca-s' },
    { x: 4 * TILE, y: 21 * TILE, w: 10, h: 7 * TILE, label: 'cerca-w' },
    { x: 14 * TILE + 22, y: 21 * TILE, w: 10, h: 7 * TILE, label: 'cerca-e' },
    // Poço borda (deixar centro interagível — só moldura)
    { x: 19 * TILE + 4, y: 13 * TILE + 4, w: 56, h: 8, label: 'poco-n' },
    { x: 19 * TILE + 4, y: 16 * TILE + 20, w: 56, h: 8, label: 'poco-s' },
    { x: 19 * TILE + 4, y: 13 * TILE + 4, w: 8, h: 56, label: 'poco-w' },
    { x: 21 * TILE + 20, y: 13 * TILE + 4, w: 8, h: 56, label: 'poco-e' },
  ];

  // Doorway gaps: remove collision by not covering doors — use markers instead
  // Interact spots near building fronts
  const interactables = [
    {
      id: 'door_armazem',
      x: 7 * TILE, y: 16 * TILE - 8, w: 40, h: 28,
      kind: 'npc_link', npc: 'seu_ze',
      hint: 'Armazém do Seu Zé',
    },
    {
      id: 'door_cantina',
      x: 32 * TILE, y: 16 * TILE - 8, w: 40, h: 28,
      kind: 'npc_link', npc: 'dona_clara',
      hint: 'Cantina da Dona Clara',
    },
    {
      id: 'door_estabulo',
      x: 8 * TILE, y: 22 * TILE - 10, w: 48, h: 28,
      kind: 'npc_link', npc: 'tiao',
      hint: 'Estábulo do Tião',
    },
    {
      id: 'door_capela',
      x: 20 * TILE, y: 8 * TILE - 6, w: 40, h: 28,
      kind: 'npc_link', npc: 'padre_elias',
      hint: 'Capela',
    },
    {
      id: 'poco',
      x: 19.5 * TILE, y: 14 * TILE, w: 48, h: 48,
      kind: 'well',
      hint: 'Poço da praça',
    },
    {
      id: 'ferradura',
      x: 12 * TILE, y: 28 * TILE, w: 28, h: 28,
      kind: 'item',
      item: 'ferradura',
      hint: 'Algo brilha no mato…',
      hiddenUntil: null,
    },
  ];

  const npcs = [
    {
      id: 'seu_ze',
      name: 'Seu Zé',
      x: 7.5 * TILE, y: 16.85 * TILE,
      color: '#6b4a32',
      shirt: '#6a5038',
      pants: '#2e2a24',
      skin: '#c4a07a',
      hat: '#3a2818',
      place: 'Armazém',
      lines: {
        idle: [
          'Armazém cheio de poeira e café. O que precisa?',
          'Encomenda da cantina tá pronta. Leva pra Dona Clara?',
        ],
        quest_give: [
          'Leva esse embrulho pra cantina. Clara tá esperando o feijão e o açúcar.',
        ],
        quest_done: [
          'Entregou? Bom. O povoado anda quando a gente anda.',
        ],
        after: [
          'Se precisar de farinha, é comigo.',
        ],
      },
    },
    {
      id: 'dona_clara',
      name: 'Dona Clara',
      x: 32.5 * TILE, y: 16.85 * TILE,
      color: '#8a4a3a',
      shirt: '#7a4a40',
      pants: '#3a2830',
      skin: '#d4b090',
      hat: '#c4a574',
      place: 'Cantina',
      lines: {
        idle: [
          'Cantina aberta. Café quente, conversa fria.',
          'Tô esperando a encomenda do Zé…',
        ],
        receive: [
          'Ah, a encomenda! Deus te pague, filho. Fica o cheiro de comida no ar.',
        ],
        after: [
          'Senta quando quiser. Hoje o feijão rende.',
        ],
        need_water: [
          'Rita pediu água limpa do poço. Se puder buscar…',
        ],
      },
    },
    {
      id: 'tiao',
      name: 'Tião',
      x: 9 * TILE, y: 21.2 * TILE,
      color: '#5a6a3a',
      shirt: '#5a5840',
      pants: '#2c2c22',
      skin: '#b89068',
      hat: '#4a3828',
      place: 'Estábulo',
      lines: {
        idle: [
          'Cavalo sem ferradura não vai longe.',
          'Perdi uma ferradura perto do mato, ao sul. Viu?',
        ],
        found: [
          'Essa mesmo! Agora o bicho anda sem coxear. Valeu.',
        ],
        after: [
          'Estábulo em ordem. Obrigado pela ajuda.',
        ],
      },
    },
    {
      id: 'padre_elias',
      name: 'Padre Elias',
      x: 20.5 * TILE, y: 8.55 * TILE,
      color: '#3a3a48',
      shirt: '#2a2a30',
      pants: '#1a1a20',
      skin: '#c8a888',
      hat: '#2a2a32',
      place: 'Capela',
      lines: {
        idle: [
          'A capela é sombra no sol. Entre em paz.',
          'Ajude o próximo — o dia fica mais leve.',
        ],
        bless: [
          'Que o caminho te guarde, viajante.',
        ],
      },
    },
    {
      id: 'rita',
      name: 'Rita',
      x: 23 * TILE, y: 17.5 * TILE,
      color: '#7a5a6a',
      shirt: '#6a5058',
      pants: '#3a3038',
      skin: '#d0a878',
      hat: '#d4b890',
      place: 'Praça',
      lines: {
        idle: [
          'O poço tá bom hoje. Água clara.',
          'Leva um balde pra Dona Clara? A cantina precisa.',
        ],
        got_water: [
          'Levou água? Clara vai ficar feliz.',
        ],
        thanks: [
          'Obrigada. A praça fica melhor com gente prestativa.',
        ],
        after: [
          'Sol quente, sombra curta. Cuida da sede.',
        ],
      },
    },
  ];

  const quests = [
    {
      id: 'entrega',
      title: 'Leve a encomenda à cantina',
      steps: ['talk_ze', 'have_package', 'deliver_clara'],
      hud: {
        talk_ze: 'Fale com Seu Zé no armazém',
        have_package: 'Entregue a encomenda na cantina',
        deliver_clara: 'Encomenda entregue!',
      },
    },
    {
      id: 'ferradura',
      title: 'Ache a ferradura do Tião',
      steps: ['talk_tiao', 'find_shoe', 'return_tiao'],
      hud: {
        talk_tiao: 'Fale com Tião no estábulo',
        find_shoe: 'Procure a ferradura no mato ao sul',
        return_tiao: 'Devolva a ferradura ao Tião',
      },
    },
    {
      id: 'agua',
      title: 'Leve água do poço à cantina',
      steps: ['talk_rita', 'fetch_well', 'give_clara_water'],
      hud: {
        talk_rita: 'Fale com Rita na praça',
        fetch_well: 'Encha o balde no poço',
        give_clara_water: 'Leve a água à Dona Clara',
      },
    },
  ];

  function worldPixelSize() {
    return { w: W * TILE, h: H * TILE, tile: TILE, cols: W, rows: H };
  }

  function aabbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function collides(box) {
    for (let i = 0; i < solids.length; i++) {
      if (aabbOverlap(box, solids[i])) return true;
    }
    // world bounds
    if (box.x < TILE || box.y < TILE || box.x + box.w > (W - 1) * TILE || box.y + box.h > (H - 1) * TILE) {
      return true;
    }
    return false;
  }

  function nearInteract(px, py, pr) {
    const box = { x: px - pr, y: py - pr, w: pr * 2, h: pr * 2 };
    let best = null;
    let bestD = 1e9;
    for (const it of interactables) {
      if (it.kind === 'item' && it.collected) continue;
      if (!aabbOverlap(box, it)) continue;
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;
      const d = (cx - px) * (cx - px) + (cy - py) * (cy - py);
      if (d < bestD) { bestD = d; best = { type: 'spot', ref: it }; }
    }
    for (const n of npcs) {
      const nb = { x: n.x - 14, y: n.y - 14, w: 28, h: 28 };
      if (!aabbOverlap(box, nb)) continue;
      const d = (n.x - px) * (n.x - px) + (n.y - py) * (n.y - py);
      if (d < bestD) { bestD = d; best = { type: 'npc', ref: n }; }
    }
    return best;
  }

  function resetItems() {
    for (const it of interactables) {
      if (it.kind === 'item') it.collected = false;
    }
  }

  return {
    TILE, W, H, ground, solids, interactables, npcs, quests,
    worldPixelSize, collides, nearInteract, resetItems, aabbOverlap,
  };
})();
