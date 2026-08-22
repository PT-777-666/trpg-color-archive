/* avatar.js — 立ち絵/アイコンが未設定のキャラクター用に、
 * 登録カラーを使ったシンプルなプレースホルダー画像(SVG)を生成する。
 */
(function (global) {
  'use strict';

  function initialOf(name) {
    if (!name) return '?';
    const trimmed = name.trim();
    return trimmed.charAt(0);
  }

  // ベタ塗りのシンプルなプレースホルダー。登録されているカラーコードを
  // そのままメインの塗りに使う(トーンを落とした加工はしない)。
  function placeholderDataUri(color, name) {
    const hex = ColorUtils.normalizeHex(color);
    const textColor = ColorUtils.isLight(hex) ? '#4a4030' : '#faf6ef';
    const letter = initialOf(name).replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" fill="${hex}"/>
      <text x="60" y="76" font-family="'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif" font-weight="700" font-size="50" text-anchor="middle" fill="${textColor}">${letter}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }

  global.Avatar = { placeholderDataUri };
})(window);
