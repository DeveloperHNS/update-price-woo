import { useState, useEffect } from "react";
import { X, Save, Plus, RefreshCw, Trash2 } from "lucide-react";
import { wooFetch, WooProduct, WooVariation } from "@/lib/api";

type VarEditModalProps = {
  product: WooProduct;
  onClose: () => void;
  onSaved: () => void;
};

export default function VarEditModal({ product, onClose, onSaved }: VarEditModalProps) {
  const [variations, setVariations] = useState<WooVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{msg: string, type: "success"|"error"} | null>(null);

  // For adding a new variation on the fly
  const [newVarColor, setNewVarColor] = useState("");
  const [newVarSku, setNewVarSku] = useState("");
  const [newVarPrice, setNewVarPrice] = useState("");
  const [newVarSale, setNewVarSale] = useState("");

  const showToast = (msg: string, type: "success"|"error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchVars = async () => {
      try {
        const vars = await wooFetch(`products/${product.id}/variations`, "GET", undefined, { per_page: 100 }) as WooVariation[];
        setVariations(vars);
      } catch (err: any) {
        setError(err.message || "Failed to load variations");
      } finally {
        setLoading(false);
      }
    };
    fetchVars();
  }, [product.id]);

  const handleUpdate = async (varId: number, field: string, val: string) => {
    setVariations(prev => {
      const arr = [...prev];
      const idx = arr.findIndex(v => v.id === varId);
      if (idx > -1) arr[idx] = { ...arr[idx], [field]: val };
      return arr;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Find what changed? Actually we can just batch update them all
      const updates = variations.map(v => ({
        id: v.id,
        regular_price: v.regular_price,
        sale_price: v.sale_price,
        sku: v.sku
      }));
      
      await wooFetch(`products/${product.id}/variations/batch`, "POST", { update: updates });
      showToast("Berhasil menyimpan variasi", "success");
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!newVarColor) {
      showToast("Warna harus diisi", "error");
      return;
    }
    setSaving(true);
    try {
      // First ensure the product has an attribute for this color
      let attrId = 0;
      let attrName = "Warna";
      
      const productAttrs = product.attributes || [];
      const existingAttr = productAttrs.find(a => a.name.toLowerCase() === "warna" || a.name.toLowerCase() === "color");
      if (existingAttr) {
        attrId = existingAttr.id;
        attrName = existingAttr.name;
        // Update product to include this new option if not exists
        if (!existingAttr.options.includes(newVarColor)) {
          const newAttrs = productAttrs.map(a => {
            if (a.name === attrName) {
              return { ...a, options: [...a.options, newVarColor] };
            }
            return a;
          });
          await wooFetch(`products/${product.id}`, "PUT", { attributes: newAttrs });
        }
      } else {
        // Create new attribute for product
        const newAttrs = [...productAttrs, {
          name: "Warna",
          variation: true,
          visible: true,
          options: [newVarColor]
        }];
        await wooFetch(`products/${product.id}`, "PUT", { attributes: newAttrs });
      }

      // Create the variation
      const newVar = {
        regular_price: newVarPrice,
        sale_price: newVarSale,
        sku: newVarSku,
        attributes: [
          {
            id: attrId,
            name: attrName,
            option: newVarColor
          }
        ]
      };

      const created = await wooFetch(`products/${product.id}/variations`, "POST", newVar);
      setVariations(prev => [...prev, created as WooVariation]);
      setNewVarColor("");
      setNewVarSku("");
      setNewVarPrice("");
      setNewVarSale("");
      showToast("Variasi berhasil ditambahkan", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menambah variasi", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (varId: number) => {
    if (!confirm("Hapus variasi ini?")) return;
    setSaving(true);
    try {
      await wooFetch(`products/${product.id}/variations/${varId}`, "DELETE", undefined, { force: true });
      setVariations(prev => prev.filter(v => v.id !== varId));
      showToast("Variasi dihapus", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menghapus", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Edit Variasi</h3>
            <p className="text-xs text-slate-500">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
              <span className="text-sm text-slate-500">Memuat variasi...</span>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* List Variasi Saat Ini */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700 text-sm">
                  Daftar Variasi
                </div>
                {variations.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm italic">Belum ada variasi.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {variations.map(v => (
                      <div key={v.id} className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-3">
                          <span className="text-xs font-semibold text-slate-500 block mb-1">Warna/Atribut</span>
                          <span className="text-sm font-medium text-slate-800">{v.attributes?.map(a => a.option).join(", ") || "N/A"}</span>
                        </div>
                        <div className="sm:col-span-3">
                          <span className="text-xs font-semibold text-slate-500 block mb-1">SKU</span>
                          <input type="text" value={v.sku} onChange={e => handleUpdate(v.id, "sku", e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-xs font-semibold text-slate-500 block mb-1">Modal (Rp)</span>
                          <input type="number" value={v.regular_price} onChange={e => handleUpdate(v.id, "regular_price", e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="sm:col-span-3">
                          <span className="text-xs font-semibold text-slate-500 block mb-1">Harga Jual (Rp)</span>
                          <input type="number" value={v.sale_price} onChange={e => handleUpdate(v.id, "sale_price", e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none text-red-600" />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button onClick={() => handleDelete(v.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Variasi">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tambah Variasi Baru */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-6">
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 font-semibold text-blue-800 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Tambah Variasi (Warna)
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <div className="lg:col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Warna *</label>
                    <input type="text" placeholder="Merah" value={newVarColor} onChange={e => setNewVarColor(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">SKU</label>
                    <input type="text" placeholder="SKU-MERAH" value={newVarSku} onChange={e => setNewVarSku(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Modal</label>
                    <input type="number" placeholder="100000" value={newVarPrice} onChange={e => setNewVarPrice(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Harga Jual</label>
                    <input type="number" placeholder="150000" value={newVarSale} onChange={e => setNewVarSale(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="lg:col-span-1">
                    <button onClick={handleAddNew} disabled={saving || !newVarColor} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 gap-3 bg-white">
          {toast && (
            <span className={`text-sm ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'} mr-auto`}>
              {toast.msg}
            </span>
          )}
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50">
            Tutup
          </button>
          <button onClick={handleSaveAll} disabled={saving || variations.length === 0} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
          </button>
        </div>

      </div>
    </div>
  );
}
