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

    const wheelViewBtn = document.getElementById('btn-view-wheel');
    const listViewBtn = document.getElementById('btn-view-list');
    const wheelStage = document.getElementById('wheel-stage');
    const wheelMain = document.querySelector('.wheel-main');
    function setListActive(active) {
      wheelMain.classList.toggle('list-active', active);
      wheelStage.hidden = active;
      document.getElementById('list-view').hidden = !active;
      wheelViewBtn.classList.toggle('mode-btn-active', !active);
      listViewBtn.classList.toggle('mode-btn-active', active);
      if (active) {
        ListView.show();
      } else {
        ListView.hide();
        updateEmptyState();
        // 一覧表示中はwheel-stageがhidden(clientWidth=0)なので、その間に
        // タグ以外の編集(色など)があると600pxのフォールバック寸法で
        // レイアウトされてしまう。表示に戻すたびに正しい寸法で引き直す。
        Wheel.rebuild();
      }
    }
    wheelViewBtn.addEventListener('click', () => setListActive(false));
    listViewBtn.addEventListener('click', () => setListActive(true));
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
    const characters = Store.get().characters;
    const coloredCount = characters.filter((c) => c.color).length;
    const noneRegistered = characters.length === 0;
    const noneColored = !noneRegistered && coloredCount === 0;
    el.classList.toggle('is-visible', (noneRegistered || noneColored) && !Store.get().loading);
    if (noneColored) {
      el.querySelector('p').textContent = '登録済みのキャラクターに、カラーコードが設定されている子がいません。';
      el.querySelector('button').textContent = '一覧でカラーコードを設定する';
      el.querySelector('button').onclick = () => document.getElementById('btn-view-list').click();
    } else {
      el.querySelector('p').textContent = 'まだキャラクターが登録されていません。';
      el.querySelector('button').textContent = '最初のキャラクターを追加する';
      el.querySelector('button').onclick = () => CharacterForm.open(null);
    }
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
    ListView.mount(document.getElementById('list-view'));
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
