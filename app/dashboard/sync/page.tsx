"use client";

import Papa from "papaparse";

import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentProfile, parseCategoryAccess, type UserProfile } from "@/lib/profile";
import { wooFetch } from "@/lib/api";
import type { ProductWithStatus } from "@/app/api/sync/products/route";
import {
  Search, RefreshCw, AlertCircle, CheckCircle2,
  Link2, Link2Off, ArrowRight, X, ChevronRight, Zap, Trash2, FileUp, EyeOff, Undo2, DownloadCloud
} from "lucide-react";
import { formatRp, parseProductName } from "@/lib/format";

type Tab = "unmatched" | "needs_review" | "matched" | "ignored";

type WooSearchResult = {
  id: number;
  name: string;
  sku: string;
  type: string;
  regular_price: string;
  variations?: number[];
  attributes?: any[];
};

type WooVariationResult = {
  id: number;
  sku: string;
  regular_price: string;
  attributes: { name: string; option: string }[];
};

type MatchTarget = {
  woo_product_id: number;
  woo_variation_id: number | null;
  woo_name: string;
  woo_sku_full: string;
};

const TAB_LABELS: Record<Tab, string> = {
  unmatched: "Belum Dimapping",
  needs_review: "Perlu Review",
  matched: "Sudah Dimapping",
  ignored: "Diabaikan"
};


export default function SyncPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [counts, setCounts] = useState({ unmatched: 0, needs_review: 0, matched: 0, ignored: 0 });
  const [tab, setTab] = useState<Tab>("unmatched");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "loading" } | null>(null);

  // CSV Automap state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [pullingSheet, setPullingSheet] = useState(false);

  // Custom Confirm Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    actionClass: string;
    onConfirm: () => void;
  } | null>(null);

  // Matching modal
  const [matchTarget, setMatchTarget] = useState<ProductWithStatus | null>(null);
  const [wooSearch, setWooSearch] = useState("");
  const [wooResults, setWooResults] = useState<WooSearchResult[]>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [selectedWoo, setSelectedWoo] = useState<MatchTarget | null>(null);
  const [variations, setVariations] = useState<WooVariationResult[]>([]);
  const [varLoading, setVarLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Syncing price
  const [syncingPrice, setSyncingPrice] = useState<Set<string>>(new Set());

  // Auto-mapping state
  const [autoMapping, setAutoMapping] = useState(false);
  const [autoMapProgress, setAutoMapProgress] = useState<{ total: number; current: number } | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "loading") => {
    setToast({ msg, type });
    if (type !== "loading") setTimeout(() => setToast(null), 3500);
  };

  const loadProducts = useCallback(async (currentTab: Tab, picCategory: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab: currentTab });
      if (picCategory) params.set("pic_category", picCategory);
      const res = await fetch(`/api/sync/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(data.products || []);
      setCounts(data.counts || { unmatched: 0, needs_review: 0, matched: 0 });
    } catch (err: unknown) {
      showToast("Gagal memuat produk: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentProfile().then((p) => {
      setProfile(p);
      loadProducts(tab, p?.pic_category ?? null);
    });
  }, [loadProducts, tab]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSearch("");
  };

  // Search WooCommerce products for matching
  useEffect(() => {
    if (!wooSearch.trim() || wooSearch.length < 2) {
      setWooResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setWooLoading(true);
      try {
        const query = wooSearch.trim();
        let promises: Promise<any>[] = [];

        if (/^#\d+$/.test(query)) {
          const idToSearch = query.substring(1);
          promises.push(
            wooFetch(`products/${idToSearch}`, "GET").then(p => p ? [p] : []).catch(() => [])
          );
        } else {
          promises = [
            wooFetch("products", "GET", undefined, { search: query, per_page: 10, _fields: "id,name,sku,type,regular_price,attributes" }),
            wooFetch("products", "GET", undefined, { sku: query, per_page: 10, _fields: "id,name,sku,type,regular_price,attributes" })
          ];

          if (/^\d+$/.test(query)) {
            promises.push(wooFetch(`products/${query}`, "GET").then(p => p ? [p] : []).catch(() => []));
          }

          // Fallback: cari dengan membuang kata-kata atribut (ukuran/angka)
          const words = query.split(/\s+/).filter(w => w.length > 0);
          if (words.length > 1) {
            const attrRegex = /^(\d+|gb|tb|mb|hz|mhz|ddr\d|gen\d.*|ram|rom|ssd|hdd|nvme|sata|inch|black|white|hitam|putih)$/i;
            const nonAttrWords = words.filter(w => !attrRegex.test(w));
            if (nonAttrWords.length > 0 && nonAttrWords.length < words.length) {
              promises.push(wooFetch("products", "GET", undefined, { search: nonAttrWords.join(" "), per_page: 10, _fields: "id,name,sku,type,regular_price,attributes" }).catch(() => []));
            }
            
            // Fallback: cari dengan kata terpanjang saja (biasanya merek/seri spesifik)
            const longestWord = [...words].sort((a,b) => b.length - a.length)[0];
            if (longestWord && longestWord.length > 3) {
              promises.push(wooFetch("products", "GET", undefined, { search: longestWord, per_page: 10, _fields: "id,name,sku,type,regular_price,attributes" }).catch(() => []));
            }
          }
        }

        const results = await Promise.all(promises);
        let combined = results.flat() as WooSearchResult[];
        
        const uniqueMap = new Map<number, WooSearchResult>();
        combined.forEach(p => {
          if (p && p.id && !uniqueMap.has(p.id)) uniqueMap.set(p.id, p);
        });

        let finalResults = Array.from(uniqueMap.values());

        // Fuzzy Client-Side Filter & Relevance Sort
        if (!/^#\d+$/.test(query) && query.length > 0) {
          const cleanQuery = query.toLowerCase().replace(/(\d+)\s*(gb|tb|mb|mhz|hz|inch)/g, "$1$2");
          const filterWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
          
          finalResults = finalResults.filter(p => {
            let searchableText = [
              p.name, 
              p.sku, 
              ...(p.attributes?.map((a: any) => typeof a.options === 'object' ? a.options.join(" ") : "") || []) // Di endpoint product, attributes format options
            ].join(" ").toLowerCase();
            searchableText = searchableText.replace(/(\d+)\s*(gb|tb|mb|mhz|hz|inch)/g, "$1$2");
            
            return filterWords.every(w => searchableText.includes(w));
          });
        }

        setWooResults(finalResults.filter((r) => !r.type || r.type !== "variation"));
      } catch (err: unknown) {
        showToast("Gagal cari di WooCommerce: " + (err instanceof Error ? err.message : "error"), "error");
      } finally {
        setWooLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [wooSearch]);

  const handleSelectWooProduct = async (p: WooSearchResult) => {
    if (p.type === "variable") {
      // Load variations so PIC can pick the specific variation
      setVarLoading(true);
      setSelectedWoo({ woo_product_id: p.id, woo_variation_id: null, woo_name: p.name, woo_sku_full: p.sku });
      try {
        const vars = await wooFetch(`products/${p.id}/variations`, "GET", undefined, {
          per_page: 100,
          _fields: "id,sku,regular_price,attributes",
        }) as WooVariationResult[];
        setVariations(vars);
      } catch {
        setVariations([]);
      } finally {
        setVarLoading(false);
      }
    } else {
      setSelectedWoo({ woo_product_id: p.id, woo_variation_id: null, woo_name: p.name, woo_sku_full: p.sku });
      setVariations([]);
    }
  };

  const handleSelectVariation = (v: WooVariationResult, parentId: number, parentName: string) => {
    const label = v.attributes.map((a) => `${a.name}: ${a.option}`).join(", ");
    setSelectedWoo({
      woo_product_id: parentId,
      woo_variation_id: v.id,
      woo_name: `${parentName} (${label})`,
      woo_sku_full: v.sku,
    });
  };

  const handleConfirmMatch = async () => {
    if (!matchTarget || !selectedWoo || !profile) return;
    setSaving(true);
    showToast("Menyimpan mapping...", "loading");
    try {
      const res = await fetch("/api/sync/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_accurate: matchTarget["Kode Accurate"],
          ...selectedWoo,
          triggered_by: profile.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Mapping berhasil disimpan!", "success");
      setMatchTarget(null);
      setSelectedWoo(null);
      setWooSearch("");
      setWooResults([]);
      setVariations([]);
      // Refresh
      loadProducts(tab, profile.pic_category);
    } catch (err: unknown) {
      showToast("Gagal menyimpan: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleIgnore = async (kode: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/sync/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_accurate: kode, action: "ignore", triggered_by: profile.id })
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("Produk disembunyikan!", "success");
      loadProducts(tab, profile.pic_category);
    } catch(err: any) {
      showToast("Gagal menyembunyikan: " + err.message, "error");
    }
  };

  const handleRestore = async (kode: string) => {
    if (!profile) return;
    try {
      const res = await fetch("/api/sync/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_accurate: kode, action: "restore", triggered_by: profile.id })
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("Produk dikembalikan ke Belum Dimapping!", "success");
      loadProducts(tab, profile.pic_category);
    } catch(err: any) {
      showToast("Gagal mengembalikan: " + err.message, "error");
    }
  };

  const handleUnmatch = async (kode: string) => {
    if (!profile) return;
    setConfirmDialog({
      title: "Lepas Mapping",
      message: "Yakin ingin melepas mapping produk ini? Produk akan kembali ke status 'Belum Dimapping'.",
      actionLabel: "Ya, Lepas",
      actionClass: "bg-rose-600 hover:bg-rose-700",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch("/api/sync/unmatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kode_accurate: kode, triggered_by: profile.id })
          });
          if (!res.ok) throw new Error(await res.text());
          showToast("Mapping dilepas!", "success");
          loadProducts(tab, profile.pic_category);
        } catch(err: any) {
          showToast("Gagal melepas mapping: " + err.message, "error");
        }
      }
    });
  };

  const handleSyncPrice = async (kode: string) => {
    if (!profile || syncingPrice.has(kode)) return;
    setSyncingPrice((prev) => new Set(prev).add(kode));
    showToast("Sync harga ke WooCommerce...", "loading");
    try {
      const res = await fetch("/api/sync/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_accurate: kode, triggered_by: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Harga berhasil disync!`, "success");
    } catch (err: unknown) {
      showToast("Gagal sync: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setSyncingPrice((prev) => {
        const n = new Set(prev);
        n.delete(kode);
        return n;
      });
    }
  };

  const handleAutoMap = async () => {
    if (!profile) return;
    const unmatched = products
      .filter((p) => p._status === "unmatched")
      .sort((a, b) => {
        const kodeA = a["Kode Accurate"] || "";
        const kodeB = b["Kode Accurate"] || "";
        if (kodeA.startsWith("2") && !kodeB.startsWith("2")) return -1;
        if (!kodeA.startsWith("2") && kodeB.startsWith("2")) return 1;
        return 0;
      });

    if (unmatched.length === 0) {
      showToast("Tidak ada produk unmatched", "error");
      return;
    }
    
    setConfirmDialog({
      title: "Mulai Auto Map Cerdas",
      message: `Anda akan mencocokkan ${unmatched.length} produk secara otomatis. Proses ini akan memakan waktu beberapa saat.`,
      actionLabel: "Mulai Auto Map",
      actionClass: "bg-blue-600 hover:bg-blue-700",
      onConfirm: async () => {
        setConfirmDialog(null);
        setAutoMapping(true);
        setAutoMapProgress({ total: unmatched.length, current: 0 });

        try {
          const BATCH_SIZE = 5;
          for (let i = 0; i < unmatched.length; i += BATCH_SIZE) {
            const batch = unmatched.slice(i, i + BATCH_SIZE).map(p => ({
              kode: p["Kode Accurate"] || "",
              nama: p["NAMA BARANG"] || "",
              brand: p["NAMA BRAND"] || ""
            }));

            const res = await fetch("/api/sync/automap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ products: batch, triggered_by: profile.id })
            });
            
            if (!res.ok) {
              console.error("Batch failed", await res.text());
            }

            setAutoMapProgress(prev => prev ? { ...prev, current: Math.min(prev.total, prev.current + BATCH_SIZE) } : null);
          }
          showToast("Auto Map selesai!", "success");
          loadProducts(tab, profile.pic_category);
        } catch (err: any) {
          showToast("Auto Map error: " + err.message, "error");
        } finally {
          setAutoMapping(false);
          setTimeout(() => setAutoMapProgress(null), 2000);
        }
      }
    });
  };

  const handlePullSheet = async () => {
    setConfirmDialog({
      title: "Konfirmasi Tarik Data GSheet",
      message: "Tarik data terbaru dari Google Sheet Master Data? Proses ini mungkin butuh waktu beberapa detik.",
      actionLabel: "Ya, Tarik Data",
      actionClass: "bg-teal-600 hover:bg-teal-700",
      onConfirm: async () => {
        setConfirmDialog(null);
        setPullingSheet(true);
        showToast("Sedang menarik data dari Google Sheet...", "loading");
        try {
          const res = await fetch("/api/sheet/pull", { method: "POST" });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Gagal menarik data");
          
          showToast(`Berhasil! ${data.upserted} produk diperbarui dari total ${data.total} baris.`, "success");
          loadProducts(tab, profile?.pic_category ?? null);
        } catch(err: any) {
          showToast("Error tarik data: " + err.message, "error");
        } finally {
          setPullingSheet(false);
        }
      }
    });
  };

  const handleUploadCsv = () => {
    csvInputRef.current?.click();
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    
    setCsvUploading(true);
    showToast("Mem-parsing CSV di browser...", "loading");

    // Note: Assuming PapaParse is available globally or imported
    // @ts-ignore
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        const wooProducts = data.map((r: any) => ({
           id: r.ID || r.id,
           type: r.Tipe || r.Type || r.type,
           sku: r.SKU || r.sku,
           name: r.Nama || r.Name || r.name,
           parent: r.Induk || r.Parent || r.parent
        })).filter(r => r.id && r.name);

        showToast(`Ditemukan ${wooProducts.length} produk di CSV. Memulai sinkronisasi...`, "loading");
        
        try {
           const BATCH_SIZE = 1000;
           let totalMatched = 0;
           for (let i = 0; i < wooProducts.length; i += BATCH_SIZE) {
              const batch = wooProducts.slice(i, i + BATCH_SIZE);
              const res = await fetch("/api/sync/automap-csv", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ wooProducts: batch, triggered_by: profile.id })
              });
              const resData = await res.json();
              if (!res.ok) throw new Error(resData.error || "Gagal memproses batch");
              totalMatched += resData.matched_count || 0;
           }
           showToast(`Berhasil auto-map ${totalMatched} produk dari CSV!`, "success");
           loadProducts(tab, profile.pic_category);
        } catch(err: any) {
           showToast("Error CSV: " + err.message, "error");
        } finally {
           setCsvUploading(false);
           if (csvInputRef.current) csvInputRef.current.value = "";
        }
      },
      error: (err: any) => {
        showToast("Gagal membaca CSV: " + err.message, "error");
        setCsvUploading(false);
      }
    });
  };

  const handleResetReview = async () => {
    if (!profile) return;
    setConfirmDialog({
      title: "Reset Perlu Review",
      message: "Yakin ingin mereset semua produk yang berstatus 'Perlu Review'? Produk akan kembali ke status 'Belum Dimapping'.",
      actionLabel: "Ya, Reset Semua",
      actionClass: "bg-red-600 hover:bg-red-700",
      onConfirm: async () => {
        setConfirmDialog(null);
        showToast("Mereset Perlu Review...", "loading");
        try {
          const res = await fetch("/api/sync/reset-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triggered_by: profile.id }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          showToast("Berhasil mereset!", "success");
          loadProducts(tab, profile.pic_category);
        } catch (err: any) {
          showToast("Gagal mereset: " + err.message, "error");
        }
      }
    });
  };

  const filtered = products.filter((p) => {
    // 1. Status filter
    if (statusFilter !== "ALL") {
      const pStatus = (p["STATUS"] ?? "").toUpperCase();
      if (statusFilter === "YA" && pStatus !== "YA") return false;
      if (statusFilter === "TIDAK" && pStatus !== "TIDAK") return false;
    }

    // 2. Search text filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p["Kode Accurate"] ?? "").toLowerCase().includes(q) ||
      (p["NAMA BARANG"] ?? "").toLowerCase().includes(q) ||
      (p["KATEGORI"] ?? "").toLowerCase().includes(q)
    );
  });

  const isAdmin = profile?.role === "admin";
  const canViewCP = profile?.role !== "product_staff" || (profile?.pic_category && profile.pic_category.split(",").includes("dealer"));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0 gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-800">Sync Product</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin ? "Semua kategori" : `Kategori: ${parseCategoryAccess(profile?.pic_category ?? null).erp ?? "—"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "needs_review" && (
            <button
              onClick={handleResetReview}
              disabled={loading || counts.needs_review === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Reset Perlu Review</span>
            </button>
          )}
          {tab === "unmatched" && (
            <>
              <input type="file" accept=".csv" className="hidden" ref={csvInputRef} onChange={handleCsvFileChange} />
              <button
                onClick={handleUploadCsv}
                disabled={loading || autoMapping || csvUploading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileUp className={`w-4 h-4 ${csvUploading ? "animate-pulse" : ""}`} />
                <span className="hidden lg:inline">{csvUploading ? "Memproses CSV..." : "Upload CSV Woo"}</span>
              </button>
              <button
                onClick={handleAutoMap}
                disabled={loading || autoMapping || csvUploading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 ${autoMapping ? "animate-pulse text-amber-300" : ""}`} />
                <span className="hidden sm:inline">{autoMapping ? "Memproses..." : "Auto Map Cerdas"}</span>
              </button>
            </>
          )}
          <button
            onClick={handlePullSheet}
            disabled={loading || autoMapping || pullingSheet}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <DownloadCloud className={`w-4 h-4 ${pullingSheet ? "animate-bounce" : ""}`} />
            <span className="hidden sm:inline">{pullingSheet ? "Menarik..." : "Tarik GSheet"}</span>
          </button>
          <button
            onClick={() => loadProducts(tab, profile?.pic_category ?? null)}
            disabled={loading || autoMapping}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Auto Map Progress Bar */}
      {autoMapProgress && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-blue-800">
              Proses Auto Map... ({autoMapProgress.current} / {autoMapProgress.total})
            </span>
            <span className="text-xs font-bold text-blue-600">
              {Math.round((autoMapProgress.current / autoMapProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((autoMapProgress.current / autoMapProgress.total) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 shrink-0 px-4">
        {(["unmatched", "needs_review", "matched", "ignored"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            {TAB_LABELS[t]}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${t === "unmatched" ? "bg-red-100 text-red-700" :
                t === "needs_review" ? "bg-amber-100 text-amber-700" :
                  t === "ignored" ? "bg-slate-200 text-slate-700" :
                    "bg-green-100 text-green-700"
              }`}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 px-4 py-2.5 border-b border-slate-100 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode, nama produk, kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="TIDAK">Aktif (TIDAK)</option>
            <option value="YA">Non-Aktif (YA)</option>
          </select>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <RefreshCw className="w-7 h-7 animate-spin text-blue-500 mb-3" />
            <p className="text-sm text-slate-500">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            {tab === "unmatched"
              ? <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
              : <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
            }
            <p className="text-sm text-slate-400">
              {tab === "unmatched" ? "Semua produk sudah dimapping!" : "Tidak ada data."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const kode = p["Kode Accurate"] ?? "";
              const isSyncing = syncingPrice.has(kode);
              const parsedName = parseProductName(p["NAMA BARANG"] ?? "");
              
              return (
                <div key={kode} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  {/* Left: product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {kode}
                      </span>
                      {p["KATEGORI"] && (
                        <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                          {p["KATEGORI"]}
                        </span>
                      )}
                      {p["STATUS"] && p["STATUS"].toLowerCase() !== "aktif" && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {p["STATUS"]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col mt-0.5">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {parsedName.name || "—"}
                      </p>
                      {parsedName.specs && (
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug truncate">
                          {parsedName.specs}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {p["SP"] && (
                        <span className="text-xs text-slate-600">
                          SRP: <span className="font-semibold">{formatRp(p["SP"])}</span>
                        </span>
                      )}
                      {p["PRICE"] && (
                        <span className="text-xs text-emerald-600">
                          Dealer: <span className="font-semibold">{formatRp(p["PRICE"])}</span>
                        </span>
                      )}
                      {canViewCP && p["CP"] && (
                        <span className="text-xs text-slate-400">
                          Modal: {formatRp(p["CP"])}
                        </span>
                      )}
                      {p["NAMA BRAND"] && (
                        <span className="text-xs text-slate-400">{p["NAMA BRAND"]}</span>
                      )}
                    </div>

                    {/* Mapping info for matched/needs_review */}
                    {p._mapping && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className="text-xs text-slate-500 truncate max-w-xs">
                          {p._mapping.woo_name ?? `WC #${p._mapping.woo_product_id}`}
                          {p._mapping.woo_sku_full && (
                            <span className="text-slate-400 ml-1">({p._mapping.woo_sku_full})</span>
                          )}
                        </span>
                        {p._status === "needs_review" && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                            Perlu Konfirmasi
                          </span>
                        )}
                        {/* Tampilkan Alasan */}
                        {p._mapping.match_method && p._status === "needs_review" && (
                          <span className="text-[10px] text-slate-400 italic">
                            ({p._mapping.match_method.includes("fuzzy")
                               ? `Kemiripan: ${p._mapping.confidence_score ?? 0}%` 
                               : "Auto Match"})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: action */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {tab === "matched" ? (
                      <>
                        <button
                          onClick={() => handleUnmatch(kode)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors"
                        >
                          <Link2Off className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Lepas</span>
                        </button>
                        <button
                          onClick={() => handleSyncPrice(kode)}
                          disabled={isSyncing || !p["SP"]}
                          title={!p["SP"] ? "Harga SP kosong" : "Sync harga ke WooCommerce"}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isSyncing
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Zap className="w-3.5 h-3.5" />
                          }
                          <span className="hidden sm:inline">Sync</span>
                        </button>
                      </>
                    ) : tab === "ignored" ? (
                      <button
                        onClick={() => handleRestore(kode)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Kembalikan</span>
                      </button>
                    ) : (
                      <>
                        {tab === "unmatched" && (
                          <button
                            onClick={() => handleIgnore(kode)}
                            title="Abaikan produk ini"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => { setMatchTarget(p); setWooSearch(""); setSelectedWoo(null); setVariations([]); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === "needs_review"
                              ? "text-amber-700 bg-amber-100 hover:bg-amber-200"
                              : "text-blue-700 bg-blue-100 hover:bg-blue-200"
                            }`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          {tab === "needs_review" ? "Konfirmasi" : "Match"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Match Modal */}
      {matchTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => { if (!saving) setMatchTarget(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">Match Produk</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pilih produk WooCommerce yang sesuai dengan data Accurate
                </p>
              </div>
              <button
                onClick={() => { if (!saving) setMatchTarget(null); }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              {/* Left: Accurate product info */}
              <div className="md:w-56 shrink-0 p-5 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 overflow-auto">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Data Accurate</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400">Kode</p>
                    <p className="text-xs font-mono font-semibold text-slate-700">{matchTarget["Kode Accurate"]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Nama Barang</p>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                        {parseProductName(matchTarget["NAMA BARANG"] || "").name}
                      </p>
                      {parseProductName(matchTarget["NAMA BARANG"] || "").specs && (
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-snug">
                          {parseProductName(matchTarget["NAMA BARANG"] || "").specs}
                        </p>
                      )}
                    </div>
                  </div>
                  {matchTarget["KATEGORI"] && (
                    <div>
                      <p className="text-[10px] text-slate-400">Kategori</p>
                      <p className="text-xs text-slate-700">{matchTarget["KATEGORI"]}</p>
                    </div>
                  )}
                  {matchTarget["NAMA BRAND"] && (
                    <div>
                      <p className="text-[10px] text-slate-400">Brand</p>
                      <p className="text-xs text-slate-700">{matchTarget["NAMA BRAND"]}</p>
                    </div>
                  )}
                  {matchTarget["SP"] && (
                    <div>
                      <p className="text-[10px] text-slate-400">Harga SRP</p>
                      <p className="text-sm font-bold text-blue-700">{formatRp(matchTarget["SP"])}</p>
                    </div>
                  )}
                  {matchTarget["PRICE"] && (
                    <div>
                      <p className="text-[10px] text-slate-400">Harga Dealer</p>
                      <p className="text-sm font-bold text-emerald-700">{formatRp(matchTarget["PRICE"])}</p>
                    </div>
                  )}
                  {canViewCP && matchTarget["CP"] && (
                    <div>
                      <p className="text-[10px] text-slate-400">Modal (CP)</p>
                      <p className="text-xs text-slate-600">{formatRp(matchTarget["CP"])}</p>
                    </div>
                  )}
                  {matchTarget.barcode_ean && (
                    <div>
                      <p className="text-[10px] text-slate-400">Barcode</p>
                      <p className="text-xs font-mono text-slate-600">{matchTarget.barcode_ean}</p>
                    </div>
                  )}
                </div>

                {/* Existing mapping info */}
                {matchTarget._mapping && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 mb-1">Mapping sebelumnya</p>
                    <p className="text-xs text-slate-600">{matchTarget._mapping.woo_name}</p>
                    {matchTarget._mapping.woo_sku_full && (
                      <p className="text-[10px] font-mono text-slate-400">{matchTarget._mapping.woo_sku_full}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Right: search WooCommerce */}
              <div className="flex-1 flex flex-col overflow-hidden p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Cari di WooCommerce
                </p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama produk atau SKU..."
                    value={wooSearch}
                    onChange={(e) => { setWooSearch(e.target.value); setSelectedWoo(null); setVariations([]); }}
                    autoFocus
                    className="pl-9 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex-1 overflow-auto space-y-1.5">
                  {wooLoading && (
                    <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Mencari...
                    </div>
                  )}

                  {!wooLoading && wooSearch.length >= 2 && wooResults.length === 0 && (
                    <p className="text-sm text-slate-400 py-4 text-center">Tidak ada hasil untuk "{wooSearch}"</p>
                  )}

                  {wooResults.map((r) => {
                    const isSelected = selectedWoo?.woo_product_id === r.id && !selectedWoo?.woo_variation_id;
                    const isVariableSelected = selectedWoo?.woo_product_id === r.id && !!selectedWoo?.woo_variation_id;
                    return (
                      <div key={r.id}>
                        <button
                          onClick={() => handleSelectWooProduct(r)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${isSelected
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                              : isVariableSelected
                                ? "border-blue-200 bg-blue-50/50"
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.type === "variable" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
                                  }`}>
                                  {r.type === "variable" ? "Variable" : "Simple"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {r.sku && <span className="text-[11px] font-mono text-slate-400">{r.sku}</span>}
                                {r.regular_price && (
                                  <span className="text-[11px] text-slate-500">
                                    Rp {Number(r.regular_price).toLocaleString("id-ID")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {r.type === "variable" && (
                              <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${selectedWoo?.woo_product_id === r.id ? "rotate-90" : ""
                                }`} />
                            )}
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                          </div>
                        </button>

                        {/* Variations for variable product */}
                        {selectedWoo?.woo_product_id === r.id && r.type === "variable" && (
                          <div className="ml-3 mt-1 space-y-1 pl-3 border-l-2 border-blue-200">
                            {varLoading && (
                              <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Memuat variasi...
                              </div>
                            )}
                            {variations.map((v) => {
                              const label = v.attributes.map((a) => `${a.name}: ${a.option}`).join(", ");
                              const isVarSelected = selectedWoo?.woo_variation_id === v.id;
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => handleSelectVariation(v, r.id, r.name)}
                                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${isVarSelected
                                      ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-slate-700">{label || `Var #${v.id}`}</span>
                                      <div className="flex gap-2 mt-0.5">
                                        {v.sku && <span className="font-mono text-slate-400">{v.sku}</span>}
                                        {v.regular_price && (
                                          <span className="text-slate-500">
                                            Rp {Number(v.regular_price).toLocaleString("id-ID")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isVarSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {wooSearch.length < 2 && !selectedWoo && (
                    <p className="text-xs text-slate-400 text-center py-6">
                      Ketik minimal 2 karakter untuk mencari produk WooCommerce
                    </p>
                  )}

                  {/* Selected product summary */}
                  {selectedWoo && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-1">Dipilih</p>
                      <p className="text-sm font-semibold text-blue-800">{selectedWoo.woo_name}</p>
                      {selectedWoo.woo_sku_full && (
                        <p className="text-xs font-mono text-blue-500 mt-0.5">{selectedWoo.woo_sku_full}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                        <Link2 className="w-3 h-3" />
                        WC ID: #{selectedWoo.woo_product_id}
                        {selectedWoo.woo_variation_id && ` / Var #${selectedWoo.woo_variation_id}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-200 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {matchTarget["NAMA BARANG"]}
                <ArrowRight className="w-3 h-3 text-slate-300" />
                <span className={selectedWoo ? "text-blue-700 font-medium" : "text-slate-300"}>
                  {selectedWoo ? selectedWoo.woo_name : "Belum dipilih"}
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { if (!saving) setMatchTarget(null); }}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmMatch}
                  disabled={saving || !selectedWoo}
                  className="flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Simpan Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Modal */}
      {confirmDialog && (
        <div 
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setConfirmDialog(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4 text-slate-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors ${confirmDialog.actionClass}`}
              >
                {confirmDialog.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-[60] max-w-xs ${toast.type === "success" ? "bg-white border-green-200 text-green-800 shadow-green-100" :
            toast.type === "error" ? "bg-white border-red-200 text-red-700 shadow-red-100" :
              "bg-white border-blue-200 text-blue-700 shadow-blue-100"
          }`}>
          {toast.type === "loading"
            ? <RefreshCw className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
            : toast.type === "success"
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
