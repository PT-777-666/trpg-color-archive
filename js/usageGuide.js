/* usageGuide.js — 「使い方」ボタンを押すと開く、キャラクター登録から保存までの
 * 一連の流れを説明するモーダル。常時表示すると場所を取るため、必要な時だけ開く形にした。
 */
(function (global) {
  'use strict';

  let overlayEl = null;
  let panelEl = null;

  const STEPS = [
    {
      title: '① キャラクターを登録する',
      body: '「＋ 新規キャラクター」から追加します。名前とカラーコードは必須ですが、それ以外(シナリオ・タグ・画像など)は空欄でも大丈夫です。いあきゃらに登録済みのキャラクターなら「いあきゃらから読み込む」で、カラーや立ち絵などを自動入力できます。'
    },
    {
      title: '② 色相環で眺める',
      body: '登録したキャラクターは、カラーコードの色相・彩度に応じて色相環の上に並びます。カーソルを乗せると簡単な情報、クリックするとさらに詳しい情報が見られます。'
    },
    {
      title: '③ タグで絞り込む',
      body: '上のタグをクリックすると、そのタグを持つキャラクターだけが色相環に浮かび上がります。複数選んだときはAND/ORを切り替えられます。'
    },
    {
      title: '④ 一覧でまとめて編集する',
      body: '「📋 一覧」に切り替えると、タグ・カラーコード・画像などをまとめて編集できます。カラーコードはテキスト入力のほか、カラーホイールからも選べます。不要になったキャラクターの削除もここから行えます。'
    },
    {
      title: '⑤ 画像として保存する',
      body: '「色相環を画像で保存」で、今の色相環をPNG画像として書き出せます。「背景を透明にする」にチェックすると、背景が透明なPNGとして保存されます。'
    },
    {
      title: '⑥ バックアップを保存・復元する',
      body: 'データはこのブラウザにしか保存されないため、「バックアップを保存(JSON)」でこまめにファイルへ書き出しておくと安心です。別の環境に移すときや、万が一データが消えてしまったときは「バックアップから復元(JSON)」で読み込めます。'
    }
  ];

  function markup() {
    const steps = STEPS.map((s) => `
      <li class="ug-step">
        <h3 class="ug-step-title">${s.title}</h3>
        <p class="ug-step-body">${s.body}</p>
      </li>
    `).join('');
    return `
      <button type="button" class="ug-close" aria-label="閉じる">×</button>
      <h2 class="ug-title">使い方</h2>
      <p class="ug-lede">キャラクターの登録から画像として保存するまでの流れです。</p>
      <ol class="ug-steps">${steps}</ol>
    `;
  }

  function open() {
    overlayEl.classList.add('ug-open');
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    overlayEl.classList.remove('ug-open');
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function mount() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'ug-overlay';
    overlayEl.innerHTML = '<div class="ug-panel"></div>';
    document.body.appendChild(overlayEl);
    panelEl = overlayEl.querySelector('.ug-panel');
    panelEl.innerHTML = markup();
    panelEl.querySelector('.ug-close').addEventListener('click', close);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
  }

  global.UsageGuide = { mount, open, close };
})(window);
