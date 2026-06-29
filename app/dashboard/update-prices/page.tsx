"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProfile, type UserProfile } from "@/lib/profile";
import type { ProductWithStatus } from "@/app/api/sync/products/route";
import { Search, RefreshCw, AlertCircle, Save, CheckCircle2, ChevronDown, X, SlidersHorizontal, CloudDownload } from "lucide-react";
import { formatRp } from "@/lib/format";


function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const toggleOption = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };

  return (
    <div className="relative w-full sm:w-auto" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-2.5 w-full sm:w-52 text-left border rounded-xl text-sm outline-none bg-white transition-colors ${selected.length > 0
          ? "border-blue-400 bg-blue-50 text-blue-700"
          : "border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
      >
        <span className="truncate text-sm">
          {selected.length === 0
            ? placeholder
            : `${selected.length} dipilih`}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange([]); } }}
              className="p-0.5 hover:text-red-500 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[320px]">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto p-1.5 flex-1">
            {filteredOptions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Tidak ditemukan</p>
            ) : (
              filteredOptions.map(opt => (
                <label key={opt} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 cursor-pointer rounded-lg text-sm transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                  />
                  <span className="truncate text-slate-700">{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UpdatePricesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "loading" } | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [edits, setEdits] = useState<Record<string, { cp: string; price: string }>>({});
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, brandFilter, statusFilter]);

  const uniqueCategories = Array.from(new Set(products.map(p => p["KATEGORI"]).filter(Boolean))).sort() as string[];
  const uniqueBrands = Array.from(new Set(products.map(p => p["NAMA BRAND"]).filter(Boolean))).sort() as string[];
  const uniqueStatuses = Array.from(new Set(products.map(p => p["STATUS"]).filter(Boolean))).sort() as string[];

  const showToast = (msg: string, type: "success" | "error" | "loading") => {
    setToast({ msg, type });
    if (type !== "loading") setTimeout(() => setToast(null), 3500);
  };

  const loadProducts = useCallback(async (picCategory: string | null) => {
    setLoading(true);
    setEdits({});
    try {
      const params = new URLSearchParams({ tab: "all" });
      if (picCategory) params.set("pic_category", picCategory);
      const res = await fetch(`/api/sync/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products || []);
    } catch (err: unknown) {
      showToast("Gagal memuat produk: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p?.role === "product_staff") {
        router.replace("/dashboard");
        return;
      }
      setProfile(p);
      loadProducts(p?.pic_category ?? null);
    });
  }, [loadProducts, router]);

  const handlePullSync = async () => {
    setConfirmModal(false);
    setPulling(true);
    showToast("Sedang menarik data dari Google Sheet...", "loading");

    try {
      const res = await fetch("/api/sync/pull", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal menarik data");

      showToast(data.message || `Berhasil ditarik!`, "success");
      loadProducts(profile?.pic_category ?? null);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setPulling(false);
    }
  };

  const handleEditChange = (kode: string, field: "cp" | "price", value: string) => {
    setEdits((prev) => {
      const current = prev[kode] || {
        cp: products.find(p => p["Kode Accurate"] === kode)?.["CP"] || "",
        price: products.find(p => p["Kode Accurate"] === kode)?.["PRICE"] || "",
      };
      return { ...prev, [kode]: { ...current, [field]: value } };
    });
  };

  const handleSaveAll = async () => {
    const keys = Object.keys(edits);
    if (keys.length === 0) return;

    setSaving(true);
    showToast(`Menyimpan ${keys.length} perubahan...`, "loading");

    try {
      const res = await fetch("/api/sync/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: keys.map(kode => ({ kode_accurate: kode, cp: edits[kode].cp, price: edits[kode].price })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProducts(prev => prev.map(p => {
        const e = edits[p["Kode Accurate"] || ""];
        return e ? { ...p, "CP": e.cp, "PRICE": e.price } : p;
      }));
      setEdits({});
      showToast("Perubahan harga berhasil disimpan!", "success");
    } catch (err: unknown) {
      showToast("Gagal menyimpan: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    const q = search.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/) : [];

    const searchableText = `${p["Kode Accurate"] || ""} ${p["NAMA BARANG"] || ""} ${p["KATEGORI"] || ""}`.toLowerCase();
    const matchSearch = tokens.length === 0 || tokens.every(token => searchableText.includes(token));

    const matchCat = catFilter.length === 0 || catFilter.includes(p["KATEGORI"] || "");
    const matchBrand = brandFilter.length === 0 || brandFilter.includes(p["NAMA BRAND"] || "");
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(p["STATUS"] || "Aktif");
    return matchSearch && matchCat && matchBrand && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const isAdmin = profile?.role === "admin";
  const hasEdits = Object.keys(edits).length > 0;
  const activeFilterCount = catFilter.length + brandFilter.length + statusFilter.length;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Topbar ── */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shrink-0 shadow-sm sticky top-0 z-10">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-bold text-slate-800 truncate">Update Harga</h2>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
            Harga Modal (CP) & Dealer · Kategori: {isAdmin ? "Semua" : profile?.pic_category}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setConfirmModal(true)}
            disabled={loading || saving || pulling}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors disabled:opacity-50"
            title="Import semua data dari Google Sheet"
          >
            <CloudDownload className={`w-4 h-4 ${pulling ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">{pulling ? "Mengimport..." : "Import Data"}</span>
          </button>
          <button
            onClick={() => loadProducts(profile?.pic_category ?? null)}
            disabled={loading || saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!hasEdits || saving}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-md ${hasEdits && !saving
              ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
              : "bg-slate-300 shadow-none cursor-not-allowed"
              }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>
              {saving ? "Menyimpan..." : hasEdits ? `Simpan (${Object.keys(edits).length})` : "Simpan"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="px-4 py-3 sm:px-6 border-b border-slate-200 bg-white shrink-0">
        {/* Search + toggle button (always visible) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode, nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>

          {/* Mobile: toggle advanced filters */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border shrink-0 ${activeFilterCount > 0 || showFilters
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-white border-slate-200 text-slate-600"
              }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Dropdown filters — always visible on sm+, toggle on mobile */}
        <div className={`mt-2 flex-col sm:flex-row gap-2 flex-wrap ${showFilters ? "flex" : "hidden sm:flex"}`}>
          <MultiSelectDropdown
            options={uniqueCategories}
            selected={catFilter}
            onChange={setCatFilter}
            placeholder="Semua Kategori"
            searchPlaceholder="Cari Kategori..."
          />
          <MultiSelectDropdown
            options={uniqueBrands}
            selected={brandFilter}
            onChange={setBrandFilter}
            placeholder="Semua Brand"
            searchPlaceholder="Cari Brand..."
          />
          <MultiSelectDropdown
            options={uniqueStatuses}
            selected={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status"
            searchPlaceholder="Cari Status..."
          />
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setCatFilter([]); setBrandFilter([]); setStatusFilter([]); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-200 w-full sm:w-auto justify-center sm:justify-start"
            >
              <X className="w-3.5 h-3.5" /> Reset semua filter
            </button>
          )}
        </div>

        {/* Result count */}
        {!loading && (
          <p className="text-xs text-slate-400 mt-2">
            {filtered.length} produk{hasEdits ? ` · ${Object.keys(edits).length} diubah` : ""}
          </p>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm text-slate-500">Memuat data produk...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <AlertCircle className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium text-sm">Tidak ada produk ditemukan</p>
          </div>
        ) : (
          <>
            {/* ── Desktop table (sm+) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[780px] table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3 w-[120px] lg:w-36">Harga SRP</th>
                    <th className="px-4 py-3 w-[160px] lg:w-44">Harga Modal (CP)</th>
                    <th className="px-4 py-3 w-[160px] lg:w-44">Harga Dealer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedProducts.map((p) => {
                    const kode = p["Kode Accurate"] ?? "";
                    const isEdited = edits[kode] !== undefined;
                    const cpValue = isEdited ? edits[kode].cp : (p["CP"] || "");
                    const priceValue = isEdited ? edits[kode].price : (p["PRICE"] || "");

                    return (
                      <tr key={kode} className={`transition-colors ${isEdited ? "bg-blue-50/40" : "hover:bg-slate-50"}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {kode}
                            </span>
                            {p["KATEGORI"] && (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                                {p["KATEGORI"]}
                              </span>
                            )}
                            {isEdited && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                ● Diubah
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-slate-800 text-sm">{p["NAMA BARANG"]}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-slate-600">{formatRp(p["SP"])}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={cpValue}
                            onChange={(e) => handleEditChange(kode, "cp", e.target.value)}
                            placeholder="e.g. 1.500.000"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-colors ${isEdited ? "border-blue-300 bg-white" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={priceValue}
                            onChange={(e) => handleEditChange(kode, "price", e.target.value)}
                            placeholder="e.g. 1.800.000"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-emerald-700 transition-colors ${isEdited ? "border-blue-300 bg-white" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (<sm) ── */}
            <div className="sm:hidden p-3 space-y-2.5 pb-32">
              {paginatedProducts.map((p) => {
                const kode = p["Kode Accurate"] ?? "";
                const isEdited = edits[kode] !== undefined;
                const cpValue = isEdited ? edits[kode].cp : (p["CP"] || "");
                const priceValue = isEdited ? edits[kode].price : (p["PRICE"] || "");

                return (
                  <div
                    key={kode}
                    className={`bg-white rounded-2xl border p-4 shadow-sm transition-colors ${isEdited ? "border-blue-300 bg-blue-50/20" : "border-slate-200"
                      }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {kode}
                          </span>
                          {p["KATEGORI"] && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                              {p["KATEGORI"]}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 text-sm leading-snug">{p["NAMA BARANG"]}</p>
                      </div>
                      {isEdited && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full shrink-0">
                          Diubah
                        </span>
                      )}
                    </div>

                    {/* SRP (read-only) */}
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 mb-3">
                      <span className="text-xs text-slate-500">Harga SRP</span>
                      <span className="text-sm font-semibold text-slate-700">{formatRp(p["SP"])}</span>
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                          Modal (CP)
                        </label>
                        <input
                          type="text"
                          value={cpValue}
                          onChange={(e) => handleEditChange(kode, "cp", e.target.value)}
                          placeholder="e.g. 1.500.000"
                          className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isEdited ? "border-blue-300 bg-white" : "border-slate-200 bg-slate-50"
                            }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-600 mb-1.5 uppercase tracking-wide">
                          Dealer
                        </label>
                        <input
                          type="text"
                          value={priceValue}
                          onChange={(e) => handleEditChange(kode, "price", e.target.value)}
                          placeholder="e.g. 1.800.000"
                          className={`w-full px-3 py-2.5 border rounded-xl text-sm font-medium text-emerald-700 outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isEdited ? "border-blue-300 bg-white" : "border-slate-200 bg-slate-50"
                            }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Pagination Controls ── */}
      {totalPages > 1 && !loading && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-slate-200 shrink-0 gap-3 pb-24 sm:pb-3">
          <p className="text-sm text-slate-500 hidden sm:block">
            Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} dari {filtered.length} produk
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700 bg-white"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-medium text-slate-700 mx-2">
              Hal {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700 bg-white"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile sticky save button ── */}
      {hasEdits && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-lg z-20">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-70"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Menyimpan..." : `Simpan ${Object.keys(edits).length} Perubahan`}
          </button>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 bg-white max-w-xs sm:max-w-sm w-full ${toast.type === "success" ? "border-green-200 text-green-800 shadow-green-100" :
          toast.type === "error" ? "border-red-200 text-red-700 shadow-red-100" :
            "border-blue-200 text-blue-700 shadow-blue-100"
          }`}>
          {toast.type === "loading"
            ? <RefreshCw className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
            : toast.type === "success"
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <CloudDownload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Import Data Sheet?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Aksi ini akan menyedot <b>seluruh data</b> (6000+ baris) dari Google Sheet kamu secara otomatis. Proses ini akan memakan waktu beberapa detik. Lanjutkan?
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handlePullSync}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-colors flex items-center gap-2"
              >
                <CloudDownload className="w-4 h-4" /> Ya, Import Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
