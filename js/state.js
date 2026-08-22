/* state.js — アプリの中心状態とシンプルなpub/sub。
 * フレームワークを使わないため、状態変更 → 購読者への通知という
 * 最小限のパターンだけを自前で実装している。
 */
(function (global) {
  'use strict';

  function createStore() {
    const listeners = new Set();
    const state = {
      characters: [],       // Character[]
      selectedTags: [],     // string[] 選択中タグ
      filterMode: 'AND',    // 'AND' | 'OR'
      hoveredId: null,
      openDetailId: null,
      loading: true
    };

    function get() {
      return state;
    }

    function set(patch) {
      Object.assign(state, patch);
      listeners.forEach((fn) => fn(state));
    }

    function subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    function allTags() {
      const set = new Set();
      state.characters.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
    }

    function toggleTag(tag) {
      const idx = state.selectedTags.indexOf(tag);
      const next = idx === -1
        ? [...state.selectedTags, tag]
        : state.selectedTags.filter((t) => t !== tag);
      set({ selectedTags: next });
    }

    function clearTags() {
      set({ selectedTags: [] });
    }

    function setFilterMode(mode) {
      set({ filterMode: mode });
    }

    function filteredCharacters() {
      const { characters, selectedTags, filterMode } = state;
      if (selectedTags.length === 0) return characters;
      return characters.filter((c) => {
        const tags = c.tags || [];
        return filterMode === 'AND'
          ? selectedTags.every((t) => tags.includes(t))
          : selectedTags.some((t) => tags.includes(t));
      });
    }

    return {
      get, set, subscribe,
      allTags, toggleTag, clearTags, setFilterMode,
      filteredCharacters
    };
  }

  global.Store = createStore();
})(window);
