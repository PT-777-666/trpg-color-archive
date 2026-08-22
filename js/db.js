/* db.js — IndexedDBの薄いラッパー。
 * 個人利用・ローカル完結が前提のため、ログインやサーバーDBは使わない。
 * 画像はbase64文字列としてキャラクターレコードに同梱し、JSONエクスポートで
 * そのままバックアップできるようにしている。
 */
(function (global) {
  'use strict';

  const DB_NAME = 'trpg-character-archive';
  const DB_VERSION = 1;
  const STORE_CHARACTERS = 'characters';
  const STORE_META = 'meta';

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
          const store = db.createObjectStore(STORE_CHARACTERS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await openDb();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async function getAllCharacters() {
    const store = await tx(STORE_CHARACTERS, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function putCharacter(character) {
    const store = await tx(STORE_CHARACTERS, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(character);
      req.onsuccess = () => resolve(character);
      req.onerror = () => reject(req.error);
    });
  }

  async function putCharacters(characters) {
    const store = await tx(STORE_CHARACTERS, 'readwrite');
    return new Promise((resolve, reject) => {
      let remaining = characters.length;
      if (remaining === 0) return resolve();
      characters.forEach((c) => {
        const req = store.put(c);
        req.onsuccess = () => {
          remaining -= 1;
          if (remaining === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async function deleteCharacter(id) {
    const store = await tx(STORE_CHARACTERS, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clearCharacters() {
    const store = await tx(STORE_CHARACTERS, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function getMeta(key) {
    const store = await tx(STORE_META, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async function setMeta(key, value) {
    const store = await tx(STORE_META, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  global.DB = {
    getAllCharacters,
    putCharacter,
    putCharacters,
    deleteCharacter,
    clearCharacters,
    getMeta,
    setMeta
  };
})(window);
