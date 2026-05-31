type StoredValue = unknown;

export type WalletConnectStorage = {
  getKeys(): Promise<string[]>;
  getEntries<T = StoredValue>(): Promise<[string, T][]>;
  getItem<T = StoredValue>(key: string): Promise<T | undefined>;
  setItem<T = StoredValue>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const STORAGE_PREFIX = "warpletgobbler:walletconnect:";

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function parseStoredValue(value: string | null): StoredValue | undefined {
  if (value === null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function createWalletConnectStorage(): WalletConnectStorage {
  const memory = new Map<string, StoredValue>();

  const readKeys = () => {
    const storage = getBrowserStorage();
    if (!storage) return Array.from(memory.keys());

    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key.slice(STORAGE_PREFIX.length));
      }
    }
    return keys;
  };

  return {
    async getKeys() {
      return readKeys();
    },

    async getEntries<T = StoredValue>() {
      const entries: [string, T][] = [];
      for (const key of readKeys()) {
        const value = await this.getItem<T>(key);
        if (value !== undefined) entries.push([key, value]);
      }
      return entries;
    },

    async getItem<T = StoredValue>(key: string) {
      const storage = getBrowserStorage();
      if (!storage) return memory.get(key) as T | undefined;
      return parseStoredValue(storage.getItem(`${STORAGE_PREFIX}${key}`)) as
        | T
        | undefined;
    },

    async setItem<T = StoredValue>(key: string, value: T) {
      const storage = getBrowserStorage();
      if (!storage) {
        memory.set(key, value);
        return;
      }
      storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    },

    async removeItem(key: string) {
      const storage = getBrowserStorage();
      if (!storage) {
        memory.delete(key);
        return;
      }
      storage.removeItem(`${STORAGE_PREFIX}${key}`);
    },
  };
}
