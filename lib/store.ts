export interface StoreProfile {
  id: string;
  name: string;
  url: string;
  ck: string;
  cs: string;
}

const STORAGE_KEY = 'woo_stores';
const ACTIVE_STORE_KEY = 'woo_active_store';

export function getStores(): StoreProfile[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveStore(store: Omit<StoreProfile, 'id'>): StoreProfile {
  const stores = getStores();
  const newStore: StoreProfile = {
    ...store,
    id: Math.random().toString(36).substring(2, 9)
  };
  stores.push(newStore);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
  return newStore;
}

export function removeStore(id: string) {
  const stores = getStores().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
  const active = getActiveStore();
  if (active?.id === id) {
    localStorage.removeItem(ACTIVE_STORE_KEY);
  }
}

export function getActiveStore(): StoreProfile | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(ACTIVE_STORE_KEY);
  return data ? JSON.parse(data) : null;
}

export function setActiveStore(store: StoreProfile | null) {
  if (store) {
    localStorage.setItem(ACTIVE_STORE_KEY, JSON.stringify(store));
  } else {
    localStorage.removeItem(ACTIVE_STORE_KEY);
  }
}
