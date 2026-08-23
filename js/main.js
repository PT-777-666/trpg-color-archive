/* main.js — アプリの起動処理。各モジュールをマウントし、
 * IndexedDBからキャラクターを読み込む(初回はサンプルデータを投入)。
 */
(function () {
  'use strict';

  async function loadInitialData() {
    let characters = await DB.getAllCharacters();
    const seeded = await DB.getMeta('seeded');
    if (!seeded && characters.length === 0) {
      await DB.putCharacters(SAMPLE_CHARACTERS);
      await DB.setMeta('seeded', true);
      characters = SAMPLE_CHARACTERS.slice();
    }
    Store.set({ characters, loading: false });
  }

  function wireHeaderActions() {
    document.getElementById('btn-add-character').addEventListener('click', () => {
      CharacterForm.open(null);
    });
    document.getElementById('btn-export').addEventListener('click', () => {
      ImportExport.exportJson();
    });
    document.getElementById('btn-save-image').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const label = document.getElementById('btn-save-image-label');
      const original = label.textContent;
      btn.disabled = true;
      label.textContent = '画像を作成中…';
      try {
        await Wheel.exportImage();
      } finally {
        btn.disabled = false;
        label.textContent = original;
      }
    });
    const importInput = document.getElementById('import-file-input');
    document.getElementById('btn-import').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) await ImportExport.importFromFile(file);
      importInput.value = '';
    });
    document.getElementById('btn-delete-all').addEventListener('click', async () => {
      const count = Store.get().characters.length;
      if (count === 0) {
        alert('削除するキャラクターがありません。');
        return;
      }
      if (!confirm(`登録済みの${count}人を全て削除します。この操作は取り消せません。\n先にJSONエクスポートでバックアップすることをおすすめします。\n\n本当に削除しますか？`)) return;
      if (!confirm('最終確認です。本当に全キャラクターを削除しますか？')) return;
      await DB.clearCharacters();
      Store.set({ characters: [], selectedTags: [] });
    });
  }

  function renderThemeSwitcher() {
    const el = document.getElementById('theme-switcher');
    const current = ThemeManager.getTheme();
    el.innerHTML = Object.keys(ThemeManager.THEMES).map((key) => {
      const active = key === current ? ' theme-btn-active' : '';
      return `<button type="button" class="theme-btn${active}" data-theme-choice="${key}">${ThemeManager.THEMES[key].label}</button>`;
    }).join('');
    el.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => ThemeManager.setTheme(btn.dataset.themeChoice));
    });
  }

  function updateEmptyState() {
    const el = document.getElementById('empty-state');
    const count = Store.get().characters.length;
    el.classList.toggle('is-visible', count === 0 && !Store.get().loading);
  }

  function updateStatsBar() {
    const el = document.getElementById('stats-bar');
    const state = Store.get();
    const total = state.characters.length;
    const visible = Store.filteredCharacters().length;
    if (state.selectedTags.length === 0) {
      el.textContent = `${total}人のキャラクターを登録`;
    } else {
      el.textContent = `${visible} / ${total}人が「${state.selectedTags.join(' + ')}」(${state.filterMode})に該当`;
    }
  }

  async function init() {
    HoverCard.mount();
    DetailModal.mount();
    CharacterForm.mount();
    BulkImport.mount();
    Wheel.mount(document.getElementById('wheel-stage'));
    TagFilter.mount(document.getElementById('tag-bar'));
    wireHeaderActions();
    renderThemeSwitcher();
    document.addEventListener('themechange', renderThemeSwitcher);

    Store.subscribe(() => {
      updateEmptyState();
      updateStatsBar();
    });

    await loadInitialData();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
