/* tagFilter.js — 上部のタグ一覧UI。
 * タグの意味はアプリ側で解釈せず、「このタグを持つキャラクターだけを表示する」
 * という絞り込み機能だけを提供する。
 */
(function (global) {
  'use strict';

  let rootEl = null;

  function countFor(tag) {
    return Store.get().characters.filter((c) => (c.tags || []).includes(tag)).length;
  }

  function render() {
    const state = Store.get();
    const tags = Store.allTags();
    const hasSelection = state.selectedTags.length > 0;

    const allChip = `
      <button type="button" class="tag-pill ${!hasSelection ? 'tag-pill-active' : ''}" data-tag="__ALL__">
        ALL
      </button>`;

    const chips = tags.map((tag) => {
      const active = state.selectedTags.includes(tag);
      return `<button type="button" class="tag-pill ${active ? 'tag-pill-active' : ''}" data-tag="${Utils.escapeHtml(tag)}">
        ${Utils.escapeHtml(tag)} <span class="tag-count">${countFor(tag)}</span>
      </button>`;
    }).join('');

    rootEl.innerHTML = `
      <div class="tag-bar-row">
        <div class="tag-bar-chips">${allChip}${chips || '<span class="tag-bar-empty">タグがまだありません</span>'}</div>
        <div class="tag-mode-toggle" role="group" aria-label="タグの絞り込み条件">
          <button type="button" class="mode-btn ${state.filterMode === 'AND' ? 'mode-btn-active' : ''}" data-mode="AND">AND</button>
          <button type="button" class="mode-btn ${state.filterMode === 'OR' ? 'mode-btn-active' : ''}" data-mode="OR">OR</button>
        </div>
      </div>
    `;

    rootEl.querySelectorAll('.tag-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (tag === '__ALL__') Store.clearTags();
        else Store.toggleTag(tag);
      });
    });
    rootEl.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => Store.setFilterMode(btn.dataset.mode));
    });
  }

  function mount(root) {
    rootEl = root;
    render();
    Store.subscribe(render);
  }

  global.TagFilter = { mount };
})(window);
