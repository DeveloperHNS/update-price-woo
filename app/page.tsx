"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreProfile, getStores, saveStore, setActiveStore, removeStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Store, Trash2, Plus, ArrowRight, X, CheckCircle2 } from "lucide-react";

export default function ConnectStorePage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: "", url: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      } else {
        setStores(getStores());
      }
    }).catch(() => {
      router.replace("/login");
    });
  }, [router]);

  const handleConnect = async (store: StoreProfile) => {
    setActiveStore(store);
    router.push("/dashboard");
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.name || !formData.url) throw new Error("Semua field wajib diisi");

      let storeUrl = formData.url;
      if (!storeUrl.startsWith("http")) storeUrl = "https://" + storeUrl;

      const response = await fetch("/api/woo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "products", method: "GET", params: { per_page: 1 } })
      });

      if (!response.ok && response.status === 401)
        throw new Error("Kredensial server tidak valid. Cek nilai di .env.local.");
      if (!response.ok)
        throw new Error("Gagal terhubung menggunakan kredensial server.");

      const newStore = saveStore({ name: formData.name, url: storeUrl });
      setStores(getStores());
      setShowAdd(false);
      setFormData({ name: "", url: "" });
      handleConnect(newStore);
    } catch (err: any) {
      setError(err.message || "Gagal terhubung ke toko");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Hapus profil toko ini?")) {
      removeStore(id);
      setStores(getStores());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Price Manager</h1>
          <p className="text-slate-400 text-sm mt-1">Pilih toko untuk mulai mengelola produk</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {!showAdd ? (
            <div className="p-5 space-y-3">
              {stores.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Store className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Belum ada toko tersimpan</p>
                  <p className="text-slate-400 text-xs mt-1">Tambahkan toko pertama Anda di bawah</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-3">Toko Tersimpan</p>
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      onClick={() => handleConnect(store)}
                      className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm group-hover:text-blue-700 truncate">{store.name}</p>
                          <p className="text-xs text-slate-400 truncate">{store.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={(e) => handleDelete(store.id, e)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-sm font-medium mt-1"
              >
                <Plus className="w-4 h-4" />
                Tambah Toko Baru
              </button>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-800">Tambah Toko Baru</h2>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setError(""); setFormData({ name: "", url: "" }); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
                  <span className="shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleAddStore} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Toko</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    placeholder="Contoh: HNS IT Center"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">URL Toko</label>
                  <input
                    type="text"
                    required
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    placeholder="https://toko.example.com"
                  />
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                  <span>Kredensial API dibaca dari environment server — tidak pernah dikirim dari browser.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Menghubungkan...
                    </>
                  ) : (
                    "Hubungkan Toko"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer link */}
        <p className="text-center text-xs text-slate-500">
          Ingin keluar?{" "}
          <button
            onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
            className="text-slate-300 hover:text-white underline transition-colors"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
