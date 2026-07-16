"use client";

import { AlertCircle, CheckCircle2, RefreshCw, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { WooProduct, WooVariation } from "@/lib/api";
import Link from "next/link";
import { getCurrentProfile, parseCategoryAccess, type UserProfile } from "@/lib/profile";
import { ProductRow, ProductCard } from "./components/manage/ProductViews";
import { ProductFilters } from "./components/manage/ProductFilters";
import { useWooProducts } from "@/hooks/useWooProducts";

export default function ManageProducts() {
  const {
    products,
    setProducts,
    loading,
    error,
    profile,
    search,
    setSearch,
    debouncedSearch,
    setDebouncedSearch,
    selCatId,
    setSelCatId,
    page,
    setPage,
    hasNextPage,
    expanded,
    setExpanded,
    varCache,
    setVarCache,
    varLoading,
    setVarLoading,
    updatingStock,
    updatingVarStock,
    updatingStatus,
    deleting,
    productToDelete,
    setProductToDelete,
    toast,
    showToast,
    mappedPrices,
    sortField,
    sortOrder,
    handleSort,
    sortedProducts,
    toggleExpand,
    catTree,
    toggleProductStock,
    toggleVariationStock,
    toggleProductStatus,
    confirmDelete,
    PER_PAGE
  } = useWooProducts();

  const firstEntry = products.length > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const lastEntry = (page - 1) * PER_PAGE + products.length;

  return (
    <div className="flex flex-col h-full bg-white">
      <ProductFilters
        productsCount={products.length}
        loading={loading}
        page={page}
        setPage={setPage}
        search={search}
        setSearch={setSearch}
        selCatId={selCatId}
        setSelCatId={setSelCatId}
        catTree={catTree}
        onReload={() => {
          setExpanded(new Set());
          setVarCache({});
          setVarLoading(new Set());
          setPage(1);
          setDebouncedSearch(search.trim());
        }}
        totalProductsAvailable={products.length}
      />

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
          isDeleting: deleting.has(p.id),
          onDelete: () => setProductToDelete(p),
          updatingVarStock,
          onToggleVariationStock: (v: WooVariation) => toggleVariationStock(p, v),
          onUpdate: sharedOnUpdate,
          showToast,
          mappedPrices,
          isAdmin: profile?.role === "admin",
        });

        return (
          <>
            {/* ── Desktop table (sm+) ── */}
            <div className="hidden sm:flex flex-col flex-1 overflow-auto bg-white">
              <table className="w-full text-sm text-left min-w-[1000px] table-fixed">
                <thead className="sticky top-0 z-10">
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-100 border-b border-slate-200">
                    <th className="w-10 px-3 py-2.5"></th>
                    <th
                      onClick={() => handleSort("id")}
                      className="w-20 px-3 py-2.5 hidden md:table-cell cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>ID</span>
                        {sortField === "id" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("sku")}
                      className="w-28 px-3 py-2.5 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>SKU</span>
                        {sortField === "sku" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("name")}
                      className="px-3 py-2.5 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Nama Produk</span>
                        {sortField === "name" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("type")}
                      className="w-28 px-3 py-2.5 hidden md:table-cell cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Tipe</span>
                        {sortField === "type" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("stock_status")}
                      className="w-28 px-3 py-2.5 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Stok</span>
                        {sortField === "stock_status" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("regular_price")}
                      className="w-36 px-3 py-2.5 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Harga</span>
                        {sortField === "regular_price" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("sale_price")}
                      className="w-36 px-3 py-2.5 hidden lg:table-cell cursor-pointer hover:bg-slate-200 select-none transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Harga Potongan</span>
                        {sortField === "sale_price" ? (
                          sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="w-32 px-3 py-2.5">Kontrol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedProducts.map(p => <ProductRow key={p.id} {...sharedProps(p)} />)}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (<sm) ── */}
            <div className="sm:hidden flex-1 overflow-auto bg-slate-50">
              <div className="p-3 space-y-2.5 pb-6">
                {sortedProducts.map(p => <ProductCard key={p.id} {...sharedProps(p)} />)}
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

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Hapus Produk?</h3>
              <p className="text-sm text-slate-500 text-center leading-relaxed">
                Anda yakin ingin menghapus <span className="font-semibold text-slate-700">"{productToDelete.name}"</span>? Aksi ini bersifat permanen dan tidak bisa dibatalkan.
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setProductToDelete(null)}
                disabled={deleting.has(productToDelete.id)}
                className="flex-1 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <div className="w-px bg-slate-100" />
              <button
                onClick={confirmDelete}
                disabled={deleting.has(productToDelete.id)}
                className="flex-1 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting.has(productToDelete.id) ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Menghapus...</>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 max-w-xs ${toast.type === 'success' ? 'bg-white border-green-200 text-green-800 shadow-green-100' :
            toast.type === 'error' ? 'bg-white border-red-200 text-red-700 shadow-red-100' :
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

