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
  let lastNodes = []; // 直近に計算した位置。画像書き出しで再利用する。
  let lastStageSize = 600;
  let lastOrbR = 20;

  const WHEEL_HUE_STOPS = []; // 角度の刻み。CSSとCanvas書き出しで共有する。
  for (let h = 0; h <= 360; h += 30) WHEEL_HUE_STOPS.push(h);

  // 彩度・明度はテーマごとに変える(テーマの背景の明暗に合わせて見やすい色域にする)。
  function currentWheelTone() {
    const colors = global.ThemeManager ? global.ThemeManager.getThemeColors() : null;
    return colors ? { sat: colors.wheelSat, light: colors.wheelLight } : { sat: 77, light: 71 };
  }

  function buildConicGradient() {
    const { sat, light } = currentWheelTone();
    const stops = WHEEL_HUE_STOPS.map((h) => `hsl(${h},${sat}%,${light}%) ${(h / 360) * 100}%`);
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }

  function orbRadiusFor(size) {
    return ColorUtils.clamp(size * 0.034, 15, 27);
  }

  // 色相環の輪が六角形なので、外周までの距離は角度によって変わる
  // (頂点方向ではradius、辺の中点方向では約0.866*radiusまでしかない)。
  // その比率を返し、配置計算で「輪のすぐ内側」を正しく再現するために使う。
  function hexBoundaryFraction(angleDeg) {
    const apothemRatio = Math.cos(Math.PI / 6); // 0.866...
    let t = ((angleDeg + 90) % 60 + 60) % 60 - 30;
    return apothemRatio / Math.cos((t * Math.PI) / 180);
  }

  function computeTargets(characters, size) {
    const cx = size / 2, cy = size / 2;
    const baseMaxR = size / 2 * 0.93;
    const minR = size / 2 * 0.10;
    return characters.map((c) => {
      const { h, s } = ColorUtils.hexToHsl(c.color);
      const angleDeg = h - 90;
      const angleRad = (angleDeg * Math.PI) / 180;
      const maxR = baseMaxR * hexBoundaryFraction(angleDeg);
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
    const maxAllowedRBase = size / 2 * 0.97;
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
        const angleDeg = (Math.atan2(ddy, ddx) * 180) / Math.PI;
        const maxAllowedR = maxAllowedRBase * hexBoundaryFraction(angleDeg);
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
    lastNodes = nodes;
    lastStageSize = size;
    lastOrbR = orbR;
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
    document.addEventListener('themechange', () => {
      ringEl.style.background = buildConicGradient();
    });

    const onResize = Utils.debounce(() => rebuild(), 180);
    window.addEventListener('resize', onResize);

    stage.addEventListener('click', () => {
      global.HoverCard && global.HoverCard.hideAll();
    });
  }

  // ---------- 色相環を画像として書き出す ----------
  // 外部ライブラリ(html2canvas等)を使わず、Canvas APIで自前描画する。
  // 今のビューポート幅ではなく、常に一定の高解像度サイズで組み直すことで、
  // スマホで開いていても綺麗な画像になるようにしている。

  // ライブ表示の --hex-clip と同じ向き(頂点が真上)の六角形パスを作る。
  function hexagonPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = ((-90 + i * 60) * Math.PI) / 180;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function loadImageSafe(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      const isDataUri = src.startsWith('data:');
      if (!isDataUri) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // 読み込めない画像はプレースホルダーに任せる
      img.src = src;
    });
  }

  async function exportImage() {
    const EXPORT_SIZE = 1000; // 色相環そのものの直径(px)
    const PAD_TOP = 120, PAD_SIDE = 60, PAD_BOTTOM = 60;
    const scale = 2; // 高解像度書き出し用

    const state = Store.get();
    const visibleIds = new Set(Store.filteredCharacters().map((c) => c.id));
    const hasFilter = state.selectedTags.length > 0;
    const characters = state.characters.filter((c) => !hasFilter || visibleIds.has(c.id));
    if (characters.length === 0) {
      alert('保存できるキャラクターがいません。');
      return null;
    }

    const orbR = orbRadiusFor(EXPORT_SIZE);
    const nodes = relax(computeTargets(characters, EXPORT_SIZE), EXPORT_SIZE, orbR);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    try {
      await document.fonts.load('700 40px "Zen Kaku Gothic New"');
      await document.fonts.load('500 20px "Zen Kaku Gothic New"');
    } catch (e) { /* フォント読み込み失敗時はブラウザ既定フォントで続行 */ }

    const images = await Promise.all(characters.map(async (c) => {
      const hex = ColorUtils.normalizeHex(c.color);
      const src = c.image || global.Avatar.placeholderDataUri(hex, c.name);
      let img = await loadImageSafe(src);
      if (!img) img = await loadImageSafe(global.Avatar.placeholderDataUri(hex, c.name));
      return { c, img };
    }));

    const canvasW = EXPORT_SIZE + PAD_SIDE * 2;
    const canvasH = EXPORT_SIZE + PAD_TOP + PAD_BOTTOM;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const theme = global.ThemeManager.getThemeColors();
    const { sat: wheelSat, light: wheelLight } = currentWheelTone();
    const bgVoid = theme.bgVoid;
    const { r: vr, g: vg, b: vb } = ColorUtils.hexToRgb(bgVoid);
    const cx = PAD_SIDE + EXPORT_SIZE / 2;
    const cy = PAD_TOP + EXPORT_SIZE / 2;
    const radius = EXPORT_SIZE / 2;

    // 背景(テーマの下地色)
    ctx.fillStyle = bgVoid;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // タイトル
    ctx.fillStyle = theme.textPrimary;
    ctx.font = '700 30px "Zen Kaku Gothic New", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('キャラクター色相環ソート', canvasW / 2, 56);
    if (hasFilter) {
      ctx.fillStyle = theme.accentText;
      ctx.font = '500 15px "Zen Kaku Gothic New", sans-serif';
      ctx.fillText(`絞り込み: ${state.selectedTags.join(' + ')} (${state.filterMode})`, canvasW / 2, 82);
    }

    // 色相環の輪(CSSのconic-gradientと同じ色停止点)
    const conic = ctx.createConicGradient(-Math.PI / 2, cx, cy);
    WHEEL_HUE_STOPS.forEach((h) => {
      conic.addColorStop(h / 360, `hsl(${h},${wheelSat}%,${wheelLight}%)`);
    });
    ctx.save();
    hexagonPath(ctx, cx, cy, radius);
    ctx.fillStyle = conic;
    ctx.fill();

    // 中心が晴れていくような、背景色へのフェード
    const voidGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.46);
    voidGrad.addColorStop(0, `rgba(${vr},${vg},${vb},1)`);
    voidGrad.addColorStop(0.17, `rgba(${vr},${vg},${vb},1)`);
    voidGrad.addColorStop(0.43, `rgba(${vr},${vg},${vb},0.42)`);
    voidGrad.addColorStop(1, `rgba(${vr},${vg},${vb},0)`);
    ctx.fillStyle = voidGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    // 環の輪郭を薄く
    ctx.save();
    hexagonPath(ctx, cx, cy, radius);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.restore();

    // キャラクターのオーブ
    images.forEach(({ c, img }) => {
      const n = nodeById.get(c.id);
      if (!n || !img) return;
      const x = cx - radius + n.x;
      const y = cy - radius + n.y;
      const hex = ColorUtils.normalizeHex(c.color);

      ctx.save();
      hexagonPath(ctx, x, y, orbR);
      ctx.clip();

      // object-fit: cover 相当のクロップ
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const side = Math.min(iw, ih);
      const sx = (iw - side) / 2, sy = (ih - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, x - orbR, y - orbR, orbR * 2, orbR * 2);
      ctx.restore();

      // 背景色のリング + カラーの縁取り
      hexagonPath(ctx, x, y, orbR + 1.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = bgVoid;
      ctx.stroke();

      hexagonPath(ctx, x, y, orbR);
      ctx.lineWidth = 2;
      ctx.strokeStyle = hex;
      ctx.stroke();
    });

    // 日付の透かし
    ctx.fillStyle = theme.textFaint;
    ctx.font = '500 13px "Zen Kaku Gothic New", sans-serif';
    ctx.textAlign = 'right';
    const stamp = new Date().toLocaleDateString('ja-JP');
    ctx.fillText(stamp, canvasW - PAD_SIDE, canvasH - 22);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { alert('画像の生成に失敗しました。'); resolve(null); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `character-hue-wheel_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(blob);
      }, 'image/png');
    });
  }

  global.Wheel = { mount, rebuild, updateFilterVisuals, exportImage };
})(window);
