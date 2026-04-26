import {
  DEFAULT_LIBRARY,
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  STORAGE_KEYS
} from './constants.js';

const storageArea = chrome.storage.local;

export async function getStoredState() {
  const data = await storageArea.get(Object.values(STORAGE_KEYS));

  return {
    settings: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.settings] ?? {}) },
    library: { ...DEFAULT_LIBRARY, ...(data[STORAGE_KEYS.library] ?? {}) },
    session: data[STORAGE_KEYS.session] ?? DEFAULT_SESSION
  };
}

export async function setStoredPartial(partial) {
  const payload = {};

  if (partial.settings) {
    payload[STORAGE_KEYS.settings] = partial.settings;
  }
  if (partial.library) {
    payload[STORAGE_KEYS.library] = partial.library;
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'session')) {
    payload[STORAGE_KEYS.session] = partial.session;
  }

  await storageArea.set(payload);
}

export async function clearSessionData() {
  await storageArea.remove([STORAGE_KEYS.session]);
}

export function chromeStorageAdapter(prefix = 'sb') {
  return {
    async getItem(key) {
      const result = await storageArea.get(`${prefix}:${key}`);
      return result[`${prefix}:${key}`] ?? null;
    },
    async setItem(key, value) {
      await storageArea.set({ [`${prefix}:${key}`]: value });
    },
    async removeItem(key) {
      await storageArea.remove(`${prefix}:${key}`);
    }
  };
}
