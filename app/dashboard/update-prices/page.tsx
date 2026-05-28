"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentProfile, type UserProfile } from "@/lib/profile";
import type { ProductWithStatus } from "@/app/api/sync/products/route";
import { Search, RefreshCw, AlertCircle, Save, CheckCircle2, ChevronDown, X } from "lucide-react";

function formatRp(raw: string | null | undefined) {
  if (!raw) return "—";
  const cleaned = raw.replace(/[Rp\s.]/gi, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw;
  return "Rp " + num.toLocaleString("id-ID");
}

function MultiSelectDropdown({ 
  options, 
  selected, 
  onChange, 
  placeholder,
  searchPlaceholder 
}: { 
  options: string[], 
  selected: string[], 
  onChange: (val: string[]) => void, 
  placeholder: string,
  searchPlaceholder: string 
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
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 w-full md:w-56 text-left border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm flex items-center justify-between transition-colors hover:border-blue-300"
      >
        <span className="truncate">
          {selected.length === 0 ? placeholder : `${selected.length} ${placeholder.replace("Semua ", "")} dipilih`}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full min-w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[350px]">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input 
              type="text" 
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto p-2 flex-1">
            {filteredOptions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Tidak ditemukan</p>
            ) : (
              filteredOptions.map(opt => (
                <label key={opt} className="flex items-center gap-2.5 px-2 py-2 hover:bg-slate-50 cursor-pointer rounded-lg text-sm transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selected.includes(opt)}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "loading" } | null>(null);

  // Edits tracking
  const [edits, setEdits] = useState<Record<string, { cp: string; price: string }>>({});
  const [saving, setSaving] = useState(false);

  // Extract unique filter options from loaded products
  const uniqueCategories = Array.from(new Set(products.map(p => p["KATEGORI"]).filter(Boolean))).sort();
  const uniqueBrands = Array.from(new Set(products.map(p => p["NAMA BRAND"]).filter(Boolean))).sort();
  const uniqueStatuses = Array.from(new Set(products.map(p => p["STATUS"]).filter(Boolean))).sort();

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
      setProfile(p);
      loadProducts(p?.pic_category ?? null);
    });
  }, [loadProducts]);

  const handleEditChange = (kode: string, field: "cp" | "price", value: string) => {
    setEdits((prev) => {
      const current = prev[kode] || { 
        cp: products.find(p => p["Kode Accurate"] === kode)?.["CP"] || "", 
        price: products.find(p => p["Kode Accurate"] === kode)?.["PRICE"] || "" 
      };
      return { ...prev, [kode]: { ...current, [field]: value } };
    });
  };

  const handleSaveAll = async () => {
    const keys = Object.keys(edits);
    if (keys.length === 0) return;

    setSaving(true);
    showToast(`Menyimpan ${keys.length} perubahan...`, "loading");
    
    const updates = keys.map(kode => ({
      kode_accurate: kode,
      cp: edits[kode].cp,
      price: edits[kode].price
    }));

    try {
      const res = await fetch("/api/sync/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      showToast("Perubahan harga berhasil disimpan!", "success");
      
      // Update local state to reflect new values and clear edits
      setProducts(prev => prev.map(p => {
        if (edits[p["Kode Accurate"] || ""]) {
          return {
            ...p,
            "CP": edits[p["Kode Accurate"] || ""].cp,
            "PRICE": edits[p["Kode Accurate"] || ""].price
          };
        }
        return p;
      }));
      setEdits({});
      
    } catch (err: unknown) {
      showToast("Gagal menyimpan: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search.trim() || 
      (p["Kode Accurate"] ?? "").toLowerCase().includes(q) ||
      (p["NAMA BARANG"] ?? "").toLowerCase().includes(q) ||
      (p["KATEGORI"] ?? "").toLowerCase().includes(q);

    const matchCat = catFilter.length === 0 || catFilter.includes(p["KATEGORI"] || "");
    const matchBrand = brandFilter.length === 0 || brandFilter.includes(p["NAMA BRAND"] || "");
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(p["STATUS"] || "Aktif"); // Default to Aktif if empty

    return matchSearch && matchCat && matchBrand && matchStatus;
  });

  const isAdmin = profile?.role === "admin";
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0 shadow-sm z-10 sticky top-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Update Harga Khusus</h2>
          <p className="text-sm text-slate-500 mt-1">
            Kelola Harga Modal (CP) dan Harga Dealer di sini. (Kategori: {isAdmin ? "Semua" : profile?.pic_category})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadProducts(profile?.pic_category ?? null)}
            disabled={loading || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleSaveAll}
            disabled={!hasEdits || saving}
            className={`flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-md ${
              hasEdits && !saving ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30" : "bg-slate-300 shadow-none cursor-not-allowed"
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Filters */}
        <div className="mb-4 flex flex-col md:flex-row gap-3 shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode, nama, kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
            />
          </div>
          
          <MultiSelectDropdown 
            options={uniqueCategories as string[]}
            selected={catFilter}
            onChange={setCatFilter}
            placeholder="Semua Kategori"
            searchPlaceholder="Cari Kategori..."
          />

          <MultiSelectDropdown 
            options={uniqueBrands as string[]}
            selected={brandFilter}
            onChange={setBrandFilter}
            placeholder="Semua Brand"
            searchPlaceholder="Cari Brand..."
          />

          <MultiSelectDropdown 
            options={uniqueStatuses as string[]}
            selected={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status"
            searchPlaceholder="Cari Status..."
          />

          {(catFilter.length > 0 || brandFilter.length > 0 || statusFilter.length > 0) && (
            <button 
              onClick={() => { setCatFilter([]); setBrandFilter([]); setStatusFilter([]); }}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
              Reset Filter
            </button>
          )}
        </div>

        {/* Product List */}
        <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm text-slate-500">Memuat data produk...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-400 font-medium">Tidak ada produk ditemukan.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3 w-40">Harga SRP (SP)</th>
                    <th className="px-4 py-3 w-48">Harga Modal (CP)</th>
                    <th className="px-4 py-3 w-48">Harga Dealer (PRICE)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => {
                    const kode = p["Kode Accurate"] ?? "";
                    const isEdited = edits[kode] !== undefined;
                    const cpValue = isEdited ? edits[kode].cp : (p["CP"] || "");
                    const priceValue = isEdited ? edits[kode].price : (p["PRICE"] || "");

                    return (
                      <tr key={kode} className={`hover:bg-slate-50 transition-colors ${isEdited ? "bg-blue-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{kode}</span>
                              {p["KATEGORI"] && (
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                                  {p["KATEGORI"]}
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-slate-800">{p["NAMA BARANG"]}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-600">{formatRp(p["SP"])}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={cpValue}
                            onChange={(e) => handleEditChange(kode, "cp", e.target.value)}
                            placeholder="Contoh: 1.500.000"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={priceValue}
                            onChange={(e) => handleEditChange(kode, "price", e.target.value)}
                            placeholder="Contoh: 1.800.000"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white font-medium text-emerald-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 animate-in slide-in-from-bottom-4 ${
          toast.type === "success" ? "bg-white border-green-200 text-green-800 shadow-green-100" :
          toast.type === "error" ? "bg-white border-red-200 text-red-700 shadow-red-100" :
          "bg-white border-blue-200 text-blue-700 shadow-blue-100"
        }`}>
          {toast.type === "loading"
            ? <RefreshCw className="w-5 h-5 animate-spin text-blue-500 shrink-0" />
            : toast.type === "success"
              ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
