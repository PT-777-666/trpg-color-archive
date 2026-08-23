/* listView.js — 登録済み全キャラクターをリスト表示し、タグ付けをまとめて行いやすくする画面。
 * 色相環の代わりに表示するトグル形式。タグ・画像・カラーコードの変更は都度DBへ即保存する
 * (フォームのような「保存」操作は挟まない)。タグの絞り込み状態には影響されず、
 * 常に登録済み全員を表示する(タグが付いていない子も見失わないため)。
 * 並び順は色相環と揃う「色順」と、探しやすい「名前順」を切り替えられる。
 * 各行の▾を押すと、シナリオ・HO・年齢・職業・性別・身長・紹介文を
 * その場で開いて編集できる(展開状態はexpandedIdsで保持し、再描画をまたいで残す)。
 */
(function (global) {
  'use strict';

  let containerEl = null;
  let lastFocused = null; // { charId, field: 'tag' | 'color' }
  let sortMode = 'hue'; // 'hue' | 'name'
  let expandedIds = new Set();
  let paletteOpenIds = new Set();

  const ICON_DELETE = '<svg class="btn-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

  function tagChipHtml(tag, charId) {
    return `<span class="tag-chip" data-tag="${Utils.escapeHtml(tag)}">${Utils.escapeHtml(tag)}<button type="button" class="tag-chip-remove" data-char="${charId}" data-tag="${Utils.escapeHtml(tag)}" aria-label="削除">×</button></span>`;
  }

  function detailFieldHtml(c, label, field) {
    return `
      <div class="lv-detail-field">
        <label class="lv-detail-label">${label}</label>
        <input type="text" class="lv-detail-input" data-id="${c.id}" data-field="${field}" value="${Utils.escapeHtml(c[field] || '')}" />
      </div>
    `;
  }

  function detailHtml(c) {
    return `
      <div class="lv-detail">
        <div class="lv-detail-grid">
          ${detailFieldHtml(c, 'シナリオ', 'scenario')}
          ${detailFieldHtml(c, 'HO', 'ho')}
          ${detailFieldHtml(c, '年齢', 'age')}
          ${detailFieldHtml(c, '職業', 'occupation')}
          ${detailFieldHtml(c, '性別', 'gender')}
          ${detailFieldHtml(c, '身長', 'height')}
        </div>
        <div class="lv-detail-field lv-detail-field-full">
          <label class="lv-detail-label">紹介文</label>
          <textarea class="lv-detail-input" data-id="${c.id}" data-field="description" rows="2">${Utils.escapeHtml(c.description || '')}</textarea>
        </div>
      </div>
    `;
  }

  function paletteHtml(c) {
    return `
      <div class="lv-palette">
        ${ColorUtils.PALETTE.map((hex) => `<button type="button" class="lv-palette-swatch" data-id="${c.id}" data-hex="${hex}" style="background:${hex}" title="${hex}" aria-label="${hex}を選択"></button>`).join('')}
      </div>
    `;
  }

  async function persistUpdate(character, patch) {
    const updated = Object.assign({}, character, patch, { updatedAt: new Date().toISOString() });
    await DB.putCharacter(updated);
    const chars = Store.get().characters.slice();
    const idx = chars.findIndex((c) => c.id === character.id);
    if (idx !== -1) chars[idx] = updated;
    Store.set({ characters: chars });
  }

  // 色相環の並びと揃うよう、色相(H)の昇順で並べる(0度=赤が先頭、時計回りの順)
  function byHue(characters) {
    return characters.slice().sort((a, b) => ColorUtils.hexToHsl(a.color).h - ColorUtils.hexToHsl(b.color).h);
  }

  function byName(characters) {
    return characters.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
  }

  function sortToggleHtml() {
    return `
      <div class="tag-mode-toggle lv-sort-toggle">
        <button type="button" class="mode-btn${sortMode === 'hue' ? ' mode-btn-active' : ''}" data-sort="hue">色順</button>
        <button type="button" class="mode-btn${sortMode === 'name' ? ' mode-btn-active' : ''}" data-sort="name">名前順</button>
      </div>
    `;
  }

  function rowHtml(c) {
    const hex = ColorUtils.normalizeHex(c.color || '#c9a876');
    const img = c.image || global.Avatar.placeholderDataUri(hex, c.name);
    const tags = c.tags || [];
    const sub = [c.occupation, c.system].filter(Boolean).join(' / ');
    const expanded = expandedIds.has(c.id);
    const paletteOpen = paletteOpenIds.has(c.id);
    return `
      <div class="lv-row${c.color ? ' lv-row-colored' : ''}" data-id="${c.id}" style="--row-color:${hex}">
        <button type="button" class="lv-expand-toggle${expanded ? ' lv-expand-toggle-open' : ''}" data-id="${c.id}" aria-label="詳細を開閉" aria-expanded="${expanded}"><span class="lv-expand-toggle-label">詳細</span><span class="lv-expand-toggle-arrow" aria-hidden="true">▾</span></button>
        <label class="lv-avatar-wrap" title="クリックして画像を変更">
          <img class="lv-avatar" src="${img}" alt="" style="--orb-color:${hex}" />
          <span class="lv-avatar-edit-badge" aria-hidden="true">✎</span>
          <input type="file" accept="image/*" class="lv-image-input" data-id="${c.id}" hidden />
        </label>
        <div class="lv-info">
          <div class="lv-name">${Utils.escapeHtml(c.name || '無名のキャラクター')}</div>
          <div class="lv-sub">${Utils.escapeHtml(sub)}</div>
          <div class="lv-color-row">
            <input type="text" class="lv-color-input" value="${c.color ? hex : ''}" placeholder="未設定" maxlength="7" data-id="${c.id}" title="カラーコード" />
            ${c.color ? `<button type="button" class="lv-color-clear" data-id="${c.id}" title="カラーコードを消す" aria-label="カラーコードを消す">×</button>` : ''}
            <button type="button" class="lv-palette-toggle${paletteOpen ? ' lv-palette-toggle-open' : ''}" data-id="${c.id}" title="パレットから選ぶ" aria-label="パレットから選ぶ">🎨</button>
          </div>
        </div>
        <div class="lv-tags-col">
          ${tags.map((t) => tagChipHtml(t, c.id)).join('')}
          <input type="text" class="lv-tag-input" list="lv-tag-suggestions" placeholder="タグを入力してEnter" data-id="${c.id}" />
        </div>
        <button type="button" class="lv-delete-btn" data-id="${c.id}" data-name="${Utils.escapeHtml(c.name || '無名のキャラクター')}" title="このキャラクターを削除" aria-label="削除">${ICON_DELETE}</button>
        ${paletteOpen ? paletteHtml(c) : ''}
        ${expanded ? detailHtml(c) : ''}
      </div>
    `;
  }

  function render() {
    if (!containerEl || containerEl.hidden) return;
    const all = Store.get().characters;

    if (all.length === 0) {
      containerEl.innerHTML = '<p class="lv-empty">まだキャラクターが登録されていません。</p>';
      return;
    }

    // カラーコード未設定の子は色相環上でも位置が定まらないので、別枠にまとめて
    // 見つけやすくする(彩度0の灰色として中心付近に埋もれがちなため)。
    const noColor = all.filter((c) => !c.color);
    const withColor = all.filter((c) => c.color);
    const sorted = sortMode === 'name' ? byName(withColor) : byHue(withColor);
    const suggestions = Store.allTags();
    containerEl.innerHTML = `
      ${sortToggleHtml()}
      <datalist id="lv-tag-suggestions">${suggestions.map((t) => `<option value="${Utils.escapeHtml(t)}"></option>`).join('')}</datalist>
      ${noColor.length > 0 ? `
        <p class="lv-section-label lv-section-label-warn">⚠ カラー未設定(${noColor.length}人)</p>
        ${noColor.map(rowHtml).join('')}
        <p class="lv-section-label">カラー設定済み</p>
      ` : ''}
      ${sorted.map(rowHtml).join('')}
    `;

    containerEl.querySelectorAll('.lv-expand-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
        render();
      });
    });

    containerEl.querySelectorAll('.lv-sort-toggle .mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.sort === sortMode) return;
        sortMode = btn.dataset.sort;
        render();
      });
    });

    containerEl.querySelectorAll('.tag-chip-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const character = Store.get().characters.find((c) => c.id === btn.dataset.char);
        if (!character) return;
        const nextTags = (character.tags || []).filter((t) => t !== btn.dataset.tag);
        await persistUpdate(character, { tags: nextTags });
      });
    });

    containerEl.querySelectorAll('.lv-tag-input').forEach((input) => {
      input.addEventListener('focus', () => { lastFocused = { charId: input.dataset.id, field: 'tag' }; });
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
        await persistUpdate(character, { tags: nextTags });
      });
    });

    containerEl.querySelectorAll('.lv-color-input').forEach((input) => {
      input.addEventListener('focus', () => { lastFocused = { charId: input.dataset.id, field: 'color' }; });
      const commit = async () => {
        const character = Store.get().characters.find((c) => c.id === input.dataset.id);
        if (!character) return;
        // 空欄でblurした場合はグレーに正規化せず、未設定のまま消す
        const hex = input.value.trim() === '' ? '' : ColorUtils.normalizeHex(input.value);
        if (hex === (character.color || '')) return;
        await persistUpdate(character, { color: hex });
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      });
    });

    containerEl.querySelectorAll('.lv-color-clear').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const character = Store.get().characters.find((c) => c.id === btn.dataset.id);
        if (!character) return;
        await persistUpdate(character, { color: '' });
      });
    });

    containerEl.querySelectorAll('.lv-palette-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (paletteOpenIds.has(id)) paletteOpenIds.delete(id); else paletteOpenIds.add(id);
        render();
      });
    });

    containerEl.querySelectorAll('.lv-palette-swatch').forEach((swatch) => {
      swatch.addEventListener('click', async () => {
        const character = Store.get().characters.find((c) => c.id === swatch.dataset.id);
        if (!character) return;
        await persistUpdate(character, { color: swatch.dataset.hex });
      });
    });

    containerEl.querySelectorAll('.lv-detail-input').forEach((input) => {
      const field = input.dataset.field;
      input.addEventListener('focus', () => { lastFocused = { charId: input.dataset.id, field }; });
      const commit = async () => {
        const character = Store.get().characters.find((c) => c.id === input.dataset.id);
        if (!character) return;
        const value = input.value.trim();
        if (value === (character[field] || '')) return;
        await persistUpdate(character, { [field]: value });
      };
      input.addEventListener('blur', commit);
      if (input.tagName === 'INPUT') {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
      }
    });

    containerEl.querySelectorAll('.lv-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(`「${btn.dataset.name}」を削除しますか？この操作は取り消せません。`)) return;
        await DB.deleteCharacter(btn.dataset.id);
        expandedIds.delete(btn.dataset.id);
        const chars = Store.get().characters.filter((c) => c.id !== btn.dataset.id);
        Store.set({ characters: chars });
      });
    });

    containerEl.querySelectorAll('.lv-image-input').forEach((input) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const character = Store.get().characters.find((c) => c.id === input.dataset.id);
        if (!character) return;
        const dataUrl = await Utils.readFileAsDataUrl(file);
        await persistUpdate(character, { image: dataUrl });
      });
    });

    // 変更後の再描画で同じ行の入力欄にフォーカスを戻し、
    // 1人にまとめて入力する流れが途切れないようにする(タグ欄・カラー欄・詳細欄それぞれ)
    if (lastFocused) {
      let selector;
      if (lastFocused.field === 'color') selector = '.lv-color-input';
      else if (lastFocused.field === 'tag') selector = '.lv-tag-input';
      else selector = `.lv-detail-input[data-field="${lastFocused.field}"]`;
      const input = containerEl.querySelector(`${selector}[data-id="${lastFocused.charId}"]`);
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
