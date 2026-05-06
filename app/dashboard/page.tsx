"use client";

import { useEffect, useMemo, useState } from "react";
import { consumePendingProduct, wooFetch, WooProduct, WooVariation } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { Search, ChevronDown, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, Edit2, X, Check, Globe, Lock, SlidersHorizontal } from "lucide-react";

type WooCategory = {
  id: number;
  name: string;
  parent: number;
  count: number;
};

const PER_PAGE = 20;
type StockState = "instock" | "outofstock";

export default function ManageProducts() {
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [showCatDD, setShowCatDD] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // State for Variations
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [varCache, setVarCache] = useState<Record<number, WooVariation[]>>({});
  const [varLoading, setVarLoading] = useState<Set<number>>(new Set());
  const [updatingStock, setUpdatingStock] = useState<Set<number>>(new Set());
  // Per-variation stock update: key = "${parentId}-${varId}"
  const [updatingVarStock, setUpdatingVarStock] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<Set<number>>(new Set());

  // Toast
  const [toast, setToast] = useState<{msg: string, type: "success"|"error"|"loading"} | null>(null);
  // Mobile filter panel open/close
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [selCatId]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await wooFetch(
          "products/categories",
          "GET",
          undefined,
          { per_page: 100, page: 1, _fields: "id,name,parent,count" }
        ) as WooCategory[];
        setCategories(cats.sort((a, b) => a.parent - b.parent || a.name.localeCompare(b.name)));
      } catch {
        // Category fetch failure should not block product page rendering.
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadProductsPage = async () => {
      setLoading(true);
      setError("");
      try {
        const params: Record<string, string | number> = {
          per_page: PER_PAGE,
          page,
          orderby: "date",
          order: "desc",
          _fields: "id,name,sku,type,regular_price,parent,stock_status,status",
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (selCatId !== null) params.category = selCatId;

        const items = await wooFetch("products", "GET", undefined, params) as WooProduct[];
        const parentProducts = items.filter((item) => !item.parent || item.parent === 0);
        setProducts(parentProducts);
        setHasNextPage(items.length === PER_PAGE);

        if (page === 1 && !debouncedSearch && selCatId === null) {
          const pending = consumePendingProduct();
          if (pending) {
            setProducts((prev) => [pending, ...prev.filter((p) => p.id !== pending.id)].slice(0, PER_PAGE));
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    loadProductsPage();
  }, [page, debouncedSearch, selCatId]);

  const showToast = (msg: string, type: "success"|"error"|"loading") => {
    setToast({ msg, type });
    if (type !== "loading") setTimeout(() => setToast(null), 3500);
  };

  const toggleExpand = async (id: number) => {
    const newExp = new Set(expanded);
    if (newExp.has(id)) {
      newExp.delete(id);
      setExpanded(newExp);
      return;
    }
    newExp.add(id);
    setExpanded(newExp);

    if (!varCache[id] && !varLoading.has(id)) {
      setVarLoading(prev => new Set(prev).add(id));
      try {
        const vars = await wooFetch(
          `products/${id}/variations`,
          "GET",
          undefined,
          { _fields: "id,sku,regular_price,attributes,stock_status", per_page: 100, page: 1 }
        ) as WooVariation[];
        setVarCache(prev => ({ ...prev, [id]: vars }));
      } catch (err: any) {
        showToast("Failed to load variations: " + err.message, "error");
      } finally {
        setVarLoading(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }
  };

  // Build category tree for dropdown
  const catTree = useMemo(() => {
    const buildTree = (parentId = 0, depth = 0): any[] => {
      return categories
        .filter(c => c.parent === parentId)
        .flatMap(c => [{ ...c, depth }, ...buildTree(c.id, depth + 1)]);
    };
    const tree = buildTree();
    if (!catSearch.trim()) return tree;
    return tree.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));
  }, [categories, catSearch]);

  const selectedCatName = selCatId === null 
    ? "All Categories" 
    : categories.find(c => c.id === selCatId)?.name || "Unknown";
  const getStockState = (status?: string): StockState => status === "outofstock" ? "outofstock" : "instock";
  const deriveParentStockFromVariations = (variations: WooVariation[]): StockState => {
    return variations.some((variation) => getStockState(variation.stock_status) === "instock")
      ? "instock"
      : "outofstock";
  };
  const ensureVariationsLoaded = async (parentId: number): Promise<WooVariation[]> => {
    const cached = varCache[parentId];
    if (cached) return cached;
    const vars = await wooFetch(
      `products/${parentId}/variations`,
      "GET",
      undefined,
      { _fields: "id,sku,regular_price,attributes,stock_status", per_page: 100, page: 1 }
    ) as WooVariation[];
    setVarCache((prev) => ({ ...prev, [parentId]: vars }));
    return vars;
  };
  const toggleProductStock = async (product: WooProduct) => {
    if (updatingStock.has(product.id)) return;
    setUpdatingStock((prev) => new Set(prev).add(product.id));
    showToast("Updating stock...", "loading");
    try {
      if (product.type === "variable") {
        const variations = await ensureVariationsLoaded(product.id);
        if (variations.length === 0) throw new Error("No variations found");
        const targetStatus: StockState = deriveParentStockFromVariations(variations) === "instock" ? "outofstock" : "instock";
        const updatedVariations = await Promise.all(
          variations.map(async (variation) => {
            await wooFetch(
              `products/${product.id}/variations/${variation.id}`,
              "PATCH",
              { stock_status: targetStatus }
            );
            return { ...variation, stock_status: targetStatus };
          })
        );
        setVarCache((prev) => ({ ...prev, [product.id]: updatedVariations }));
        const nextParentStatus = deriveParentStockFromVariations(updatedVariations);
        setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, stock_status: nextParentStatus } : item));
        logActivity({ action: "toggle_stock", product_id: product.id, product_name: product.name, old_value: deriveParentStockFromVariations(variations), new_value: targetStatus });
      } else {
        const prevStatus = getStockState(product.stock_status);
        const targetStatus: StockState = prevStatus === "instock" ? "outofstock" : "instock";
        await wooFetch(`products/${product.id}`, "PATCH", { stock_status: targetStatus });
        setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, stock_status: targetStatus } : item));
        logActivity({ action: "toggle_stock", product_id: product.id, product_name: product.name, old_value: prevStatus, new_value: targetStatus });
      }
      showToast("Stock updated", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update stock";
      showToast("Failed to update stock: " + message, "error");
    } finally {
      setUpdatingStock((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const toggleVariationStock = async (product: WooProduct, v: WooVariation) => {
    const key = `${product.id}-${v.id}`;
    if (updatingVarStock.has(key)) return;
    setUpdatingVarStock((prev) => new Set(prev).add(key));
    showToast("Updating stock...", "loading");
    try {
      const prevStatus = v.stock_status === "outofstock" ? "outofstock" : "instock";
      const target: StockState = prevStatus === "instock" ? "outofstock" : "instock";
      await wooFetch(`products/${product.id}/variations/${v.id}`, "PATCH", { stock_status: target });
      const updatedVars = (varCache[product.id] || []).map((x) =>
        x.id === v.id ? { ...x, stock_status: target } : x
      );
      setVarCache((prev) => ({ ...prev, [product.id]: updatedVars }));
      // Recalculate and sync parent stock
      const newParentStock = deriveParentStockFromVariations(updatedVars);
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, stock_status: newParentStock } : p)
      );
      logActivity({ action: "toggle_stock", product_id: v.id, product_name: `${product.name} — Variasi #${v.id}`, old_value: prevStatus, new_value: target });
      showToast("Stock variasi diperbarui", "success");
    } catch (err: unknown) {
      showToast("Gagal: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setUpdatingVarStock((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }
  };

  const toggleProductStatus = async (product: WooProduct) => {
    if (updatingStatus.has(product.id)) return;
    setUpdatingStatus(prev => new Set(prev).add(product.id));
    showToast("Mengubah status...", "loading");
    try {
      const prev = product.status === 'private' ? 'private' : 'publish';
      const target = prev === 'publish' ? 'private' : 'publish';
      await wooFetch(`products/${product.id}`, "PATCH", { status: target });
      setProducts(prevList => prevList.map(item => item.id === product.id ? { ...item, status: target } : item));
      logActivity({ action: "toggle_status", product_id: product.id, product_name: product.name, old_value: prev, new_value: target });
      showToast(target === 'publish' ? "Produk dipublish" : "Produk diprivatkan", "success");
    } catch (err: unknown) {
      showToast("Gagal: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setUpdatingStatus(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const firstEntry = products.length > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const lastEntry = (page - 1) * PER_PAGE + products.length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0 gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-800 leading-tight truncate">Manage Products</h2>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
            {loading ? "Loading..." : `${products.length} produk — halaman ${page}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: filter toggle */}
          <button
            onClick={() => setFilterOpen(f => !f)}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterOpen || selCatId !== null || search
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
            {(selCatId !== null || search) && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => {
              setExpanded(new Set());
              setVarCache({});
              setVarLoading(new Set());
              setPage(1);
              setDebouncedSearch(search.trim());
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      {/* Filters — always visible on sm+, collapsible on mobile */}
      <div className={`border-b border-slate-200 bg-slate-50 shrink-0 ${filterOpen ? "block" : "hidden sm:block"}`}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 p-3">
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama produk atau SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowCatDD(!showCatDD)}
              className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 w-full sm:min-w-[180px] hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
            >
              <span className="truncate">{selectedCatName}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {showCatDD && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCatDD(false)} />
                <div className="absolute top-full left-0 mt-1 w-full sm:w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-20 overflow-hidden flex flex-col max-h-72">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      placeholder="Cari kategori..."
                      value={catSearch}
                      onChange={e => setCatSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="overflow-y-auto p-1 flex-1">
                    <button
                      onClick={() => { setSelCatId(null); setShowCatDD(false); setPage(1); }}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-slate-100 flex justify-between items-center ${selCatId === null ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"}`}
                    >
                      Semua Kategori
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{products.length}</span>
                    </button>
                    {catTree.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelCatId(c.id); setShowCatDD(false); setPage(1); }}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-slate-100 flex justify-between items-center ${selCatId === c.id ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"}`}
                      >
                        <span className="truncate">
                          <span className="text-slate-300 mr-1">{'—'.repeat(c.depth)}</span>
                          {c.name}
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">{c.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active category chip */}
          {selCatId !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium w-fit">
              <span className="truncate max-w-[140px]">{selectedCatName}</span>
              <button
                onClick={() => setSelCatId(null)}
                className="hover:text-blue-900 rounded-full p-0.5 hover:bg-blue-200 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Results count — hidden on mobile (shown in topbar subtitle) */}
          <span className="hidden sm:block ml-auto text-xs text-slate-400 font-medium">
            {products.length} hasil
          </span>
        </div>
      </div>

      {/* Shared loading/error/empty states */}
      {(loading || error || products.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center h-64 bg-white">
          {loading ? (
            <>
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
              <p className="text-sm text-slate-500">Memuat produk...</p>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-8 h-8 mb-3 text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Tidak ada produk yang sesuai.</p>
          )}
        </div>
      )}

      {!loading && !error && products.length > 0 && (() => {
        const sharedOnUpdate = (id: number, field: string, val: string, type: string, parentId?: number) => {
          if (type === 'variation' && parentId) {
            setVarCache(prev => {
              const arr = [...(prev[parentId] || [])];
              const idx = arr.findIndex(v => v.id === id);
              if (idx > -1) arr[idx] = { ...arr[idx], [field]: val };
              return { ...prev, [parentId]: arr };
            });
          } else {
            setProducts(prev => {
              const arr = [...prev];
              const idx = arr.findIndex(x => x.id === id);
              if (idx > -1) arr[idx] = { ...arr[idx], [field]: val };
              return arr;
            });
          }
        };
        const sharedProps = (p: WooProduct) => ({
          product: p,
          expanded: expanded.has(p.id),
          onToggleExpand: () => toggleExpand(p.id),
          varCache: varCache[p.id] || [],
          isLoadingVars: varLoading.has(p.id),
          isUpdatingStock: updatingStock.has(p.id),
          onToggleStock: () => toggleProductStock(p),
          isUpdatingStatus: updatingStatus.has(p.id),
          onToggleStatus: () => toggleProductStatus(p),
          updatingVarStock,
          onToggleVariationStock: (v: WooVariation) => toggleVariationStock(p, v),
          onUpdate: sharedOnUpdate,
          showToast,
        });

        return (
          <>
            {/* ── Desktop table (sm+) ── */}
            <div className="hidden sm:flex flex-col flex-1 overflow-auto bg-white">
              <table className="w-full text-sm text-left min-w-[600px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-100 border-b border-slate-200">
                    <th className="w-10 px-3 py-2.5"></th>
                    <th className="px-3 py-2.5 hidden md:table-cell">ID</th>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">Nama Produk</th>
                    <th className="px-3 py-2.5 hidden md:table-cell">Tipe</th>
                    <th className="px-3 py-2.5">Stok</th>
                    <th className="px-3 py-2.5">Harga</th>
                    <th className="px-3 py-2.5">Kontrol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => <ProductRow key={p.id} {...sharedProps(p)} />)}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (<sm) ── */}
            <div className="sm:hidden flex-1 overflow-auto bg-slate-50">
              <div className="p-3 space-y-2.5 pb-6">
                {products.map(p => <ProductCard key={p.id} {...sharedProps(p)} />)}
              </div>
            </div>
          </>
        );
      })()}

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white shrink-0">
        <p className="text-xs text-slate-400 hidden sm:block">
          Menampilkan <span className="font-semibold text-slate-600">{firstEntry}–{lastEntry}</span> entri
        </p>
        <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg min-w-[60px] text-center">
            Hal. {page}
          </span>
          <button
            disabled={!hasNextPage || loading}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 max-w-xs ${
          toast.type === 'success' ? 'bg-white border-green-200 text-green-800 shadow-green-100' :
          toast.type === 'error'   ? 'bg-white border-red-200 text-red-700 shadow-red-100' :
                                     'bg-white border-blue-200 text-blue-700 shadow-blue-100'
        }`}>
          {toast.type === 'loading'
            ? <RefreshCw className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
            : toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Sub-components
// ---------------------------------------------------------

function ProductRow({ product: p, expanded, onToggleExpand, varCache, isLoadingVars, isUpdatingStock, onToggleStock, isUpdatingStatus, onToggleStatus, updatingVarStock, onToggleVariationStock, onUpdate, showToast }: {
  product: WooProduct;
  expanded: boolean;
  onToggleExpand: () => void;
  varCache: WooVariation[];
  isLoadingVars: boolean;
  isUpdatingStock: boolean;
  onToggleStock: () => void;
  isUpdatingStatus: boolean;
  onToggleStatus: () => void;
  updatingVarStock: Set<string>;
  onToggleVariationStock: (v: WooVariation) => void;
  onUpdate: (id: number, field: string, val: string, type: string, parentId?: number) => void;
  showToast: (msg: string, type: "success"|"error"|"loading") => void;
}) {
  const isVar = p.type === 'variable';
  const stockStatus: StockState = p.stock_status === "outofstock" ? "outofstock" : "instock";
  const isPublished = p.status !== 'private';

  return (
    <>
      <tr className={`group border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${isVar ? "border-l-2 border-l-purple-300" : "border-l-2 border-l-transparent"}`}>
        <td className="px-2 py-3 w-10">
          {isVar ? (
            <button
              onClick={onToggleExpand}
              className={`p-1.5 rounded-lg transition-colors ${expanded ? "bg-purple-100 text-purple-600" : "text-slate-300 hover:text-slate-600 hover:bg-slate-100"}`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-7 h-7" />
          )}
        </td>
        <td className="px-3 py-3 hidden md:table-cell">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{p.id}</span>
        </td>
        <td className="px-3 py-3 hidden sm:table-cell">
          <EditableCell id={p.id} field="sku" val={p.sku} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} />
        </td>
        <td className="px-3 py-3 max-w-[220px]">
          <div className="font-medium text-slate-800 leading-snug">
            <EditableCell id={p.id} field="name" val={p.name} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {/* Type badge — always visible on mobile, hidden md+ (shown in dedicated col) */}
            <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold md:hidden ${
              isVar ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
            }`}>
              {isVar ? "Variable" : "Simple"}
            </span>
            {p.sku && <span className="sm:hidden text-[10px] text-slate-400 font-mono truncate">{p.sku}</span>}
          </div>
        </td>
        <td className="px-3 py-3 hidden md:table-cell">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
            isVar
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-sky-50 text-sky-700 border-sky-200"
          }`}>
            {isVar ? "Variable" : "Simple"}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stockStatus === "instock" ? "bg-green-500" : "bg-red-400"}`} />
            <span className={`text-xs font-medium ${stockStatus === "instock" ? "text-green-700" : "text-red-600"}`}>
              {stockStatus === "instock" ? "In Stock" : "Habis"}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 hidden sm:table-cell">
          {isVar
            ? <span className="text-slate-300 text-xs italic">per variasi</span>
            : <EditableCell id={p.id} field="regular_price" val={p.regular_price} type="number" prodType="simple" prefix="Rp " productName={p.name} onUpdate={onUpdate} showToast={showToast} />
          }
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1.5">
            {/* Stock toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleStock(); }}
                disabled={isUpdatingStock}
                role="switch"
                aria-checked={stockStatus === "instock"}
                title={stockStatus === "instock" ? "Klik untuk Habis" : "Klik untuk In Stock"}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  stockStatus === "instock" ? "bg-green-500" : "bg-slate-300"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  stockStatus === "instock" ? "translate-x-[18px]" : "translate-x-0.5"
                }`} />
              </button>
              <span className={`text-[11px] font-medium leading-none ${stockStatus === "instock" ? "text-green-700" : "text-slate-400"}`}>
                {isUpdatingStock ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : stockStatus === "instock" ? "Ada" : "Habis"}
              </span>
            </div>
            {/* Status (Publish / Private) */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
              disabled={isUpdatingStatus}
              title={isPublished ? "Klik untuk Private" : "Klik untuk Publish"}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors w-fit disabled:opacity-40 disabled:cursor-not-allowed ${
                isPublished
                  ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
              }`}
            >
              {isUpdatingStatus
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : isPublished ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />
              }
              {isPublished ? "Publish" : "Private"}
            </button>
          </div>
        </td>
      </tr>

      {expanded && isVar && (
        isLoadingVars ? (
          <tr className="bg-slate-50 border-l-4 border-l-purple-300">
            <td colSpan={8} className="px-8 py-4 text-center text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading variations...
            </td>
          </tr>
        ) : varCache.length > 0 ? (
          varCache.map((v) => {
            const varInStock = v.stock_status !== "outofstock";
            return (
              <tr key={v.id} className="bg-violet-50/40 border-b border-slate-100 border-l-2 border-l-purple-400 hover:bg-violet-50">
                <td className="px-2 py-2 w-10">
                  <div className="flex justify-center">
                    <div className="w-px h-4 bg-purple-200" />
                  </div>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-50 px-1.5 py-0.5 rounded">#{v.id}</span>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <EditableCell id={v.id} parentId={p.id} field="sku" val={v.sku} type="text" prodType="variation" productName={`${p.name} — Variasi #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium">
                    <ChevronRight className="w-3 h-3 text-purple-300 shrink-0" />
                    <span className="truncate">{v.attributes?.map((a) => `${a.name}: ${a.option}`).join(" • ") || "Variation"}</span>
                  </div>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                    Var
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${varInStock ? "bg-green-500" : "bg-red-400"}`} />
                    <span className={`text-[11px] font-medium ${varInStock ? "text-green-700" : "text-red-600"}`}>
                      {varInStock ? "Ada" : "Habis"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <EditableCell id={v.id} parentId={p.id} field="regular_price" val={v.regular_price} type="number" prodType="variation" prefix="Rp " productName={`${p.name} — Variasi #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleVariationStock(v)}
                      disabled={updatingVarStock.has(`${p.id}-${v.id}`)}
                      role="switch"
                      aria-checked={varInStock}
                      title={varInStock ? "Klik untuk Habis" : "Klik untuk Ada"}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                        varInStock ? "bg-green-500" : "bg-slate-300"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        varInStock ? "translate-x-[18px]" : "translate-x-0.5"
                      }`} />
                    </button>
                    {updatingVarStock.has(`${p.id}-${v.id}`) && (
                      <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        ) : (
          <tr className="bg-slate-50 border-l-4 border-l-purple-300">
            <td colSpan={8} className="px-8 py-4 text-center text-slate-500 text-sm italic">
              No variations found for this product.
            </td>
          </tr>
        )
      )}
    </>
  );
}

// ── ProductCard — mobile card view ──────────────────────────────────────────
function ProductCard({ product: p, expanded, onToggleExpand, varCache, isLoadingVars, isUpdatingStock, onToggleStock, isUpdatingStatus, onToggleStatus, updatingVarStock, onToggleVariationStock, onUpdate, showToast }: {
  product: WooProduct;
  expanded: boolean;
  onToggleExpand: () => void;
  varCache: WooVariation[];
  isLoadingVars: boolean;
  isUpdatingStock: boolean;
  onToggleStock: () => void;
  isUpdatingStatus: boolean;
  onToggleStatus: () => void;
  updatingVarStock: Set<string>;
  onToggleVariationStock: (v: WooVariation) => void;
  onUpdate: (id: number, field: string, val: string, type: string, parentId?: number) => void;
  showToast: (msg: string, type: "success" | "error" | "loading") => void;
}) {
  const isVar = p.type === 'variable';
  const stockStatus: StockState = p.stock_status === "outofstock" ? "outofstock" : "instock";
  const isPublished = p.status !== 'private';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-3.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-bold tracking-wide ${
                isVar ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
              }`}>
                {isVar ? "Variable" : "Simple"}
              </span>
              <span className="text-[10px] font-mono text-slate-300">#{p.id}</span>
            </div>
            <div className="font-semibold text-slate-800 text-[15px] leading-snug">
              <EditableCell id={p.id} field="name" val={p.name} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} />
            </div>
            {p.sku && (
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">SKU: <EditableCell id={p.id} field="sku" val={p.sku} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} /></div>
            )}
          </div>
          {isVar && (
            <button
              onClick={onToggleExpand}
              className={`p-2.5 rounded-xl transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center border ${
                expanded
                  ? "bg-purple-100 text-purple-600 border-purple-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
              }`}
              aria-label={expanded ? "Tutup variasi" : "Lihat variasi"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Footer: stock + price + controls */}
      <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
        {/* Left info */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stockStatus === "instock" ? "bg-green-500" : "bg-red-400"}`} />
            <span className={`text-xs font-semibold ${stockStatus === "instock" ? "text-green-700" : "text-red-600"}`}>
              {stockStatus === "instock" ? "In Stock" : "Out of Stock"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono">
            {isVar
              ? <span className="italic text-slate-300">Harga per variasi</span>
              : <EditableCell id={p.id} field="regular_price" val={p.regular_price} type="number" prodType="simple" prefix="Rp " productName={p.name} onUpdate={onUpdate} showToast={showToast} />
            }
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Stock toggle */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStock(); }}
              disabled={isUpdatingStock}
              role="switch"
              aria-checked={stockStatus === "instock"}
              title={stockStatus === "instock" ? "Klik untuk Habis" : "Klik untuk Ada"}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                stockStatus === "instock" ? "bg-green-500" : "bg-slate-300"
              } disabled:opacity-40`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                stockStatus === "instock" ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
            <span className="text-[9px] text-slate-400 font-medium">Stok</span>
          </div>
          {/* Status toggle */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
              disabled={isUpdatingStatus}
              title={isPublished ? "Klik untuk Private" : "Klik untuk Publish"}
              className={`inline-flex items-center justify-center h-7 w-12 rounded-full border transition-colors disabled:opacity-40 ${
                isPublished
                  ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
              }`}
            >
              {isUpdatingStatus
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : isPublished ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />
              }
            </button>
            <span className="text-[9px] text-slate-400 font-medium">{isPublished ? "Publish" : "Private"}</span>
          </div>
        </div>
      </div>

      {/* Variations (expanded) */}
      {expanded && isVar && (
        <div className="border-t border-purple-100 bg-violet-50/60">
          {isLoadingVars ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Loading variasi...
            </div>
          ) : varCache.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 italic">Tidak ada variasi.</div>
          ) : (
            <div className="divide-y divide-purple-100/60">
              {varCache.map((v) => {
                const varInStock = v.stock_status !== "outofstock";
                return (
                  <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <ChevronRight className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{v.attributes?.map(a => `${a.name}: ${a.option}`).join(" • ") || "Variation"}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 pl-4.5">
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${varInStock ? "bg-green-500" : "bg-red-400"}`} />
                          <span className={`text-[10px] font-medium ${varInStock ? "text-green-700" : "text-red-600"}`}>
                            {varInStock ? "Ada" : "Habis"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          <EditableCell id={v.id} parentId={p.id} field="regular_price" val={v.regular_price} type="number" prodType="variation" prefix="Rp " productName={`${p.name} #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleVariationStock(v)}
                      disabled={updatingVarStock.has(`${p.id}-${v.id}`)}
                      role="switch"
                      aria-checked={varInStock}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                        varInStock ? "bg-green-500" : "bg-slate-300"
                      } disabled:opacity-40`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        varInStock ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableCell({ id, parentId, field, val, type, prodType, prefix = "", productName = "", onUpdate, showToast }: {
  id: number;
  parentId?: number;
  field: "sku" | "name" | "regular_price";
  val: string;
  type: "text" | "number";
  prodType: "simple" | "variation";
  prefix?: string;
  productName?: string;
  onUpdate: (id: number, field: string, val: string, type: string, parentId?: number) => void;
  showToast: (msg: string, type: "success"|"error"|"loading") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(val || "");
  const [saving, setSaving] = useState(false);

  // Sync state if prop changes
  useEffect(() => {
    setValue(val || "");
  }, [val]);

  const handleSave = async () => {
    if (value === (val || "")) {
      setEditing(false);
      return;
    }
    
    setSaving(true);
    showToast("Saving...", "loading");
    try {
      const endpoint = prodType === 'variation' && parentId 
        ? `products/${parentId}/variations/${id}` 
        : `products/${id}`;
        
      await wooFetch(endpoint, 'PUT', { [field]: value });
      onUpdate(id, field, value, prodType, parentId);
      const actionMap: Record<string, string> = { sku: "update_sku", name: "update_name", regular_price: "update_price" };
      logActivity({ action: actionMap[field] ?? `update_${field}`, product_id: id, product_name: productName || undefined, field, old_value: val || "", new_value: value });
      showToast("Saved successfully!", "success");
      setEditing(false);
    } catch (err: any) {
      showToast("Failed to save: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setValue(val || "");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 relative z-10" onClick={e => e.stopPropagation()}>
        <input 
          autoFocus
          type={type}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-full min-w-[80px] max-w-[160px] px-2 py-1 text-sm border border-blue-500 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
        <button onClick={handleSave} disabled={saving} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setValue(val||""); setEditing(false); }} disabled={saving} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="group inline-flex items-center gap-2 cursor-pointer px-2 py-1 -ml-2 rounded hover:bg-slate-200/50 transition-colors"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      <span>
        {value ? (
          <>
            <span className="opacity-60 text-xs mr-0.5">{prefix}</span>
            {type === 'number' ? Number(value).toLocaleString('id-ID') : value}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </span>
      <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
