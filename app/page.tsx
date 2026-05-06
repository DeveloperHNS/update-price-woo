"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreProfile, getStores, saveStore, setActiveStore, removeStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Store, Trash2, Plus, ArrowRight } from "lucide-react";

export default function ConnectStorePage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: "", url: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Redirect to login if not authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      } else {
        setStores(getStores());
      }
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
      // Basic validation
      if (!formData.name || !formData.url) {
        throw new Error("All fields are required");
      }
      
      let storeUrl = formData.url;
      if (!storeUrl.startsWith("http")) {
        storeUrl = "https://" + storeUrl;
      }

      // Test connection
      const response = await fetch("/api/woo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "products",
          method: "GET",
          params: { per_page: 1 },
        })
      });
      
      if (!response.ok && response.status === 401) {
        throw new Error("Server credentials are invalid. Check .env.local values.");
      }
      if (!response.ok) throw new Error("Failed to connect using server environment credentials.");

      const newStore = saveStore({
        name: formData.name,
        url: storeUrl,
      });

      setStores(getStores());
      setShowAdd(false);
      setFormData({ name: "", url: "" });
      
      // Auto connect to new store
      handleConnect(newStore);
    } catch (err: any) {
      setError(err.message || "Failed to connect to store");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove this store profile?")) {
      removeStore(id);
      setStores(getStores());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 bg-slate-900 text-white text-center">
          <Store className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h1 className="text-2xl font-bold">WooCommerce Manager</h1>
          <p className="text-slate-400 text-sm mt-2">Manage products across your stores</p>
        </div>

        <div className="p-6">
          {!showAdd ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Saved Stores</h2>
              
              {stores.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p>No stores saved yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stores.map((store) => (
                    <div 
                      key={store.id}
                      onClick={() => handleConnect(store)}
                      className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                    >
                      <div>
                        <h3 className="font-medium text-slate-900 group-hover:text-blue-600">{store.name}</h3>
                        <p className="text-xs text-slate-500 truncate w-48">{store.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleDelete(store.id, e)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove store"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowAdd(true)}
                className="w-full mt-6 py-3 px-4 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Add New Store
              </button>
            </div>
          ) : (
            <form onSubmit={handleAddStore} className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Add New Store</h2>
                <button 
                  type="button" 
                  onClick={() => setShowAdd(false)}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  placeholder="e.g. My Fashion Store"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Store URL</label>
                <input
                  type="text"
                  required
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  placeholder="https://example.com"
                />
              </div>

              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100 mt-2 leading-relaxed">
                <strong>Security Note:</strong> API credentials are read only from server environment variables and never sent from the browser.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors mt-6 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Store"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
