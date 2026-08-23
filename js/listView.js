/* listView.js — 登録済み全キャラクターをリスト表示し、タグ付けをまとめて行いやすくする画面。
 * 色相環の代わりに表示するトグル形式。タグの追加・削除は都度DBへ即保存する
 * (フォームのような「保存」操作は挟まない)。タグの絞り込み状態には影響されず、
 * 常に登録済み全員を表示する(タグが付いていない子も見失わないため)。
 */
(function (global) {
  'use strict';

  let containerEl = null;
  let lastFocusedCharId = null;

  function tagChipHtml(tag, charId) {
    return `<span class="tag-chip" data-tag="${Utils.escapeHtml(tag)}">${Utils.escapeHtml(tag)}<button type="button" class="tag-chip-remove" data-char="${charId}" data-tag="${Utils.escapeHtml(tag)}" aria-label="削除">×</button></span>`;
  }

  async function persistTags(character, tags) {
    const updated = Object.assign({}, character, { tags, updatedAt: new Date().toISOString() });
    await DB.putCharacter(updated);
    const chars = Store.get().characters.slice();
    const idx = chars.findIndex((c) => c.id === character.id);
    if (idx !== -1) chars[idx] = updated;
    Store.set({ characters: chars });
  }

  function render() {
    if (!containerEl || containerEl.hidden) return;
    const characters = Store.get().characters;

    if (characters.length === 0) {
      containerEl.innerHTML = '<p class="lv-empty">まだキャラクターが登録されていません。</p>';
      return;
    }

    const suggestions = Store.allTags();
    containerEl.innerHTML = `
      <datalist id="lv-tag-suggestions">${suggestions.map((t) => `<option value="${Utils.escapeHtml(t)}"></option>`).join('')}</datalist>
      ${characters.map((c) => {
        const hex = ColorUtils.normalizeHex(c.color || '#c9a876');
        const img = c.image || global.Avatar.placeholderDataUri(hex, c.name);
        const tags = c.tags || [];
        const sub = [c.occupation, c.system].filter(Boolean).join(' / ');
        return `
          <div class="lv-row" data-id="${c.id}">
            <img class="lv-avatar" src="${img}" alt="" style="--orb-color:${hex}" />
            <div class="lv-info">
              <div class="lv-name">${Utils.escapeHtml(c.name || '無名のキャラクター')}</div>
              <div class="lv-sub">${Utils.escapeHtml(sub)}</div>
            </div>
            <div class="lv-tags-col">
              ${tags.map((t) => tagChipHtml(t, c.id)).join('')}
              <input type="text" class="lv-tag-input" list="lv-tag-suggestions" placeholder="タグを入力してEnter" data-id="${c.id}" />
            </div>
          </div>
        `;
      }).join('')}
    `;

    containerEl.querySelectorAll('.tag-chip-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const character = Store.get().characters.find((c) => c.id === btn.dataset.char);
        if (!character) return;
        const nextTags = (character.tags || []).filter((t) => t !== btn.dataset.tag);
        await persistTags(character, nextTags);
      });
    });

    containerEl.querySelectorAll('.lv-tag-input').forEach((input) => {
      input.addEventListener('focus', () => { lastFocusedCharId = input.dataset.id; });
      input.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const raw = input.value.trim();
        if (!raw) return;
        const character = Store.get().characters.find((c) => c.id === input.dataset.id);
        if (!character) return;
        const nextTags = (character.tags || []).slice();
        raw.split(/[,、]/).map((s) => s.trim()).filter(Boolean).forEach((tag) => {
          if (!nextTags.includes(tag)) nextTags.push(tag);
        });
        await persistTags(character, nextTags);
      });
    });

    // タグ追加/削除後の再描画で同じ行の入力欄にフォーカスを戻し、
    // 1人にまとめてタグを打ち込む流れが途切れないようにする
    if (lastFocusedCharId) {
      const input = containerEl.querySelector(`.lv-tag-input[data-id="${lastFocusedCharId}"]`);
      if (input) input.focus();
    }
  }

  function show() {
    containerEl.hidden = false;
    render();
  }

  function hide() {
    containerEl.hidden = true;
  }

  function isVisible() {
    return !!containerEl && !containerEl.hidden;
  }

  function mount(container) {
    containerEl = container;
    Store.subscribe(() => render());
  }

  global.ListView = { mount, show, hide, isVisible };
})(window);
