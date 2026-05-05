import { getActiveStore } from './store';

export interface WooProduct {
  id: number;
  name: string;
  sku: string;
  type: 'simple' | 'variable' | 'grouped' | 'external' | string;
  regular_price: string;
  parent?: number;
}

export interface WooVariation {
  id: number;
  sku: string;
  regular_price: string;
  attributes?: Array<{ id?: number; name: string; option: string }>;
}

export async function wooFetch(endpoint: string, method = 'GET', data?: any, params?: any) {
  const store = getActiveStore();
  if (!store) {
    throw new Error('No active store connected');
  }

  const response = await fetch('/api/woo', {
    method: 'POST', // The proxy route is a POST request
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: store.url,
      ck: store.ck,
      cs: store.cs,
      endpoint,
      method,
      data,
      params,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `WooCommerce Error: ${response.status}`);
  }

  return result;
}

const globalCache: Record<string, { data: any, timestamp: number }> = {};
const PENDING_PRODUCT_KEY = 'woo_pending_product';

export function clearCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    for (const key in globalCache) delete globalCache[key];
  } else {
    for (const key in globalCache) {
      if (key.includes(`_${endpointPrefix}`)) delete globalCache[key];
    }
  }
}

export async function fetchAll(endpoint: string, extraParams: any = {}, forceRefresh = false) {
  const store = getActiveStore();
  const cacheKey = `${store?.id}_${endpoint}_${JSON.stringify(extraParams)}`;

  if (!forceRefresh && globalCache[cacheKey]) {
    return globalCache[cacheKey].data;
  }

  let all: any[] = [];
  let pg = 1;
  while (true) {
    const batch = await wooFetch(endpoint, 'GET', undefined, { per_page: 100, page: pg, ...extraParams });
    all = all.concat(batch);
    if (batch.length < 100) break;
    pg++;
  }
  
  globalCache[cacheKey] = { data: all, timestamp: Date.now() };
  return all;
}

export function appendCache(endpointPrefix: string, newItem: any) {
  const store = getActiveStore();
  if (!store || typeof window === 'undefined') return;
  
  if (endpointPrefix === 'products') {
    // Handoff for dashboard page 1 without reloading full catalog.
    window.sessionStorage.setItem(PENDING_PRODUCT_KEY, JSON.stringify(newItem));
  }

  for (const key in globalCache) {
    if (!key.includes(`${store.id}_${endpointPrefix}`)) continue;
    if (Array.isArray(globalCache[key].data)) {
      globalCache[key].data = [newItem, ...globalCache[key].data];
    }
  }
}

export function consumePendingProduct(): WooProduct | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PENDING_PRODUCT_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(PENDING_PRODUCT_KEY);
  try {
    return JSON.parse(raw) as WooProduct;
  } catch {
    return null;
  }
}

