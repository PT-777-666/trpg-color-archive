/* theme.js — デザインパターン(テーマ)の切り替え・保存。
 * CSS側は :root[data-theme="..."] でトークンを丸ごと差し替える方式。
 * ここではテーマの一覧・現在値・切り替え・永続化と、
 * Canvas書き出し(wheel.js)など、CSSだけでは完結しない箇所のための
 * 色の一覧を提供する。
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'trpg-character-archive:theme';
  const DEFAULT_THEME = 'clay';

  // Canvas書き出しなど、CSSのcomputed styleを都度読みに行くと重い/複雑になる
  // 箇所のために、テーマごとの値をここにも保持しておく。
  // 数値はCSS側の :root / [data-theme="..."] の値と揃えること。
  const THEMES = {
    clay: {
      label: 'クレイ',
      wheelSat: 77,
      wheelLight: 71,
      bgVoid: '#faf6ef',
      textPrimary: '#3d362c',
      accentText: '#906130',
      textFaint: '#8f8371'
    },
    makeup: {
      label: 'メイクパレット',
      wheelSat: 85,
      wheelLight: 52,
      bgVoid: '#1e1a16',
      textPrimary: '#f3ece3',
      accentText: '#f3c9c2',
      textFaint: '#9c8b7a'
    }
  };

  function getTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES[saved] ? saved : DEFAULT_THEME;
  }

  function getThemeColors(name) {
    return THEMES[name || getTheme()] || THEMES[DEFAULT_THEME];
  }

  function applyTheme(name) {
    const theme = THEMES[name] ? name : DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', theme);
  }

  function setTheme(name) {
    const theme = THEMES[name] ? name : DEFAULT_THEME;
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  // 初期表示のちらつき(一瞬デフォルトテーマが見えてから切り替わる)を防ぐため、
  // 他のスクリプトより先に、できるだけ早く適用しておく。
  applyTheme(getTheme());

  global.ThemeManager = { THEMES, getTheme, getThemeColors, setTheme };
})(window);
