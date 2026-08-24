/* bulkImport.js — いあきゃらから複数人をまとめて登録する画面。
 *
 * 1人ずつ「＋新規キャラクター」フォームを開閉する手間を減らすため、
 * 「貼り付け→リストに追加」を人数ぶん繰り返してから、
 * タグ付けだけまとめて行い、最後に一括保存する。
 * 名前・カラー・立ち絵などはiacharaSync.jsの解析結果をそのまま使い、
 * このリスト上での入力はタグだけに絞っている
 * (シナリオ・HOなど細かい項目は、保存後に個別編集で足す想定)。
 */
(function (global) {
  'use strict';

  let overlayEl = null;
  let panelEl = null;
  let staged = []; // { id, name, image, color, occupation, age, gender, height, iacharaUrl, description, tags }

  function renderList() {
    const listEl = panelEl.querySelector('#bi-list');
    const countEl = panelEl.querySelector('#bi-count');
    countEl.textContent = `${staged.length}件を保存待ち`;
    panelEl.querySelector('#bi-save').disabled = staged.length === 0;

    if (staged.length === 0) {
      listEl.innerHTML = '<p class="bi-empty">まだリストに追加されたキャラクターがいません。</p>';
      return;
    }

    listEl.innerHTML = staged.map((c) => {
      const hex = ColorUtils.normalizeHex(c.color || '#c9a876');
      const img = c.image || global.Avatar.placeholderDataUri(hex, c.name);
      return `
        <div class="bi-row" data-id="${c.id}">
          <img class="bi-avatar" src="${Utils.escapeHtml(img)}" alt="" style="--orb-color:${hex}" />
          <div class="bi-info">
            <div class="bi-name">${Utils.escapeHtml(c.name || '無名のキャラクター')}</div>
            <div class="bi-sub">${Utils.escapeHtml(c.occupation || '')}${c.occupation && c.age ? ' / ' : ''}${Utils.escapeHtml(c.age || '')}</div>
          </div>
          <input type="text" class="bi-tag-input" placeholder="タグ(カンマ区切り)" value="${Utils.escapeHtml((c.tags || []).join(', '))}" data-id="${c.id}" />
          <button type="button" class="bi-remove" data-id="${c.id}" aria-label="リストから削除">×</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.bi-tag-input').forEach((input) => {
      input.addEventListener('input', () => {
        const c = staged.find((x) => x.id === input.dataset.id);
        if (!c) return;
        c.tags = input.value.split(/[,、]/).map((s) => s.trim()).filter(Boolean);
      });
    });
    listEl.querySelectorAll('.bi-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        staged = staged.filter((x) => x.id !== btn.dataset.id);
        renderList();
      });
    });
  }

  function addFromPaste() {
    const textarea = panelEl.querySelector('#bi-paste');
    const raw = textarea.value.trim();
    if (!raw) return;

    let payloads;
    try {
      const parsed = JSON.parse(raw);
      payloads = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      alert('JSONとして読み取れませんでした。ブックマークレットでコピーした内容をそのまま貼り付けてください。');
      return;
    }

    let added = 0;
    payloads.forEach((payload) => {
      let imported;
      try {
        imported = global.IacharaSync.parseIacharaExport(JSON.stringify(payload));
      } catch (e) {
        return;
      }
      staged.push({
        id: Utils.uuid(),
        name: imported.name || '',
        image: imported.image || '',
        color: imported.color || '#c9a876',
        occupation: imported.occupation || '',
        age: imported.age || '',
        gender: imported.gender || '',
        height: imported.height || '',
        iacharaUrl: imported.iacharaUrl || '',
        description: imported.extraInfo || '',
        tags: []
      });
      added += 1;
    });

    if (added === 0) {
      alert('追加できるキャラクターが見つかりませんでした。');
      return;
    }
    textarea.value = '';
    renderList();
  }

  let saving = false;

  async function saveAll() {
    if (staged.length === 0 || saving) return;
    saving = true;
    panelEl.querySelector('#bi-save').disabled = true;
    try {
      await saveAllInner();
    } finally {
      saving = false;
    }
  }

  async function saveAllInner() {
    const now = new Date().toISOString();
    const characters = staged.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      color: ColorUtils.normalizeHex(c.color),
      system: '',
      scenario: '',
      ho: '',
      age: c.age,
      gender: c.gender,
      height: c.height,
      occupation: c.occupation,
      description: c.description,
      tags: c.tags,
      iacharaUrl: c.iacharaUrl,
      source: 'iachara',
      createdAt: now,
      updatedAt: now
    }));

    await DB.putCharacters(characters);
    const current = Store.get().characters.slice();
    characters.forEach((c) => current.push(c));
    Store.set({ characters: current });

    const count = staged.length;
    staged = [];
    renderList();
    close();
    alert(`${count}人を登録しました。シナリオ・HOなど細かい項目は、必要ならキャラクターごとに編集してください。`);
  }

  function open() {
    overlayEl.classList.add('bi-open');
    const bookmarkletLink = panelEl.querySelector('#bi-bookmarklet');
    bookmarkletLink.setAttribute('href', global.IacharaSync.bookmarkletHref());
    renderList();
  }

  function close() {
    overlayEl.classList.remove('bi-open');
  }

  function markup() {
    return `
      <button type="button" class="bi-close" aria-label="閉じる">×</button>
      <h2>いあきゃらから一括登録</h2>
      <p class="cf-hint">
        1. 下のボタンをブラウザのブックマークバーにドラッグして登録してください。<br>
        2. いあきゃらのキャラクターシートページを開いた状態でそのブックマークをクリックし、コピーされたJSONを下に貼り付けて「リストに追加」してください。<br>
        3. これを人数ぶん繰り返してから、タグだけ付けて「まとめて保存」してください。<br>
        ※ システム・シナリオ・HOなどは登録後に個別編集で足してください。
      </p>
      <a href="#" id="bi-bookmarklet" class="btn btn-primary btn-small" title="ブックマークバーにドラッグしてください">📥 いあきゃら取り込み</a>
      <div class="bi-paste-row">
        <textarea id="bi-paste" rows="4" placeholder="ここにコピーしたJSONを貼り付け"></textarea>
        <button type="button" id="bi-add" class="btn btn-ghost">リストに追加</button>
      </div>
      <div id="bi-list" class="bi-list"></div>
      <div class="bi-footer">
        <span id="bi-count" class="bi-count">0件を保存待ち</span>
        <div class="bi-footer-actions">
          <button type="button" id="bi-cancel" class="btn btn-ghost">閉じる</button>
          <button type="button" id="bi-save" class="btn btn-primary" disabled>まとめて保存</button>
        </div>
      </div>
    `;
  }

  function mount() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'bi-overlay';
    overlayEl.innerHTML = '<div class="bi-panel"></div>';
    document.body.appendChild(overlayEl);
    panelEl = overlayEl.querySelector('.bi-panel');
    panelEl.innerHTML = markup();

    panelEl.querySelector('.bi-close').addEventListener('click', close);
    panelEl.querySelector('#bi-cancel').addEventListener('click', close);
    panelEl.querySelector('#bi-add').addEventListener('click', addFromPaste);
    panelEl.querySelector('#bi-save').addEventListener('click', saveAll);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });

    panelEl.querySelector('#bi-bookmarklet').addEventListener('click', (e) => {
      e.preventDefault();
      alert('このボタンはクリックではなく、ブックマークバーへドラッグして登録してください。');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayEl.classList.contains('bi-open')) close();
    });
  }

  global.BulkImport = { mount, open, close };
})(window);
