import { useState } from "react";
import { Search, ChevronDown, RefreshCw, SlidersHorizontal, X } from "lucide-react";

export type FilterCategory = {
  id: number;
  name: string;
  depth: number;
  count: number;
};

type ProductFiltersProps = {
  productsCount: number;
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  search: string;
  setSearch: (search: string) => void;
  selCatId: number | null;
  setSelCatId: (id: number | null) => void;
  catTree: FilterCategory[];
  onReload: () => void;
  totalProductsAvailable?: number; // optionally display total count available for all categories
};

export function ProductFilters({
  productsCount,
  loading,
  page,
  setPage,
  search,
  setSearch,
  selCatId,
  setSelCatId,
  catTree,
  onReload,
  totalProductsAvailable
}: ProductFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCatDD, setShowCatDD] = useState(false);
  const [catSearch, setCatSearch] = useState("");

  const selectedCatName = selCatId === null
    ? "Semua Kategori"
    : catTree.find(c => c.id === selCatId)?.name || "Kategori tidak diketahui";

  const filteredCats = catTree.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0 gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-800 leading-tight truncate">Manage Products</h2>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
            {loading ? "Loading..." : `${productsCount} produk — halaman ${page}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: filter toggle */}
          <button
            onClick={() => setFilterOpen(f => !f)}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filterOpen || selCatId !== null || search
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
            onClick={onReload}
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
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{totalProductsAvailable || productsCount}</span>
                    </button>
                    {filteredCats.map(c => (
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
            {productsCount} hasil
          </span>
        </div>
      </div>
    </>
  );
}
