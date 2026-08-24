/* color.js — hex色コードのHSL/HSV変換ユーティリティ
 * 「カラー」はキャラクターデータに登録された値をそのまま使う。
 * ここでは表示座標を計算するために変換するだけで、色そのものを書き換えない。
 */
(function (global) {
  'use strict';

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function normalizeHex(hex) {
    if (!hex) return '#888888';
    let h = hex.trim();
    if (h[0] !== '#') h = '#' + h;
    if (h.length === 4) {
      h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return '#888888';
    return h.toLowerCase();
  }

  function hexToRgb(hex) {
    const h = normalizeHex(hex);
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return { r, g, b };
  }

  // HSL: h(0-360), s(0-100), l(0-100)
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r: h = 60 * (((g - b) / d) % 6); break;
        case g: h = 60 * ((b - r) / d + 2); break;
        case b: h = 60 * ((r - g) / d + 4); break;
      }
    }
    if (h < 0) h += 360;
    return { h, s: s * 100, l: l * 100 };
  }

  function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b);
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  function hslToHex(h, s, l) {
    const { r, g, b } = hslToRgb(h, s, l);
    return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
  }

  // 'rgb(255, 127, 0)' のようなCSS文字列を '#ff7f00' に変換する
  function rgbStringToHex(rgbStr) {
    if (!rgbStr) return null;
    const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;
    const toHex = (v) => clamp(parseInt(v, 10), 0, 255).toString(16).padStart(2, '0');
    return '#' + toHex(m[1]) + toHex(m[2]) + toHex(m[3]);
  }

  // 明度の高い/低い色でテキストの可読性を確保するためのコントラスト判定
  function isLight(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  }

  // 色相環(wheel.js)とカラーホイール(colorWheel.js)で共有する角度⇄色相の変換。
  // 0度(赤)を12時方向に置き、時計回りに色相が進む向きで揃えている。
  function hueToAngle(h) {
    return h - 90;
  }

  function angleToHue(angleDeg) {
    const h = angleDeg + 90;
    return ((h % 360) + 360) % 360;
  }

  global.ColorUtils = {
    clamp,
    normalizeHex,
    hexToRgb,
    rgbToHsl,
    hexToHsl,
    hslToRgb,
    hslToHex,
    rgbStringToHex,
    isLight,
    hueToAngle,
    angleToHue
  };
})(window);
