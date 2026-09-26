// Vitest's 'node' environment has no localStorage. A tiny in-memory polyfill is enough for the
// zustand/persist stores (settingsStore, puzzleProgressStore) — no need for a full jsdom environment
// just for this.
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  const polyfill: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: polyfill, writable: true });
}
