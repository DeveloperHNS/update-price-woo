"use client";

import { useState } from "react";
import { X, Plus, Trash2, RefreshCw, ChevronRight, Save } from "lucide-react";
import { wooFetch, WooProduct } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";

type Attribute = {
  id: string;
  name: string;
  options: string;
};

type VariationEntry = {
  key: string;
  attributes: { name: string; option: string }[];
  sku: string;
  regular_price: string;
  sale_price: string;
};

type Props = {
  product: WooProduct;
  onClose: () => void;
  onConverted: (productId: number) => void;
};

function generateCombinations(attrs: Attribute[]): { name: string; option: string }[][] {
  const optionLists = attrs.map(a =>
    a.options.split(",").map(o => o.trim()).filter(Boolean).map(o => ({ name: a.name.trim(), option: o }))
  );
  if (optionLists.some(l => l.length === 0)) return [];

  const result: { name: string; option: string }[][] = [];
  const recurse = (depth: number, current: { name: string; option: string }[]) => {
    if (depth === optionLists.length) {
      result.push([...current]);
      return;
    }
    for (const opt of optionLists[depth]) {
      recurse(depth + 1, [...current, opt]);
    }
  };
  recurse(0, []);
  return result;
}

export default function ConvertToVariableModal({ product, onClose, onConverted }: Props) {
  const [step, setStep] = useState<"attrs" | "variations">("attrs");
  const [attrs, setAttrs] = useState<Attribute[]>([{ id: "1", name: "", options: "" }]);
  const [variations, setVariations] = useState<VariationEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const addAttr = () =>
    setAttrs(prev => [...prev, { id: String(Date.now()), name: "", options: "" }]);

  const removeAttr = (id: string) =>
    setAttrs(prev => prev.filter(a => a.id !== id));

  const updateAttr = (id: string, field: "name" | "options", val: string) =>
    setAttrs(prev => prev.map(a => (a.id === id ? { ...a, [field]: val } : a)));

  const handleGenerateVariations = () => {
    for (const a of attrs) {
      if (!a.name.trim()) { showToast("Nama atribut tidak boleh kosong", "error"); return; }
      if (!a.options.trim()) { showToast(`Opsi untuk "${a.name}" tidak boleh kosong`, "error"); return; }
    }

    const combos = generateCombinations(attrs);
    if (combos.length === 0) {
      showToast("Gagal generate variasi. Pastikan semua atribut memiliki opsi.", "error");
      return;
    }
    if (combos.length > 50) {
      showToast(`Terlalu banyak variasi (${combos.length}). Maksimal 50.`, "error");
      return;
    }

    setVariations(
      combos.map((combo, i) => ({
        key: combo.map(c => c.option).join("-") + "-" + i,
        attributes: combo,
        sku: "",
        regular_price: product.regular_price || "",
        sale_price: product.sale_price || "",
      }))
    );
    setStep("variations");
  };

  const updateVariation = (key: string, field: "sku" | "regular_price" | "sale_price", val: string) => {
    setVariations(prev => prev.map(v => (v.key === key ? { ...v, [field]: val } : v)));
  };

  const handleConvert = async () => {
    setSaving(true);
    try {
      const wooAttrs = attrs.map(a => ({
        name: a.name.trim(),
        variation: true,
        visible: true,
        options: a.options.split(",").map(o => o.trim()).filter(Boolean),
      }));

      await wooFetch(`products/${product.id}`, "PUT", {
        type: "variable",
        attributes: wooAttrs,
      });

      const createPayload = variations.map(v => ({
        attributes: v.attributes.map(a => ({ name: a.name, option: a.option })),
        sku: v.sku,
        regular_price: v.regular_price,
        sale_price: v.sale_price,
      }));
      await wooFetch(`products/${product.id}/variations/batch`, "POST", { create: createPayload });

      logActivity({
        action: "convert_to_variable",
        product_id: product.id,
        product_name: product.name,
        old_value: "simple",
        new_value: "variable",
      });

      showToast("Berhasil dikonversi ke Variable!", "success");
      setTimeout(() => {
        onConverted(product.id);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      showToast("Gagal: " + (err instanceof Error ? err.message : "error"), "error");
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
            <h3 className="text-lg font-bold text-slate-800">Konversi ke Variable</h3>
            <p className="text-xs text-slate-500 truncate max-w-[340px]">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium">
          <span className={`px-2.5 py-1 rounded-full transition-colors ${step === "attrs" ? "bg-blue-600 text-white" : "bg-green-100 text-green-700"}`}>
            1. Atribut
          </span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className={`px-2.5 py-1 rounded-full transition-colors ${step === "variations" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>
            2. Variasi
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {step === "attrs" ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Tentukan atribut produk (misal: Warna, Ukuran). Pisahkan opsi dengan <strong>koma</strong>.
              </p>
              {attrs.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Nama Atribut *</label>
                    <input
                      type="text"
                      placeholder="Warna"
                      value={a.name}
                      onChange={e => updateAttr(a.id, "name", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Opsi (pisah dengan koma) *</label>
                    <input
                      type="text"
                      placeholder="Merah, Biru, Hijau"
                      value={a.options}
                      onChange={e => updateAttr(a.id, "options", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  {attrs.length > 1 && (
                    <button
                      onClick={() => removeAttr(a.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addAttr}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200"
              >
                <Plus className="w-4 h-4" /> Tambah Atribut
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                <strong>{variations.length} variasi</strong> akan dibuat. Isi SKU dan harga per variasi (opsional).
              </p>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <div className="col-span-4">Variasi</div>
                  <div className="col-span-3">SKU</div>
                  <div className="col-span-2">Modal (Rp)</div>
                  <div className="col-span-3">Harga Jual (Rp)</div>
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {variations.map(v => (
                    <div key={v.key} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center">
                      <div className="col-span-4 text-xs font-medium text-slate-700 truncate">
                        {v.attributes.map(a => a.option).join(" / ")}
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={v.sku}
                          onChange={e => updateVariation(v.key, "sku", e.target.value)}
                          placeholder="SKU"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={v.regular_price}
                          onChange={e => updateVariation(v.key, "regular_price", e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={v.sale_price}
                          onChange={e => updateVariation(v.key, "sale_price", e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-red-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Produk akan dikonversi dari Simple ke Variable. Harga di produk induk akan dihapus otomatis oleh WooCommerce dan beralih ke masing-masing variasi.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white gap-3">
          <div className="min-w-0">
            {toast && (
              <span className={`text-sm ${toast.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {toast.msg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {step === "variations" && (
              <button
                onClick={() => setStep("attrs")}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
              >
                ← Kembali
              </button>
            )}
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            {step === "attrs" ? (
              <button
                onClick={handleGenerateVariations}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-500/30"
              >
                Generate Variasi →
              </button>
            ) : (
              <button
                onClick={handleConvert}
                disabled={saving || variations.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Konversi & Simpan
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
