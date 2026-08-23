/* hoverCard.js — キャラクターにカーソルを合わせた際の簡易情報カード。
 * 常に1枚だけ表示し、キャラクターの近くに自然に出るよう位置を調整する。
 */
(function (global) {
  'use strict';

  let cardEl = null;
  let activeId = null;
  let hideTimer = null;

  function fieldRow(label, value) {
    if (!value) return '';
    return `<div class="hc-row"><span class="hc-label">${label}</span><span class="hc-value">${Utils.escapeHtml(value)}</span></div>`;
  }

  function render(character) {
    const hex = ColorUtils.normalizeHex(character.color);
    const img = character.image || global.Avatar.placeholderDataUri(hex, character.name);
    const tags = (character.tags || [])
      .map((t) => `<span class="hc-tag">${Utils.escapeHtml(t)}</span>`)
      .join('');

    cardEl.style.setProperty('--hc-color', hex);
    cardEl.innerHTML = `
      <div class="hc-header">
        <img class="hc-avatar" src="${img}" alt="" />
        <div class="hc-heading">
          <div class="hc-name">${Utils.escapeHtml(character.name || '無名のキャラクター')}</div>
          <div class="hc-sub">${Utils.escapeHtml(character.system || '')}</div>
        </div>
      </div>
      <div class="hc-body">
        ${fieldRow('シナリオ', character.scenario)}
        ${fieldRow('HO', character.ho)}
        ${fieldRow('年齢', character.age)}
        ${fieldRow('職業', character.occupation)}
      </div>
      ${character.description ? `<p class="hc-desc">${Utils.escapeHtml(character.description)}</p>` : ''}
      ${tags ? `<div class="hc-tags">${tags}</div>` : ''}
      ${Utils.isTouchDevice() ? '<button type="button" class="hc-detail-btn">詳細を見る</button>' : ''}
    `;

    if (Utils.isTouchDevice()) {
      cardEl.querySelector('.hc-detail-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        global.DetailModal.open(character.id);
      });
    }
  }

  function position(anchorEl) {
    const stage = document.getElementById('wheel-stage');
    const stageRect = stage.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const anchorCx = anchorRect.left + anchorRect.width / 2;
    const anchorCy = anchorRect.top + anchorRect.height / 2;
    const stageCx = stageRect.left + stageRect.width / 2;
    const stageCy = stageRect.top + stageRect.height / 2;

    cardEl.style.visibility = 'hidden';
    cardEl.style.display = 'block';
    const cardRect = cardEl.getBoundingClientRect();

    const margin = 14;
    // 輪の中心からオーブへ向かう向きの延長線上(=輪の外側)にカードを出す。
    // 単純に「右優先、はみ出したら左」だと輪の左半分のオーブでは
    // 中心側にカードが出てしまうため、角度に応じた向きを都度計算する。
    let dx = anchorCx - stageCx;
    let dy = anchorCy - stageCy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) { dx = 0; dy = -1; } else { dx /= dist; dy /= dist; }

    const offset = anchorRect.width / 2 + margin + Math.max(cardRect.width, cardRect.height) / 2;
    let left = anchorCx + dx * offset - cardRect.width / 2;
    let top = anchorCy + dy * offset - cardRect.height / 2;

    // それでも画面外にはみ出す場合は収まる範囲にクランプする
    left = ColorUtils.clamp(left, 12, window.innerWidth - cardRect.width - 12);
    top = ColorUtils.clamp(top, 12, window.innerHeight - cardRect.height - 12);

    cardEl.style.left = `${left}px`;
    cardEl.style.top = `${top}px`;
    cardEl.style.visibility = 'visible';
  }

  function show(id, anchorEl) {
    clearTimeout(hideTimer);
    const character = Store.get().characters.find((c) => c.id === id);
    if (!character) return;
    activeId = id;
    render(character);
    position(anchorEl);
    requestAnimationFrame(() => cardEl.classList.add('hc-visible'));
  }

  function hide(id) {
    if (id && id !== activeId) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      cardEl.classList.remove('hc-visible');
      activeId = null;
      setTimeout(() => {
        if (!cardEl.classList.contains('hc-visible')) cardEl.style.display = 'none';
      }, 200);
    }, 90);
  }

  function hideAll() {
    clearTimeout(hideTimer);
    cardEl.classList.remove('hc-visible');
    activeId = null;
    cardEl.style.display = 'none';
  }

  function isShowing(id) {
    return activeId === id;
  }

  function mount() {
    cardEl = document.createElement('div');
    cardEl.className = 'hover-card';
    cardEl.style.display = 'none';
    document.body.appendChild(cardEl);
    cardEl.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    cardEl.addEventListener('mouseleave', () => hide(activeId));
  }

  global.HoverCard = { mount, show, hide, hideAll, isShowing };
})(window);
