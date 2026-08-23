/* colorWheel.js — イラストソフト風のカラーホイール(角度=色相・半径=彩度)。
 * 明度は別のスライダーで調整する。キャラクターフォームと一覧、両方から使う共通部品。
 * 角度の向きは色相環(wheel.js)と合わせてある(0度=上、時計回りに色相が進む)ので、
 * ここで選んだ色は実際の色相環上の位置とそのまま対応する。
 */
(function (global) {
  'use strict';

  const SIZE = 120;
  const RADIUS = SIZE / 2;

  function angleToHue(angleDeg) {
    const h = angleDeg + 90;
    return ((h % 360) + 360) % 360;
  }

  function hueToAngle(h) {
    return h - 90;
  }

  function drawDisc(canvas, lightness) {
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - RADIUS + 0.5, dy = y - RADIUS + 0.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * SIZE + x) * 4;
        if (r > RADIUS) {
          img.data[idx + 3] = 0;
          continue;
        }
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const h = angleToHue(angleDeg);
        const s = ColorUtils.clamp((r / RADIUS) * 100, 0, 100);
        const rgb = ColorUtils.hslToRgb(h, s, lightness);
        img.data[idx] = rgb.r;
        img.data[idx + 1] = rgb.g;
        img.data[idx + 2] = rgb.b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // container(空のdiv等)にホイールUIを組み立てる。
  // options.initialHex: 初期色 / options.onChange: ドラッグ中に都度呼ばれる(hex) /
  // options.onCommit: ドラッグ終了・確定時に呼ばれる(hex)
  function create(container, options) {
    options = options || {};
    const onChange = options.onChange || function () {};
    const onCommit = options.onCommit || function () {};
    let h = 0, s = 0, l = 50;

    container.innerHTML = `
      <div class="color-wheel">
        <div class="color-wheel-canvas-wrap">
          <canvas class="color-wheel-canvas" width="${SIZE}" height="${SIZE}"></canvas>
          <div class="color-wheel-cursor"></div>
        </div>
        <label class="color-wheel-l-row">
          <span class="color-wheel-l-label">明度</span>
          <input type="range" class="color-wheel-l-slider" min="0" max="100" value="50" />
        </label>
      </div>
    `;

    const canvas = container.querySelector('.color-wheel-canvas');
    const cursor = container.querySelector('.color-wheel-cursor');
    const lSlider = container.querySelector('.color-wheel-l-slider');

    function moveCursor() {
      const angleRad = (hueToAngle(h) * Math.PI) / 180;
      const r = (s / 100) * RADIUS;
      cursor.style.left = (RADIUS + r * Math.cos(angleRad)) + 'px';
      cursor.style.top = (RADIUS + r * Math.sin(angleRad)) + 'px';
      cursor.style.background = ColorUtils.hslToHex(h, s, l);
    }

    function currentHex() {
      return ColorUtils.hslToHex(h, s, l);
    }

    // 外部(手入力のカラーコード欄など)からの色変更をホイールに反映する。
    // ドラッグ中の自分自身の変更ではここを通らないので、redraw頻度は低く保たれる。
    function setHex(hex) {
      const hsl = ColorUtils.hexToHsl(hex);
      h = hsl.h; s = hsl.s; l = hsl.l;
      lSlider.value = Math.round(l);
      drawDisc(canvas, l);
      moveCursor();
    }

    function pointToHs(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const dx = x - RADIUS, dy = y - RADIUS;
      const r = ColorUtils.clamp(Math.sqrt(dx * dx + dy * dy), 0, RADIUS);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      return { h: angleToHue(angleDeg), s: (r / RADIUS) * 100 };
    }

    let dragging = false;
    function handleMove(e) {
      if (!dragging) return;
      const hs = pointToHs(e.clientX, e.clientY);
      h = hs.h; s = hs.s;
      moveCursor();
      onChange(currentHex());
    }
    function handleUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      onCommit(currentHex());
    }
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      const hs = pointToHs(e.clientX, e.clientY);
      h = hs.h; s = hs.s;
      moveCursor();
      onChange(currentHex());
      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    });

    lSlider.addEventListener('input', () => {
      l = Number(lSlider.value);
      drawDisc(canvas, l);
      moveCursor();
      onChange(currentHex());
    });
    lSlider.addEventListener('change', () => {
      onCommit(currentHex());
    });

    setHex(options.initialHex || '#c9a876');

    return { setHex, getHex: currentHex };
  }

  global.ColorWheel = { create };
})(window);
