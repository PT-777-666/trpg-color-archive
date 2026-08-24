/* wheel.js — 色相環そのものと、キャラクターの配置ロジック。
 *
 * 配置方針:
 *  - 角度 = キャラクターの登録カラーの色相(H)。0度(赤)を12時方向に置き、時計回りに進む。
 *  - 半径 = 登録カラーの彩度(S)のみ。彩度が高いほど外周(鮮やかな色の帯)に、
 *    低いほど中心の暗がりに近づく。
 *  - オーブの大きさは全キャラクター共通(明度による大小はつけない)。
 *  - 色が近いキャラクター同士は重なってもよい(位置の正確さを優先する)。
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

  // 色が近いオーブ同士が重なったとき、最後に触れた(ホバー/フォーカス/クリックした)
  // オーブがそのまま最前面に残るようにする。CSSの:hoverだけだと指を離した瞬間に
  // 元の重なり順へ戻ってしまい、埋もれた側を選び直せなかったための対応。
  let zCounter = 2;
  function bringToFront(el) {
    zCounter += 1;
    el.style.zIndex = zCounter;
  }

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

  // アイコン(オーブ)サイズはスライダーで手元調整できるようにする。
  // 表示サイズはwheel-stageの大きさに応じた自動計算(size*0.034、15〜27pxの範囲)を
  // 基準に、この倍率(50%〜200%)を掛けて使う。値はブラウザに記憶させておく。
  const ORB_SIZE_STORAGE_KEY = 'orbSizeMultiplier';
  const ORB_SIZE_MIN = 0.5, ORB_SIZE_MAX = 2;
  let orbSizeMultiplier = ColorUtils.clamp(Number(localStorage.getItem(ORB_SIZE_STORAGE_KEY)) || 1, ORB_SIZE_MIN, ORB_SIZE_MAX);

  function orbRadiusFor(size) {
    const base = ColorUtils.clamp(size * 0.034, 15, 27);
    return ColorUtils.clamp(base * orbSizeMultiplier, 8, 54);
  }

  function getOrbSizeMultiplier() {
    return orbSizeMultiplier;
  }

  function setOrbSizeMultiplier(mult) {
    orbSizeMultiplier = ColorUtils.clamp(mult, ORB_SIZE_MIN, ORB_SIZE_MAX);
    localStorage.setItem(ORB_SIZE_STORAGE_KEY, orbSizeMultiplier);
    rebuild();
  }

  function currentShape() {
    const colors = global.ThemeManager ? global.ThemeManager.getThemeColors() : null;
    return (colors && colors.shape) || 'circle';
  }

  // baseMaxR(size/2の93%)は円の外周に対する安全マージンとして選んだ値だが、
  // 正方形の「辺の中点」方向の外周までの距離もちょうどsize/2(=93%より外側)
  // なので、角度によらずこのbaseMaxRをそのまま使って安全(角の方向は
  // なおさら余裕がある)。形ごとに最大半径を縮める必要はない。
  function computeTargets(characters, size) {
    const cx = size / 2, cy = size / 2;
    const baseMaxR = size / 2 * 0.93;
    const minR = size / 2 * 0.10;
    return characters.map((c) => {
      const { h, s } = ColorUtils.hexToHsl(c.color);
      const angleRad = (ColorUtils.hueToAngle(h) * Math.PI) / 180;
      const satFrac = ColorUtils.clamp(s, 0, 100) / 100;
      const r = minR + satFrac * (baseMaxR - minR);
      return {
        id: c.id,
        x: cx + r * Math.cos(angleRad),
        y: cy + r * Math.sin(angleRad)
      };
    });
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

    const onEnter = () => {
      bringToFront(el);
      global.HoverCard && global.HoverCard.show(character.id, el);
    };
    const onLeave = () => global.HoverCard && global.HoverCard.hide(character.id);
    const onClick = (e) => {
      e.stopPropagation();
      bringToFront(el);
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
    // id/colorだけでなくname・imageも入れておく。どちらもオーブの見た目
    // (プレースホルダーの頭文字や画像そのもの)に関わるため、これらだけが
    // 変わった編集でも再描画(paintOrb)が確実に走るようにする。
    return characters.map((c) => `${c.id}:${c.color}:${c.name}:${c.image || ''}`).join('|');
  }

  function rebuild() {
    const state = Store.get();
    // カラーコード未設定の子は色相環上の位置に意味がないため表示しない
    // (一覧側の「カラー未設定」セクションで見つけて登録してもらう)。
    const characters = state.characters.filter((c) => c.color);
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
    const nodes = computeTargets(characters, size);
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
      <div class="orbs-layer"></div>
    `;
    ringEl = stage.querySelector('.wheel-ring');
    orbsLayerEl = stage.querySelector('.orbs-layer');
    ringEl.style.background = buildConicGradient();

    Store.subscribe(() => scheduleRebuildIfNeeded());
    document.addEventListener('themechange', () => {
      ringEl.style.background = buildConicGradient();
      // テーマによって輪の形(円/スクエア)が変わるため、配置も引き直す
      rebuild();
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

  function circlePath(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  // ビビッドテーマの角丸スクエア用パス。rは正方形の半幅として扱う。
  function roundedSquarePath(ctx, cx, cy, r, cornerR) {
    ctx.beginPath();
    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, Math.min(cornerR, r));
  }

  function shapePath(ctx, cx, cy, r, cornerR) {
    if (currentShape() === 'square') roundedSquarePath(ctx, cx, cy, r, cornerR);
    else circlePath(ctx, cx, cy, r);
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

  async function exportImage(options) {
    const transparent = !!(options && options.transparent);
    const EXPORT_SIZE = 1000; // 色相環そのものの直径(px)
    const PAD_TOP = 120, PAD_SIDE = 60, PAD_BOTTOM = 60;
    const scale = 2; // 高解像度書き出し用

    const state = Store.get();
    const visibleIds = new Set(Store.filteredCharacters().map((c) => c.id));
    const hasFilter = state.selectedTags.length > 0;
    // カラーコード未設定の子は色相環上に表示していないので、書き出しにも含めない
    const characters = state.characters.filter((c) => c.color && (!hasFilter || visibleIds.has(c.id)));
    if (characters.length === 0) {
      alert('保存できるキャラクターがいません。');
      return null;
    }

    const orbR = orbRadiusFor(EXPORT_SIZE);
    const nodes = computeTargets(characters, EXPORT_SIZE);
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
    const wheelVoid = theme.wheelVoid || bgVoid;
    const { r: vr, g: vg, b: vb } = ColorUtils.hexToRgb(wheelVoid);
    const cx = PAD_SIDE + EXPORT_SIZE / 2;
    const cy = PAD_TOP + EXPORT_SIZE / 2;
    const radius = EXPORT_SIZE / 2;
    // ライブ表示のビビッド用.wheel-ringはborder-radius: 10px(固定px)。
    // wheel-stageの最大幅760px(半径380px)を基準に、書き出しの半径に
    // 比例換算する(そのまま40pxを使うと実物より丸まりすぎてしまう)
    const wheelCornerR = radius * (10 / 380);

    // 背景(テーマの下地色)。透過指定時はここを塗らず、キャンバスの初期状態(透明)のままにする
    if (!transparent) {
      ctx.fillStyle = bgVoid;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

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
    shapePath(ctx, cx, cy, radius, wheelCornerR);
    // ライブ表示の.wheel-ringはfilter: saturate(0.95) brightness(1.02)を
    // かけているので、書き出しでも同じ色味になるよう揃える
    ctx.filter = 'saturate(0.95) brightness(1.02)';
    // ライブ表示の.wheel-ringの立体感(box-shadow)相当。ビビッドは太い
    // オフセット影、それ以外はやわらかいドロップシャドウにする
    if (currentShape() === 'square') {
      ctx.shadowColor = '#0a0a0a';
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = 'rgba(120,95,60,0.20)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 25;
      ctx.shadowBlur = 55;
    }
    ctx.fillStyle = conic;
    ctx.fill();
    ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;

    // 中心が晴れていくような、背景色へのフェード。ライブ表示の.wheel-voidは
    // 「circle at center」の既定サイズ(farthest-corner = radius*√2)を基準に
    // 0/8/20/34/46%の位置に色停止点を置いているので、そのままの縮尺で揃える
    const voidMaxR = radius * Math.SQRT2 * 0.46;
    const voidGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, voidMaxR);
    voidGrad.addColorStop(0, `rgba(${vr},${vg},${vb},1)`);
    voidGrad.addColorStop(0.08 / 0.46, `rgba(${vr},${vg},${vb},1)`);
    voidGrad.addColorStop(0.20 / 0.46, `rgba(${vr},${vg},${vb},0.88)`);
    voidGrad.addColorStop(0.34 / 0.46, `rgba(${vr},${vg},${vb},0.42)`);
    voidGrad.addColorStop(1, `rgba(${vr},${vg},${vb},0)`);
    ctx.fillStyle = voidGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    // 環の輪郭(ビビッドは太い黒枠、それ以外は薄い白のライン)
    ctx.save();
    shapePath(ctx, cx, cy, radius, wheelCornerR);
    if (currentShape() === 'square') {
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#0a0a0a';
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    }
    ctx.stroke();
    ctx.restore();

    // キャラクターのオーブ
    images.forEach(({ c, img }) => {
      const n = nodeById.get(c.id);
      if (!n || !img) return;
      const x = cx - radius + n.x;
      const y = cy - radius + n.y;
      const hex = ColorUtils.normalizeHex(c.color);

      const isSquare = currentShape() === 'square';
      const orbCornerR = orbR * 0.3;

      // ビビッドの.orb-imgはbox-shadow: 3px 3px 0 #0a0a0aという
      // ハードシャドウを持つ。box-shadowは要素の塗り形状全体に落ちるので、
      // 画像を描く前に同じ形を一度塗ってシャドウだけ落としておく
      // (この塗り自体は後で画像に完全に覆われるので色は何でもよい)
      if (isSquare) {
        ctx.save();
        ctx.shadowColor = '#0a0a0a';
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.shadowBlur = 0;
        shapePath(ctx, x, y, orbR, orbCornerR);
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
        ctx.restore();
      }

      // オーブの下に、キャラクターの色のやわらかい光彩を敷く
      // (ライブ表示の.orb-glowと同じ。ビビッドはフラットな見た目が基調なので描かない)
      if (!isSquare) {
        const glowR = orbR * 1.7;
        ctx.save();
        ctx.globalAlpha = 0.22;
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glowGrad.addColorStop(0, hex);
        glowGrad.addColorStop(0.68, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      shapePath(ctx, x, y, orbR, orbCornerR);
      ctx.clip();

      // 画像に透明な部分があってもキャラクターの色が背景として見えるようにする
      // (ライブ表示の.orb-img { background: var(--orb-color) } と同じ挙動)
      ctx.fillStyle = hex;
      ctx.fillRect(x - orbR, y - orbR, orbR * 2, orbR * 2);

      // object-fit: cover 相当のクロップ
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const side = Math.min(iw, ih);
      const sx = (iw - side) / 2, sy = (ih - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, x - orbR, y - orbR, orbR * 2, orbR * 2);
      ctx.restore();

      if (isSquare) {
        // ビビッドは太い黒枠のみ(背景色のリングは使わない)
        shapePath(ctx, x, y, orbR, orbCornerR);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0a0a0a';
        ctx.stroke();
      } else {
        // 白パネル色のリング(ライブ表示の.orb-imgの
        // box-shadow 0 0 0 3px var(--bg-panel) と同じ。wheel-void(中心の
        // フェード色)とは別のトークンなので取り違えないよう注意)
        shapePath(ctx, x, y, orbR + 1.5, orbCornerR);
        ctx.lineWidth = 3;
        ctx.strokeStyle = theme.bgPanel;
        ctx.stroke();
      }
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { alert('画像の生成に失敗しました。'); resolve(null); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const suffix = transparent ? '_transparent' : '';
        a.download = `character-hue-wheel_${new Date().toISOString().slice(0, 10)}${suffix}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(blob);
      }, 'image/png');
    });
  }

  global.Wheel = { mount, rebuild, updateFilterVisuals, exportImage, getOrbSizeMultiplier, setOrbSizeMultiplier };
})(window);
