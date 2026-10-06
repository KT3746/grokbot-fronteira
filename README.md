# FRONTEIRA

Poeira, madeira e gente dura na beira do mapa. Explore um povoado de sertão a pé: fale com a gente, entregue encomendas, ache o que se perdeu e deixe o dia passar.

**Jogar:** https://kt3746.github.io/grokbot-fronteira/?v=202610060540

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
| Mover (relativo à câmera) | WASD / setas | Arrastar na tela (joystick) ou D-pad |
| Interagir | E / Espaço | Botão Interagir |
| Pausar | Esc | Botão ❚❚ |
| Mudo | — | 🔊 |

Interface **somente em português (PT-BR)**.

## Técnico

Site estático na raiz do repositório (GitHub Pages). **Three.js** (CDN) + WebGL baixo-poli em 3ª pessoa + Web Audio API. Sem build, sem npm.

```
index.html
css/style.css
js/audio.js  world.js  input.js  ui.js  game.js  main.js
.nojekyll
```

Câmera em **terceira pessoa** (chase cam) com **Three.js / WebGL** baixo-poli: rua de asfalto em canyon, prédios com grade de janelas, névoa sépia, sombras duras. Mobile-first (D-pad e botão grandes, safe-area). Respeita `prefers-reduced-motion`.

### Wave 2
- Meta diária suave (localStorage PT-BR): zonas descobertas + falas
- Toast/flash de tarefa concluída (safe com `prefers-reduced-motion`)
- Tracker de objetivos 0/3 + bússola no HUD (clareza mobile)

### Wave 3
- Inventário no HUD (embrulho / ferradura / balde) quando carrega item
- Seta dourada na bússola aponta ao próximo objetivo
- Chip de local persistente + vibração no Android (interagir / tarefa / zona)
- Diálogo: toque em qualquer lugar para avançar; botão Interagir pulsa perto

### Wave 4
- Joystick analógico flutuante: arraste o dedo na metade esquerda (velocidade proporcional), D-pad continua
- Baliza dourada 3D flutuando sobre o próximo objetivo + chip de distância (ex.: "Seu Zé · 22 m")
- Cronômetro do dia no HUD + recorde de melhor dia (tela final e menu)
- Cache-bust `?v=202610060540`

Jogo **original** — sem personagens ou marcas licenciadas.

## Licença

Jogo original. Feito para o hub Grok Bot.
