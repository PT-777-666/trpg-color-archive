/* importExport.js — JSONバックアップ/復元。
 * 画像はキャラクターレコードにbase64で同梱されているため、
 * このJSON1ファイルだけで画像込みの完全バックアップになる。
 */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;

  function exportJson() {
    const payload = {
      app: 'trpg-character-archive',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      characters: Store.get().characters
    };
    const stamp = new Date().toISOString().slice(0, 10);
    Utils.downloadJson(`trpg-character-archive_${stamp}.json`, payload);
  }

  function normalizeImported(raw) {
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.characters) ? raw.characters : null;
    if (!list) throw new Error('認識できるキャラクターデータが見つかりませんでした。');
    const now = new Date().toISOString();
    return list.map((c) => ({
      id: c.id || Utils.uuid(),
      name: c.name || '',
      image: c.image || '',
      color: ColorUtils.normalizeHex(c.color || '#888888'),
      system: c.system || '',
      scenario: c.scenario || '',
      ho: c.ho || '',
      age: c.age || '',
      gender: c.gender || '',
      height: c.height || '',
      occupation: c.occupation || '',
      description: c.description || '',
      tags: Array.isArray(c.tags) ? c.tags : [],
      iacharaUrl: c.iacharaUrl || '',
      source: c.source || 'manual',
      createdAt: c.createdAt || now,
      updatedAt: c.updatedAt || now
    }));
  }

  async function importFromFile(file) {
    const text = await file.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      alert('JSONファイルとして読み込めませんでした。ファイルを確認してください。');
      return;
    }

    let imported;
    try {
      imported = normalizeImported(json);
    } catch (err) {
      alert(err.message);
      return;
    }

    const replace = confirm(
      `${imported.length}件のキャラクターを読み込みます。\n\n` +
      'OK: 既存データを残したまま追加/更新(同じIDは上書き)\n' +
      'キャンセル: 現在の登録データを全て置き換える\n\n' +
      '続行しますか？(このダイアログを閉じると処理は中止されません。上のいずれかで進みます)'
    );

    if (replace) {
      // 「置き換え」を選んだ場合
      const doReplace = confirm('本当に現在の登録データを全て削除して置き換えますか？この操作は取り消せません。');
      if (doReplace) {
        await DB.clearCharacters();
        await DB.putCharacters(imported);
        Store.set({ characters: imported, selectedTags: [] });
        alert(`${imported.length}件のキャラクターで置き換えました。`);
        return;
      }
    }

    // マージ(追加/更新)
    await DB.putCharacters(imported);
    const current = Store.get().characters.slice();
    imported.forEach((c) => {
      const idx = current.findIndex((x) => x.id === c.id);
      if (idx === -1) current.push(c); else current[idx] = c;
    });
    Store.set({ characters: current });
    alert(`${imported.length}件のキャラクターを追加/更新しました。`);
  }

  global.ImportExport = { exportJson, importFromFile };
})(window);
