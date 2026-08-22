/* wheel.js — 色相環そのものと、キャラクターの配置ロジック。
 *
 * 配置方針:
 *  - 角度 = キャラクターの登録カラーの色相(H)。0度(赤)を12時方向に置き、時計回りに進む。
 *  - 半径 = 登録カラーの彩度(S)。彩度が高いほど外周(鮮やかな色の帯)に、
 *    低いほど中心の暗がりに近づく。
 *  - 上記の「本来の位置」を基準に、重なりが出た場合だけ反発シミュレーションで
 *    少しずつ位置をずらす(=色相環の意味を壊さない範囲でのみ視認性を確保)。
 *
 * レイアウトは「表示中のキャラクター」ではなく「登録されている全キャラクター」を
 * 常に基準に計算する。タグ絞り込みは位置を変えず、透明度だけを変化させることで
 * 「同じ場所にいるキャラクターが、フェードで現れたり消えたりする」体験にしている。
 */
(function (global) {
  'use strict';

  const orbEls = new Map(); // id -> element
  let containerEl = null;
  let ringEl = null;
  let orbsLayerEl = null;
  let stageEl = null;
  let lastLayoutKey = '';
  let lastCharCount = -1;

  function buildConicGradient() {
    const stops = [];
    for (let h = 0; h <= 360; h += 30) {
      stops.push(`hsl(${h},77%,71%) ${(h / 360) * 100}%`);
    }
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }

  function orbRadiusFor(size) {
    return ColorUtils.clamp(size * 0.034, 15, 27);
  }

  function computeTargets(characters, size) {
    const cx = size / 2, cy = size / 2;
    const maxR = size / 2 * 0.93;
    const minR = size / 2 * 0.10;
    return characters.map((c) => {
      const { h, s } = ColorUtils.hexToHsl(c.color);
      const angleDeg = h - 90;
      const angleRad = (angleDeg * Math.PI) / 180;
      const r = minR + (ColorUtils.clamp(s, 0, 100) / 100) * (maxR - minR);
      return {
        id: c.id,
        tx: cx + r * Math.cos(angleRad),
        ty: cy + r * Math.sin(angleRad),
        x: cx + r * Math.cos(angleRad),
        y: cy + r * Math.sin(angleRad)
      };
    });
  }

  function relax(nodes, size, orbR) {
    const cx = size / 2, cy = size / 2;
    const minDist = orbR * 2 + 6;
    const maxAllowedR = size / 2 * 0.97;
    const iterations = 220;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist < 0.0001) {
            const ang = Math.random() * Math.PI * 2;
            dx = Math.cos(ang) * 0.5;
            dy = Math.sin(ang) * 0.5;
            dist = 0.5;
          }
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
          }
        }
      }
      // 本来の色相/彩度位置へ弱く引き戻す + 環の外へ出過ぎないようクランプ
      for (const n of nodes) {
        n.x += (n.tx - n.x) * 0.028;
        n.y += (n.ty - n.y) * 0.028;
        const ddx = n.x - cx, ddy = n.y - cy;
        const d = Math.hypot(ddx, ddy);
        if (d > maxAllowedR) {
          const k = maxAllowedR / d;
          n.x = cx + ddx * k;
          n.y = cy + ddy * k;
        }
      }
    }
    return nodes;
  }

  function ensureOrbEl(character) {
    let el = orbEls.get(character.id);
    if (el) return el;
    el = document.createElement('div');
    el.className = 'orb';
    el.dataset.id = character.id;
    el.innerHTML = `
      <div class="orb-glow"></div>
      <img class="orb-img" alt="" draggable="false" />
    `;
    orbsLayerEl.appendChild(el);
    orbEls.set(character.id, el);

    const onEnter = () => global.HoverCard && global.HoverCard.show(character.id, el);
    const onLeave = () => global.HoverCard && global.HoverCard.hide(character.id);
    const onClick = (e) => {
      e.stopPropagation();
      if (Utils.isTouchDevice()) {
        if (global.HoverCard && global.HoverCard.isShowing(character.id)) {
          global.DetailModal.open(character.id);
        } else {
          global.HoverCard && global.HoverCard.show(character.id, el);
        }
      } else {
        global.DetailModal.open(character.id);
      }
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('click', onClick);
    el.addEventListener('focus', onEnter);
    el.addEventListener('blur', onLeave);
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    return el;
  }

  function paintOrb(el, character) {
    const hex = ColorUtils.normalizeHex(character.color);
    el.style.setProperty('--orb-color', hex);
    const img = el.querySelector('.orb-img');
    const src = character.image || global.Avatar.placeholderDataUri(hex, character.name);
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.alt = character.name || '無名のキャラクター';
    el.title = character.name || '';
  }

  function layoutKeyOf(characters) {
    return characters.map((c) => `${c.id}:${c.color}`).join('|');
  }

  function rebuild() {
    const state = Store.get();
    const characters = state.characters;
    const size = stageEl.clientWidth || stageEl.clientHeight || 600;

    // 使われなくなった要素を削除
    const currentIds = new Set(characters.map((c) => c.id));
    orbEls.forEach((el, id) => {
      if (!currentIds.has(id)) {
        el.remove();
        orbEls.delete(id);
      }
    });

    characters.forEach((c) => paintOrb(ensureOrbEl(c), c));

    const orbR = orbRadiusFor(size);
    const nodes = relax(computeTargets(characters, size), size, orbR);
    const diameter = orbR * 2;

    nodes.forEach((n) => {
      const el = orbEls.get(n.id);
      if (!el) return;
      el.style.width = diameter + 'px';
      el.style.height = diameter + 'px';
      el.style.transform = `translate(${n.x - orbR}px, ${n.y - orbR}px)`;
    });

    updateFilterVisuals();
    lastLayoutKey = layoutKeyOf(characters);
    lastCharCount = characters.length;
  }

  function updateFilterVisuals() {
    const visibleIds = new Set(Store.filteredCharacters().map((c) => c.id));
    const hasFilter = Store.get().selectedTags.length > 0;
    orbEls.forEach((el, id) => {
      const visible = !hasFilter || visibleIds.has(id);
      el.classList.toggle('orb-faded', !visible);
    });
  }

  function scheduleRebuildIfNeeded() {
    const characters = Store.get().characters;
    const key = layoutKeyOf(characters);
    if (key !== lastLayoutKey || characters.length !== lastCharCount) {
      rebuild();
    } else {
      updateFilterVisuals();
    }
  }

  function mount(stage) {
    stageEl = stage;
    stage.innerHTML = `
      <div class="wheel-ring"></div>
      <div class="wheel-void"></div>
      <div class="wheel-rings-deco" aria-hidden="true"></div>
      <div class="orbs-layer"></div>
    `;
    ringEl = stage.querySelector('.wheel-ring');
    orbsLayerEl = stage.querySelector('.orbs-layer');
    ringEl.style.background = buildConicGradient();

    Store.subscribe(() => scheduleRebuildIfNeeded());

    const onResize = Utils.debounce(() => rebuild(), 180);
    window.addEventListener('resize', onResize);

    stage.addEventListener('click', () => {
      global.HoverCard && global.HoverCard.hideAll();
    });
  }

  global.Wheel = { mount, rebuild, updateFilterVisuals };
})(window);
