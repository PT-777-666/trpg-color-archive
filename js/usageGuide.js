/* usageGuide.js — 「使い方を見る」ボタンを押すと直下に開くプルダウン形式の説明。
 * キャラクター登録から画像として保存するまでの一連の流れを、常時表示せず
 * 必要な時だけ開いて確認できるようにしたもの。
 */
(function (global) {
  'use strict';

  let btnEl = null;
  let panelEl = null;
  let isOpen = false;

  const STEPS = [
    {
      title: '① キャラクターを登録する',
      body: '「＋ 新規キャラクター」から追加します。いあきゃらに登録済みのキャラクターなら「いあきゃらから読み込む」で、カラーや立ち絵などを自動入力できます。登録したキャラクターは、カラーコードの色相・彩度に応じて色相環の上に並びます。カーソルを乗せると簡単な情報が表示され、クリックすると詳細な設定ができます。'
    },
    {
      title: '② タグ設定',
      body: '上のタグをクリックすると、そのタグを持つキャラクターだけが色相環に浮かび上がります。複数選んだときはAND/ORを切り替えられます。「📋 一覧」に切り替えると、タグ・カラーコード・画像などをまとめて編集できます。'
    },
    {
      title: '③ 画像として保存する',
      body: '「色相環を画像で保存」で、今の色相環をPNG画像として書き出せます。「背景を透明にする」にチェックすると、背景が透明なPNGとして保存されます。'
    },
    {
      title: '④ バックアップを保存・復元する',
      body: 'データはこのブラウザにしか保存されないため、「バックアップを保存(JSON)」でこまめにファイルへ書き出しておくと安心です。別の環境に移すときや、万が一データが消えてしまったときは「バックアップから復元(JSON)」で読み込めます。'
    }
  ];

  // 文章を「。」ごとに改行する(1文1行の方が読みやすいため)
  function breakSentences(text) {
    return text.replace(/。(?!$)/g, '。<br>');
  }

  function markup() {
    const steps = STEPS.map((s) => `
      <li class="ug-step">
        <h3 class="ug-step-title">${s.title}</h3>
        <p class="ug-step-body">${breakSentences(s.body)}</p>
      </li>
    `).join('');
    return `
      <p class="ug-lede">キャラクターの登録から画像として保存するまでの流れです。</p>
      <ol class="ug-steps">${steps}</ol>
    `;
  }

  function open() {
    isOpen = true;
    panelEl.hidden = false;
    btnEl.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutsideClick);
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    isOpen = false;
    panelEl.hidden = true;
    btnEl.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onKeydown);
  }

  function toggle() {
    if (isOpen) close(); else open();
  }

  function onOutsideClick(e) {
    if (!panelEl.contains(e.target) && e.target !== btnEl) close();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function mount() {
    btnEl = document.getElementById('btn-usage-guide');
    panelEl = document.getElementById('ug-dropdown');
    panelEl.innerHTML = markup();
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
  }

  global.UsageGuide = { mount, open, close, toggle };
})(window);
