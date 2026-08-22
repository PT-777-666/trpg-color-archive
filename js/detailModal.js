/* detailModal.js — キャラクタークリック時の詳細表示。
 * 「いあきゃらで開く」から元のキャラクターシートへ遷移できるようにし、
 * ここから編集・削除も行えるようにする。
 */
(function (global) {
  'use strict';

  let overlayEl = null;
  let panelEl = null;
  let currentId = null;

  const ICON_EDIT = '<svg class="btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_DELETE = '<svg class="btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
  const ICON_EXTERNAL = '<svg class="btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';

  function fieldRow(label, value) {
    if (!value) return '';
    return `<div class="dm-row"><span class="dm-label">${label}</span><span class="dm-value">${Utils.escapeHtml(value)}</span></div>`;
  }

  function render(character) {
    const hex = ColorUtils.normalizeHex(character.color);
    const img = character.image || global.Avatar.placeholderDataUri(hex, character.name);
    const tags = (character.tags || [])
      .map((t) => `<span class="dm-tag">${Utils.escapeHtml(t)}</span>`)
      .join('');

    panelEl.style.setProperty('--dm-color', hex);
    panelEl.innerHTML = `
      <button type="button" class="dm-close" aria-label="閉じる">×</button>
      <div class="dm-content">
        <div class="dm-visual">
          <img class="dm-avatar" src="${img}" alt="" />
          <div class="dm-color-chip" title="${hex}">
            <span class="dm-color-swatch"></span>${hex}
          </div>
        </div>
        <div class="dm-info">
          <h2 class="dm-name">${Utils.escapeHtml(character.name || '無名のキャラクター')}</h2>
          <div class="dm-sub">${Utils.escapeHtml(character.system || '')}</div>
          <div class="dm-fields">
            ${fieldRow('シナリオ', character.scenario)}
            ${fieldRow('HO', character.ho)}
            ${fieldRow('年齢', character.age)}
            ${fieldRow('性別', character.gender)}
            ${fieldRow('身長', character.height)}
            ${fieldRow('職業', character.occupation)}
          </div>
          ${character.description ? `<p class="dm-desc">${Utils.escapeHtml(character.description)}</p>` : '<p class="dm-desc dm-desc-empty">紹介文は未登録です。</p>'}
          ${tags ? `<div class="dm-tags">${tags}</div>` : ''}
          <div class="dm-actions">
            ${character.iacharaUrl ? `<a class="btn btn-primary" href="${Utils.escapeHtml(character.iacharaUrl)}" target="_blank" rel="noopener noreferrer">${ICON_EXTERNAL}いあきゃらで開く</a>` : '<span class="dm-no-url">いあきゃらURL未登録</span>'}
            <button type="button" class="btn btn-ghost" data-action="edit">${ICON_EDIT}編集</button>
            <button type="button" class="btn btn-danger" data-action="delete">${ICON_DELETE}削除</button>
          </div>
        </div>
      </div>
    `;

    panelEl.querySelector('.dm-close').addEventListener('click', close);
    panelEl.querySelector('[data-action="edit"]').addEventListener('click', () => {
      close();
      global.CharacterForm.open(character.id);
    });
    panelEl.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`「${character.name || '無名のキャラクター'}」を削除しますか？この操作は取り消せません。`)) return;
      await DB.deleteCharacter(character.id);
      const chars = Store.get().characters.filter((c) => c.id !== character.id);
      Store.set({ characters: chars });
      close();
    });
  }

  function open(id) {
    const character = Store.get().characters.find((c) => c.id === id);
    if (!character) return;
    currentId = id;
    render(character);
    overlayEl.classList.add('dm-open');
    document.addEventListener('keydown', onKeydown);
  }

  function refreshIfOpen(id) {
    if (currentId === id && overlayEl.classList.contains('dm-open')) {
      const character = Store.get().characters.find((c) => c.id === id);
      if (character) render(character);
    }
  }

  function close() {
    overlayEl.classList.remove('dm-open');
    currentId = null;
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function mount() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'dm-overlay';
    overlayEl.innerHTML = '<div class="dm-panel"></div>';
    document.body.appendChild(overlayEl);
    panelEl = overlayEl.querySelector('.dm-panel');
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) close();
    });
  }

  global.DetailModal = { mount, open, close, refreshIfOpen };
})(window);
