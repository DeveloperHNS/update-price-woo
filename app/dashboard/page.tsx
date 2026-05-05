"use client";

import { useEffect, useMemo, useState } from "react";
import { consumePendingProduct, wooFetch, WooProduct, WooVariation } from "@/lib/api";
import { Search, ChevronDown, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, Edit2, X, Check } from "lucide-react";

type WooCategory = {
  id: number;
  name: string;
  parent: number;
  count: number;
};

const PER_PAGE = 20;

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

  // Toast
  const [toast, setToast] = useState<{msg: string, type: "success"|"error"|"loading"} | null>(null);

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
          _fields: "id,name,sku,type,regular_price,parent",
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
          { _fields: "id,sku,regular_price,attributes", per_page: 100, page: 1 }
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

  const firstEntry = products.length > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const lastEntry = (page - 1) * PER_PAGE + products.length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Topbar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-xl font-bold text-slate-800">Manage Products</h2>
        <button 
          onClick={() => {
            setExpanded(new Set());
            setVarCache({});
            setVarLoading(new Set());
            setPage(1);
            setDebouncedSearch(search.trim());
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search name, SKU (fuzzy)..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Category Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowCatDD(!showCatDD)}
            className="flex items-center justify-between gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 min-w-[200px] hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            <span className="truncate max-w-[160px]">{selectedCatName}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showCatDD && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCatDD(false)} />
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-20 overflow-hidden flex flex-col max-h-80">
                <div className="p-2 border-b border-slate-100">
                  <input 
                    type="text" 
                    placeholder="Search categories..." 
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="overflow-y-auto p-1 flex-1">
                  <button
                    onClick={() => { setSelCatId(null); setShowCatDD(false); setPage(1); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 flex justify-between ${selCatId === null ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"}`}
                  >
                    All Categories
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded">{products.length}</span>
                  </button>
                  {catTree.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelCatId(c.id); setShowCatDD(false); setPage(1); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 flex justify-between items-center ${selCatId === c.id ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"}`}
                    >
                      <span className="truncate">
                        <span className="text-slate-300 mr-1">{'—'.repeat(c.depth)}</span>
                        {c.name}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded ml-2 shrink-0">{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {selCatId !== null && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium">
            {selectedCatName}
            <button onClick={() => setSelCatId(null)} className="hover:text-blue-900 rounded-full p-0.5 hover:bg-blue-200">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="ml-auto text-sm text-slate-500 font-medium">
          {products.length} results (page {page})
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
            <p>Loading products from WooCommerce...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <AlertCircle className="w-8 h-8 mb-4" />
            <p>{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <p>No products found matching your criteria.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Regular Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => (
                <ProductRow 
                  key={p.id} 
                  product={p} 
                  expanded={expanded.has(p.id)}
                  onToggleExpand={() => toggleExpand(p.id)}
                  varCache={varCache[p.id] || []}
                  isLoadingVars={varLoading.has(p.id)}
                  onUpdate={(id: number, field: string, val: string, type: string, parentId?: number) => {
                    // We'll pass a function to update local state after successful PUT
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
                  }}
                  showToast={showToast}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 shrink-0">
        <div className="text-sm text-slate-500">
          Showing {firstEntry} to {lastEntry} entries
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-slate-700 px-2">
            Page {page}
          </span>
          <button 
            disabled={!hasNextPage || loading}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium z-50 animate-in slide-in-from-bottom-5 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {toast.type === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
           toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
           <AlertCircle className="w-4 h-4 text-red-500" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Sub-components
// ---------------------------------------------------------

function ProductRow({ product: p, expanded, onToggleExpand, varCache, isLoadingVars, onUpdate, showToast }: {
  product: WooProduct;
  expanded: boolean;
  onToggleExpand: () => void;
  varCache: WooVariation[];
  isLoadingVars: boolean;
  onUpdate: (id: number, field: string, val: string, type: string, parentId?: number) => void;
  showToast: (msg: string, type: "success"|"error"|"loading") => void;
}) {
  const isVar = p.type === 'variable';

  return (
    <>
      <tr className="hover:bg-slate-50 group">
        <td className="px-4 py-3">
          {isVar && (
            <button 
              onClick={onToggleExpand}
              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{p.id}</td>
        <td className="px-4 py-3">
          <EditableCell id={p.id} field="sku" val={p.sku} type="text" prodType="simple" onUpdate={onUpdate} showToast={showToast} />
        </td>
        <td className="px-4 py-3 font-medium text-slate-800">
          <EditableCell id={p.id} field="name" val={p.name} type="text" prodType="simple" onUpdate={onUpdate} showToast={showToast} />
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isVar ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {isVar ? 'Variable' : 'Simple'}
          </span>
        </td>
        <td className="px-4 py-3 font-mono">
          {isVar ? <span className="text-slate-400 text-xs italic">— per variation</span> : 
            <EditableCell id={p.id} field="regular_price" val={p.regular_price} type="number" prodType="simple" prefix="Rp " onUpdate={onUpdate} showToast={showToast} />}
        </td>
      </tr>

      {expanded && isVar && (
        isLoadingVars ? (
          <tr className="bg-slate-50 border-l-4 border-l-purple-300">
            <td colSpan={6} className="px-8 py-4 text-center text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading variations...
            </td>
          </tr>
        ) : varCache.length > 0 ? (
          varCache.map((v) => (
            <tr key={v.id} className="bg-slate-50 border-l-4 border-l-purple-300 hover:bg-slate-100">
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2 text-slate-400 font-mono text-xs">#{v.id}</td>
              <td className="px-4 py-2">
                <EditableCell id={v.id} parentId={p.id} field="sku" val={v.sku} type="text" prodType="variation" onUpdate={onUpdate} showToast={showToast} />
              </td>
              <td className="px-4 py-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-px bg-slate-300"></div>
                  {v.attributes?.map((a) => `${a.name}: ${a.option}`).join(' • ') || 'Variation'}
                </div>
              </td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600 uppercase tracking-wider">
                  Var
                </span>
              </td>
              <td className="px-4 py-2 font-mono">
                <EditableCell id={v.id} parentId={p.id} field="regular_price" val={v.regular_price} type="number" prodType="variation" prefix="Rp " onUpdate={onUpdate} showToast={showToast} />
              </td>
            </tr>
          ))
        ) : (
          <tr className="bg-slate-50 border-l-4 border-l-purple-300">
            <td colSpan={6} className="px-8 py-4 text-center text-slate-500 text-sm italic">
              No variations found for this product.
            </td>
          </tr>
        )
      )}
    </>
  );
}

function EditableCell({ id, parentId, field, val, type, prodType, prefix = "", onUpdate, showToast }: {
  id: number;
  parentId?: number;
  field: "sku" | "name" | "regular_price";
  val: string;
  type: "text" | "number";
  prodType: "simple" | "variation";
  prefix?: string;
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
