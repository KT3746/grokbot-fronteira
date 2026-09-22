# FRONTEIRA

Poeira, madeira e gente dura na beira do mapa. Explore um povoado de sertão a pé: fale com a gente, entregue encomendas, ache o que se perdeu e deixe o dia passar.

**Jogar:** https://kt3746.github.io/grokbot-fronteira/

## Como jogar

1. Pressione **Jogar**.
2. Ande pela praça, cantina, armazém, estábulo, capela e beira do mato.
3. Aproxime-se de pessoas ou pontos e use **Interagir**.
4. Siga o **objetivo** no topo da tela.
5. Complete as três tarefas do dia para ver **Dia concluído**.

### Tarefas (v1)

1. Entregar a encomenda do **Seu Zé** (armazém) para a **Dona Clara** (cantina).
2. Achar a **ferradura** no mato e devolver ao **Tião** (estábulo).
3. Buscar **água no poço** (pedido da **Rita**) e levar à cantina.

Personagens: Seu Zé, Dona Clara, Tião, Padre Elias, Rita.

## Controles

| Ação | Teclado | Toque |
|------|---------|-------|
| Mover | WASD / setas | D-pad |
| Interagir | E / Espaço | Botão Interagir |
| Pausar | Esc | Botão ❚❚ |
| Mudo | — | 🔊 |

Interface **somente em português (PT-BR)**.

## Técnico

Site estático na raiz do repositório (GitHub Pages). Vanilla JS + Canvas 2D + Web Audio API. Sem build, sem npm.

```
index.html
css/style.css
js/audio.js  world.js  input.js  ui.js  game.js  main.js
.nojekyll
```

Vista **¾ / oblíqua** (não top-down puro): fachadas altas, profundidade por Y, céu e mato ao longe. Mobile-first (D-pad e botão grandes, safe-area). Respeita `prefers-reduced-motion`.

Jogo **original** — sem personagens ou marcas licenciadas.

## Licença

Jogo original. Feito para o hub Grok Bot.
