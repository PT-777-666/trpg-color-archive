/* characterForm.js — 新規追加・編集モーダル。
 * カラーはカラーピッカー(+16進入力)、タグは自由入力＋既存タグ候補。
 * 画像はファイル選択でbase64化し、キャラクターレコードに直接埋め込む
 * （JSONエクスポート時にそのままバックアップされるようにするため）。
 */
(function (global) {
  'use strict';

  const EMPTY = {
    id: '', name: '', image: '', color: '#c9a876', system: '', scenario: '',
    ho: '', age: '', gender: '', height: '', occupation: '', description: '', tags: [], iacharaUrl: ''
  };

  const SYSTEM_PRESETS = [
    'クトゥルフ神話TRPG 6版',
    'クトゥルフ神話TRPG 7版',
    'シノビガミ',
    'インセイン',
    'エモクロアTRPG',
    'マレウス・モンストロルム',
    'ダブルクロス The 3rd Edition',
    'ソード・ワールド2.5'
  ];

  let overlayEl = null;
  let formEl = null;
  let editingId = null;
  let draftTags = [];
  let draftImage = '';
  let colorWheel = null;

  function tagChipHtml(tag) {
    return `<span class="tag-chip" data-tag="${Utils.escapeHtml(tag)}">${Utils.escapeHtml(tag)}<button type="button" class="tag-chip-remove" aria-label="削除">×</button></span>`;
  }

  function renderTagChips() {
    const wrap = formEl.querySelector('#cf-tag-chips');
    wrap.innerHTML = draftTags.map(tagChipHtml).join('');
    wrap.querySelectorAll('.tag-chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.parentElement.dataset.tag;
        draftTags = draftTags.filter((t) => t !== tag);
        renderTagChips();
      });
    });
  }

  function addTagFromInput() {
    const input = formEl.querySelector('#cf-tag-input');
    const raw = input.value.trim();
    if (!raw) return;
    raw.split(/[,、]/).map((s) => s.trim()).filter(Boolean).forEach((tag) => {
      if (!draftTags.includes(tag)) draftTags.push(tag);
    });
    input.value = '';
    renderTagChips();
  }

  function renderImagePreview() {
    const preview = formEl.querySelector('#cf-image-preview');
    if (draftImage) {
      preview.innerHTML = `<img src="${Utils.escapeHtml(draftImage)}" alt="プレビュー" />`;
    } else {
      preview.innerHTML = `<div class="cf-image-empty">画像未設定<br><small>カラーからプレースホルダーを生成します</small></div>`;
    }
  }

  function updateColorPreview() {
    const hex = ColorUtils.normalizeHex(formEl.querySelector('#cf-color-hex').value);
    formEl.querySelector('#cf-color-preview').style.background = hex;
  }

  function setSystemValue(value) {
    const select = formEl.querySelector('#cf-system-select');
    const other = formEl.querySelector('#cf-system-other');
    if (SYSTEM_PRESETS.includes(value)) {
      select.value = value;
      other.hidden = true;
      other.value = '';
    } else {
      select.value = '__other__';
      other.hidden = false;
      other.value = value;
    }
  }

  function getSystemValue() {
    const select = formEl.querySelector('#cf-system-select');
    const other = formEl.querySelector('#cf-system-other');
    return select.value === '__other__' ? other.value.trim() : select.value;
  }

  function renderTagDatalist() {
    const list = formEl.querySelector('#cf-tag-suggestions');
    list.innerHTML = Store.allTags().map((t) => `<option value="${Utils.escapeHtml(t)}"></option>`).join('');
  }

  function fillForm(character) {
    formEl.querySelector('#cf-name').value = character.name || '';
    formEl.querySelector('#cf-color-hex').value = ColorUtils.normalizeHex(character.color || EMPTY.color);
    setSystemValue(character.system || '');
    formEl.querySelector('#cf-scenario').value = character.scenario || '';
    formEl.querySelector('#cf-ho').value = character.ho || '';
    formEl.querySelector('#cf-age').value = character.age || '';
    formEl.querySelector('#cf-gender').value = character.gender || '';
    formEl.querySelector('#cf-height').value = character.height || '';
    formEl.querySelector('#cf-occupation').value = character.occupation || '';
    formEl.querySelector('#cf-description').value = character.description || '';
    formEl.querySelector('#cf-iachara-url').value = character.iacharaUrl || '';
    draftTags = [...(character.tags || [])];
    draftImage = character.image || '';
    renderTagChips();
    renderImagePreview();
    updateColorPreview();
    colorWheel.setHex(formEl.querySelector('#cf-color-hex').value);
  }

  function open(id) {
    editingId = id || null;
    const character = editingId ? Store.get().characters.find((c) => c.id === editingId) : null;
    formEl.reset();
    fillForm(character || EMPTY);
    renderTagDatalist();
    formEl.querySelector('#cf-title').textContent = character ? 'キャラクターを編集' : '新規キャラクター';
    formEl.querySelector('#cf-submit').textContent = character ? '保存する' : '追加する';
    overlayEl.classList.add('cf-open');
    setTimeout(() => formEl.querySelector('#cf-name').focus(), 50);
  }

  function close() {
    overlayEl.classList.remove('cf-open');
    editingId = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    addTagFromInput();
    const name = formEl.querySelector('#cf-name').value.trim();
    if (!name) {
      formEl.querySelector('#cf-name').focus();
      return;
    }
    const now = new Date().toISOString();
    const existing = editingId ? Store.get().characters.find((c) => c.id === editingId) : null;
    const character = {
      id: editingId || Utils.uuid(),
      name,
      image: draftImage,
      color: ColorUtils.normalizeHex(formEl.querySelector('#cf-color-hex').value),
      system: getSystemValue(),
      scenario: formEl.querySelector('#cf-scenario').value.trim(),
      ho: formEl.querySelector('#cf-ho').value.trim(),
      age: formEl.querySelector('#cf-age').value.trim(),
      gender: formEl.querySelector('#cf-gender').value.trim(),
      height: formEl.querySelector('#cf-height').value.trim(),
      occupation: formEl.querySelector('#cf-occupation').value.trim(),
      description: formEl.querySelector('#cf-description').value.trim(),
      tags: [...draftTags],
      iacharaUrl: formEl.querySelector('#cf-iachara-url').value.trim(),
      source: (existing && existing.source) || 'manual',
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now
    };

    await DB.putCharacter(character);
    const chars = Store.get().characters.slice();
    const idx = chars.findIndex((c) => c.id === character.id);
    if (idx === -1) chars.push(character); else chars[idx] = character;
    Store.set({ characters: chars });
    global.DetailModal && global.DetailModal.refreshIfOpen(character.id);
    close();
  }

  function markup() {
    return `
      <button type="button" class="cf-close" aria-label="閉じる">×</button>
      <h2 id="cf-title">新規キャラクター</h2>

      <div class="cf-iachara-box">
        <button type="button" id="cf-iachara-toggle" class="btn btn-ghost btn-small">いあきゃらから読み込む ▾</button>
        <div id="cf-iachara-panel" class="cf-iachara-panel" hidden>
          <p class="cf-hint">
            1. 下のボタンをブラウザのブックマークバーにドラッグして登録してください。<br>
            2. いあきゃらの自分のキャラクターシートページ(https://iachara.com/view/...)を開いた状態で、そのブックマークをクリックしてください。<br>
            3. コピーされたJSONを下の欄に貼り付けて「反映する」を押すと、名前・カラー・立ち絵・職業・年齢が自動入力されます(「出力→キャラ出力」が使えるシートでは、よみ・性格・好きなもの・嫌いなもの・備考なども紹介文に追記されます)。<br>
            ※ タグ・シナリオ・HOはいあきゃらの公開シートには含まれないため、引き続き手動で入力してください。
          </p>
          <a href="#" id="cf-bookmarklet" class="btn btn-primary btn-small cf-bookmarklet" title="ブックマークバーにドラッグしてください">📥 いあきゃら取り込み</a>
          <textarea id="cf-iachara-paste" rows="4" placeholder="ここにコピーしたJSONを貼り付け"></textarea>
          <button type="button" id="cf-iachara-apply" class="btn btn-ghost btn-small">反映する</button>
          <div class="cf-bulk-cta">
            <span class="cf-bulk-cta-text">複数人まとめて登録したいときは</span>
            <button type="button" id="cf-open-bulk" class="btn btn-primary btn-small">📋 一括登録はこちら</button>
          </div>
        </div>
      </div>

      <div class="cf-grid">
        <div class="cf-col-image">
          <div id="cf-image-preview" class="cf-image-preview"></div>
          <label class="btn btn-ghost cf-file-btn">
            画像を選択
            <input type="file" id="cf-image-input" accept="image/*" hidden />
          </label>
          <button type="button" id="cf-image-clear" class="btn btn-ghost btn-small">画像をクリア</button>

          <label class="cf-label">カラー <span class="cf-required">*</span></label>
          <div class="cf-color-row">
            <span id="cf-color-preview" class="cf-color-preview" aria-hidden="true"></span>
            <input type="text" id="cf-color-hex" value="#c9a876" maxlength="7" />
          </div>
          <div id="cf-color-wheel"></div>
          <p class="cf-hint">いあきゃらに登録している「カラー」の値をそのまま入力するか、カラーホイールから選べます。</p>
        </div>
        <div class="cf-col-fields">
          <label class="cf-label">名前 <span class="cf-required">*</span></label>
          <input type="text" id="cf-name" required maxlength="60" />

          <div class="cf-field-pair">
            <div>
              <label class="cf-label">システム</label>
              <select id="cf-system-select">
                <option value="クトゥルフ神話TRPG 6版">クトゥルフ神話TRPG 6版</option>
                <option value="クトゥルフ神話TRPG 7版">クトゥルフ神話TRPG 7版</option>
                <option value="シノビガミ">シノビガミ</option>
                <option value="インセイン">インセイン</option>
                <option value="エモクロアTRPG">エモクロアTRPG</option>
                <option value="マレウス・モンストロルム">マレウス・モンストロルム</option>
                <option value="ダブルクロス The 3rd Edition">ダブルクロス The 3rd Edition</option>
                <option value="ソード・ワールド2.5">ソード・ワールド2.5</option>
                <option value="__other__">その他(自由入力)</option>
              </select>
              <input type="text" id="cf-system-other" maxlength="60" placeholder="システム名を入力" hidden />
            </div>
            <div>
              <label class="cf-label">シナリオ</label>
              <input type="text" id="cf-scenario" maxlength="60" />
            </div>
          </div>

          <div class="cf-field-trio">
            <div>
              <label class="cf-label">HO</label>
              <input type="text" id="cf-ho" maxlength="20" />
            </div>
            <div>
              <label class="cf-label">年齢</label>
              <input type="text" id="cf-age" maxlength="20" />
            </div>
            <div>
              <label class="cf-label">職業</label>
              <input type="text" id="cf-occupation" maxlength="40" />
            </div>
          </div>

          <div class="cf-field-pair">
            <div>
              <label class="cf-label">性別</label>
              <input type="text" id="cf-gender" maxlength="20" />
            </div>
            <div>
              <label class="cf-label">身長</label>
              <input type="text" id="cf-height" maxlength="20" />
            </div>
          </div>

          <label class="cf-label">紹介文</label>
          <textarea id="cf-description" rows="3" maxlength="400"></textarea>

          <label class="cf-label">タグ</label>
          <div class="cf-tag-input-row">
            <input type="text" id="cf-tag-input" list="cf-tag-suggestions" placeholder="タグを入力してEnter" />
            <datalist id="cf-tag-suggestions"></datalist>
            <button type="button" id="cf-tag-add" class="btn btn-ghost btn-small">追加</button>
          </div>
          <div id="cf-tag-chips" class="cf-tag-chips"></div>

          <label class="cf-label">いあきゃらURL</label>
          <input type="url" id="cf-iachara-url" placeholder="https://iachara.com/..." />
        </div>
      </div>
      <div class="cf-actions">
        <button type="button" class="btn btn-ghost" id="cf-cancel">キャンセル</button>
        <button type="submit" class="btn btn-primary" id="cf-submit">追加する</button>
      </div>
    `;
  }

  function mount() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'cf-overlay';
    overlayEl.innerHTML = '<form class="cf-panel" novalidate></form>';
    document.body.appendChild(overlayEl);
    formEl = overlayEl.querySelector('.cf-panel');
    formEl.innerHTML = markup();

    formEl.querySelector('.cf-close').addEventListener('click', close);
    formEl.querySelector('#cf-cancel').addEventListener('click', close);
    formEl.addEventListener('submit', handleSubmit);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });

    formEl.querySelector('#cf-system-select').addEventListener('change', (e) => {
      const other = formEl.querySelector('#cf-system-other');
      other.hidden = e.target.value !== '__other__';
      if (!other.hidden) other.focus();
    });

    const colorHex = formEl.querySelector('#cf-color-hex');
    const syncColorFromWheel = (hex) => {
      colorHex.value = hex;
      updateColorPreview();
    };
    colorWheel = ColorWheel.create(formEl.querySelector('#cf-color-wheel'), {
      onChange: syncColorFromWheel,
      onCommit: syncColorFromWheel
    });
    colorHex.addEventListener('input', updateColorPreview);
    colorHex.addEventListener('change', () => {
      colorHex.value = ColorUtils.normalizeHex(colorHex.value);
      updateColorPreview();
      colorWheel.setHex(colorHex.value);
    });

    formEl.querySelector('#cf-tag-add').addEventListener('click', addTagFromInput);
    formEl.querySelector('#cf-tag-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); }
    });

    formEl.querySelector('#cf-image-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      draftImage = await Utils.readFileAsDataUrl(file);
      renderImagePreview();
    });
    formEl.querySelector('#cf-image-clear').addEventListener('click', () => {
      draftImage = '';
      formEl.querySelector('#cf-image-input').value = '';
      renderImagePreview();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayEl.classList.contains('cf-open')) close();
    });

    const bookmarkletLink = formEl.querySelector('#cf-bookmarklet');
    bookmarkletLink.setAttribute('href', global.IacharaSync.bookmarkletHref());
    bookmarkletLink.addEventListener('click', (e) => {
      // ドラッグしてブックマーク登録するためのリンクなので、フォーム内でのクリック実行は防ぐ
      e.preventDefault();
      alert('このボタンはクリックではなく、ブックマークバーへドラッグして登録してください。\n登録後、いあきゃらのキャラクターページでそのブックマークをクリックします。');
    });

    formEl.querySelector('#cf-iachara-toggle').addEventListener('click', () => {
      const panel = formEl.querySelector('#cf-iachara-panel');
      panel.hidden = !panel.hidden;
    });

    formEl.querySelector('#cf-open-bulk').addEventListener('click', () => {
      close();
      global.BulkImport.open();
    });

    formEl.querySelector('#cf-iachara-apply').addEventListener('click', async () => {
      const textarea = formEl.querySelector('#cf-iachara-paste');
      let imported;
      try {
        imported = global.IacharaSync.parseIacharaExport(textarea.value.trim());
      } catch (err) {
        alert(err.message);
        return;
      }
      if (imported.name) formEl.querySelector('#cf-name').value = imported.name;
      if (imported.color) {
        formEl.querySelector('#cf-color-hex').value = imported.color;
        updateColorPreview();
        colorWheel.setHex(imported.color);
      }
      if (imported.occupation) formEl.querySelector('#cf-occupation').value = imported.occupation;
      if (imported.age) formEl.querySelector('#cf-age').value = imported.age;
      if (imported.gender) formEl.querySelector('#cf-gender').value = imported.gender;
      if (imported.height) formEl.querySelector('#cf-height').value = imported.height;
      if (imported.iacharaUrl) formEl.querySelector('#cf-iachara-url').value = imported.iacharaUrl;
      if (imported.image) {
        // 可能ならbase64に変換してJSONバックアップに含められるようにする(CORSで失敗する場合は外部URLのまま使う)
        draftImage = imported.image;
        renderImagePreview();
        try {
          const res = await fetch(imported.image, { mode: 'cors' });
          const blob = await res.blob();
          draftImage = await Utils.readFileAsDataUrl(blob);
          renderImagePreview();
        } catch (err) {
          /* 外部URLのまま利用する。バックアップに含めたい場合は画像を保存して手動で選択してください */
        }
      }
      if (imported.extraInfo) {
        const descEl = formEl.querySelector('#cf-description');
        descEl.value = descEl.value ? `${descEl.value}\n${imported.extraInfo}` : imported.extraInfo;
      }
      textarea.value = '';
      alert('いあきゃらの情報を反映しました。タグ・シナリオ・HOは手動で入力してください。');
    });
  }

  global.CharacterForm = { mount, open, close };
})(window);
