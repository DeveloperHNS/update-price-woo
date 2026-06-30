"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { wooFetch, fetchAll, WooProduct, WooVariation } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { getCurrentProfile, type UserProfile } from "@/lib/profile";
import ImageUpload from "../../components/ImageUpload";
import { ArrowLeft, ChevronDown, RefreshCw, Save, Plus, Trash2, GitBranch, Box, AlertCircle, CheckCircle2, Bold, Italic, List, ListOrdered, Code } from "lucide-react";
import Link from "next/link";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';

const tiptapExtensions = [StarterKit, TiptapLink.configure({ openOnClick: false })];

export default function EditProductPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [product, setProduct] = useState<WooProduct | null>(null);
  const [variations, setVariations] = useState<WooVariation[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // New variation state
  const [newVarColor, setNewVarColor] = useState("");
  const [newVarSku, setNewVarSku] = useState("");
  const [newVarPrice, setNewVarPrice] = useState("");
  const [newVarSale, setNewVarSale] = useState("");

  // WooCommerce Global Attributes & Generation
  const [globalAttributes, setGlobalAttributes] = useState<any[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<{ id: number; name: string; options: string; variation: boolean; }[]>([]);
  const [termsCache, setTermsCache] = useState<Record<number, any[]>>({});
  const [loadingTerms, setLoadingTerms] = useState<Record<number, boolean>>({});

  const [descSaving, setDescSaving] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");

  const editor = useEditor({
    extensions: tiptapExtensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[160px] p-4 bg-white text-sm'
      }
    }
  });

  useEffect(() => {
    if (editor && product?.description) {
      editor.commands.setContent(product.description);
    }
  }, [product?.description, editor]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, attrs] = await Promise.all([
        wooFetch(`products/${id}`, "GET") as Promise<WooProduct>,
        fetchAll("products/attributes")
      ]);
      setProduct(p);
      setGlobalAttributes(attrs as any[]);

      if (p.attributes) {
        setSelectedAttributes(p.attributes.map((a: any) => ({
          id: a.id || 0,
          name: a.name,
          options: a.options ? a.options.join(" | ") : "",
          variation: a.variation
        })));
      }

      if (p.type === "variable") {
        const vars = await wooFetch(`products/${id}/variations`, "GET", undefined, { per_page: 100 }) as WooVariation[];
        setVariations(vars);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load product data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      getCurrentProfile().then(setProfile);
      loadData();
    }
  }, [id]);

  const convertToVariable = async () => {
    if (!product) return;
    setSaving(true);
    try {
      let attrs = product.attributes || [];
      if (!attrs.find((a: any) => a.name.toLowerCase() === "warna" || a.name.toLowerCase() === "color")) {
        attrs = [
          ...attrs,
          { id: 0, name: "Warna", visible: true, variation: true, options: ["Hitam"] }
        ];
      }

      await wooFetch(`products/${id}`, "PUT", {
        type: "variable",
        attributes: attrs
      });

      // Create a default variation
      await wooFetch(`products/${id}/variations`, "POST", {
        regular_price: product.regular_price,
        sale_price: product.sale_price,
        sku: product.sku ? `${product.sku}-HITAM` : "",
        manage_stock: true,
        stock_status: product.stock_status,
        attributes: [{ name: "Warna", option: "Hitam" }]
      });

      showToast("Berhasil diubah menjadi Variable", "success");
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Gagal mengonversi", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSimple = async () => {
    if (!product) return;
    setSaving(true);
    try {
      await wooFetch(`products/${id}`, "PUT", {
        name: product.name,
        sku: product.sku,
        regular_price: product.regular_price,
        sale_price: product.sale_price,
        stock_status: product.stock_status,
        status: product.status,
      });
      showToast("Produk berhasil disimpan", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan produk", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!product) return;
    setDescSaving(true);
    try {
      const html = isHtmlMode ? htmlContent : (editor?.getHTML() || "");
      await wooFetch(`products/${id}`, "PUT", { description: html });
      setProduct(prev => prev ? { ...prev, description: html } : prev);
      showToast("Deskripsi berhasil disimpan", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan deskripsi", "error");
    } finally {
      setDescSaving(false);
    }
  };

  const handleUpdateVarField = (varId: number, field: string, val: string | boolean) => {
    setVariations(prev => prev.map(v => v.id === varId ? { ...v, [field]: val } : v));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      if (!isVariable) {
        await wooFetch(`products/${id}`, "PUT", {
          regular_price: product?.regular_price,
          sale_price: product?.sale_price,
          sku: product?.sku,
          stock_status: product?.stock_status
        });
        showToast("Perubahan berhasil disimpan", "success");
        await loadData();
        return;
      }

      // First update the parent product attributes
      if (selectedAttributes.length > 0) {
        const formattedAttrs = selectedAttributes.map(a => ({
          id: a.id, name: a.name, visible: true, variation: a.variation,
          options: a.options.split(/[\r\n|,]+/).map(s => s.trim()).filter(Boolean)
        }));
        await wooFetch(`products/${id}`, "PUT", { attributes: formattedAttrs });
      }

      // Then save variations
      const updates = variations.filter(v => v.id > 0).map(v => ({
        id: v.id,
        regular_price: v.regular_price,
        sale_price: v.sale_price,
        sku: v.sku,
        stock_status: v.stock_status,
        image: (v as any).image // Include image if updated
      }));

      const creates = variations.filter(v => v.id === 0).map(v => ({
        regular_price: v.regular_price,
        sale_price: v.sale_price,
        sku: v.sku,
        stock_status: v.stock_status,
        attributes: v.attributes?.map((a: any) => ({ id: a.id, name: a.name, option: a.slug ? a.slug : a.option })),
        image: (v as any).image
      }));

      if (updates.length > 0 || creates.length > 0) {
        await wooFetch(`products/${id}/variations/batch`, "POST", { update: updates, create: creates });
      }

      showToast("Variasi berhasil disimpan", "success");
      await loadData(); // Reload to get actual IDs of new variations
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan variasi", "error");
    } finally {
      setSaving(false);
    }
  };

  const addAttribute = () => {
    setSelectedAttributes([...selectedAttributes, { id: 0, name: "", options: "", variation: true }]);
  };

  const removeAttribute = (index: number) => {
    const newAttrs = [...selectedAttributes];
    newAttrs.splice(index, 1);
    setSelectedAttributes(newAttrs);
  };

  const updateAttribute = async (index: number, field: string, val: any) => {
    const newAttrs = [...selectedAttributes];
    if (field === 'id') {
      const globalAttr = globalAttributes.find(a => a.id === Number(val));
      if (globalAttr) {
        newAttrs[index] = { ...newAttrs[index], id: globalAttr.id, name: globalAttr.name, options: "" };
        if (globalAttr.id > 0 && !termsCache[globalAttr.id]) {
          setLoadingTerms(prev => ({ ...prev, [globalAttr.id]: true }));
          try {
            const terms = await fetchAll(`products/attributes/${globalAttr.id}/terms`);
            setTermsCache(prev => ({ ...prev, [globalAttr.id]: terms as any[] }));
          } catch (e: any) {
            showToast("Failed to load terms: " + e.message, "error");
          } finally {
            setLoadingTerms(prev => ({ ...prev, [globalAttr.id]: false }));
          }
        }
      } else {
        newAttrs[index] = { ...newAttrs[index], id: 0, name: "", options: "" };
      }
    } else {
      newAttrs[index] = { ...newAttrs[index], [field]: val };
    }
    setSelectedAttributes(newAttrs);
  };

  const generateVariations = () => {
    const varAttrs = selectedAttributes.filter(a => a.variation && a.options.trim());
    if (varAttrs.length === 0) {
      showToast("Pilih minimal 1 atribut variasi dengan opsi", "error");
      return;
    }
    const parsedAttrs = varAttrs.map(a => {
      const names = a.options.split(/[\r\n|,]+/).map(s => s.trim()).filter(Boolean);
      const optionsWithSlug = names.map(name => {
        if (a.id > 0 && termsCache[a.id]) {
          const term = termsCache[a.id].find((t: any) => t.name === name);
          if (term && term.slug) return { name, slug: term.slug };
        }
        return { name, slug: name };
      });
      return { id: a.id, name: a.name, options: optionsWithSlug };
    });

    const cartesian = (arrays: any[][]): any[][] =>
      arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]]);
    const combinations = cartesian(parsedAttrs.map(a => a.options));

    let generatedCount = 0;
    const currentVars = [...variations];

    combinations.forEach(comb => {
      const combArray = Array.isArray(comb) ? comb : [comb];
      const attrsForVar = parsedAttrs.map((a, i) => ({
        id: a.id,
        name: a.name,
        option: combArray[i].name,
        slug: combArray[i].slug
      }));

      // Check if this combination already exists
      const exists = currentVars.some(v => {
        if (!v.attributes) return false;
        // check if every attr in attrsForVar matches
        return attrsForVar.every(newAttr =>
          v.attributes!.some((existAttr: any) => existAttr.name === newAttr.name && existAttr.option === newAttr.option)
        );
      });

      if (!exists) {
        const key = attrsForVar.map(a => a.option).join('-');
        currentVars.push({
          id: 0, // 0 marks it as new
          sku: product?.sku ? `${product.sku}-${key.toUpperCase().replace(/\s+/g, '')}` : "",
          regular_price: product?.regular_price || "",
          sale_price: "",
          stock_status: "instock",
          attributes: attrsForVar
        } as any);
        generatedCount++;
      }
    });

    if (generatedCount > 0) {
      setVariations(currentVars);
      showToast(`Berhasil men-generate ${generatedCount} variasi baru`, "success");
    } else {
      showToast("Semua kombinasi variasi sudah ada", "success");
    }
  };

  const handleAddVariation = async () => {
    if (!product) return;
    if (!newVarColor) {
      showToast("Warna wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      let attrId = 0;
      let attrName = "Warna";

      const productAttrs = product.attributes || [];
      const existingAttr = productAttrs.find((a: any) => a.name.toLowerCase() === "warna" || a.name.toLowerCase() === "color");

      if (existingAttr) {
        attrId = existingAttr.id;
        attrName = existingAttr.name;
        if (!existingAttr.options.includes(newVarColor)) {
          const newAttrs = productAttrs.map((a: any) =>
            a.name === attrName ? { ...a, options: [...a.options, newVarColor] } : a
          );
          await wooFetch(`products/${id}`, "PUT", { attributes: newAttrs });
        }
      } else {
        const newAttrs = [...productAttrs, { name: "Warna", variation: true, visible: true, options: [newVarColor] }];
        await wooFetch(`products/${id}`, "PUT", { attributes: newAttrs });
      }

      const newVar = {
        regular_price: newVarPrice,
        sale_price: newVarSale,
        sku: newVarSku,
        attributes: [{ id: attrId, name: attrName, option: newVarColor }]
      };

      const created = await wooFetch(`products/${id}/variations`, "POST", newVar);
      setVariations(prev => [...prev, created as WooVariation]);
      setNewVarColor(""); setNewVarSku(""); setNewVarPrice(""); setNewVarSale("");
      showToast("Variasi ditambahkan", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menambah variasi", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariation = async (varId: number) => {
    if (!confirm("Hapus variasi ini?")) return;
    // Variasi belum disimpan (id=0) — cukup hapus dari state lokal
    if (varId === 0) {
      setVariations(prev => {
        const idx = prev.findIndex(v => v.id === 0);
        if (idx === -1) return prev;
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
      showToast("Variasi dihapus dari daftar", "success");
      return;
    }
    setSaving(true);
    try {
      await wooFetch(`products/${id}/variations/${varId}`, "DELETE", undefined, { force: true });
      setVariations(prev => prev.filter(v => v.id !== varId));
      showToast("Variasi dihapus", "success");
    } catch (err: any) {
      showToast(err.message || "Gagal menghapus", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 font-medium">Memuat data produk...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50 p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-center max-w-md">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-medium">{error || "Produk tidak ditemukan"}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-red-700 underline">Kembali ke Dashboard</Link>
        </div>
      </div>
    );
  }

  const isVariable = product.type === "variable";

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-auto relative">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Edit Produk</h1>
            <p className="text-xs text-slate-500 mt-0.5">#{product.id} — {product.sku || "No SKU"}</p>
          </div>
        </div>
        {isVariable ? (
          <button
            onClick={handleSaveAll}
            disabled={saving || variations.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Variasi
          </button>
        ) : (
          <button
            onClick={handleSaveSimple}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Produk
          </button>
        )}
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full space-y-6 pb-20">

        {/* Main Product Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-start">
          <div className="w-28 shrink-0">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Foto Utama</p>
            <ImageUpload
              currentImageUrl={product.images?.[0]?.src || null}
              onUploadSuccess={(media) => {
                const existingImages = product.images || [];
                const updatedImages = [{ id: media.id, src: media.source_url }, ...existingImages.slice(1)];
                setProduct(prev => prev ? { ...prev, images: updatedImages } : prev);
                wooFetch(`products/${id}`, "PUT", { images: updatedImages }).catch(() => {});
                showToast("Foto utama berhasil diupload", "success");
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${isVariable ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                {product.type}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${product.status === 'publish' ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                {product.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">{product.name}</h2>
            <div className="text-sm text-slate-500 font-mono">SKU: {product.sku || "N/A"}</div>
          </div>

          {!isVariable && (
            <div className="shrink-0 bg-amber-50 p-4 rounded-xl border border-amber-200 w-full md:w-72">
              <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> Konversi Produk
              </h3>
              <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                Produk ini bertipe Simple. Ubah ke Variable untuk menambahkan opsi (seperti Warna) dan foto per variasi.
              </p>
              <button
                onClick={convertToVariable}
                disabled={saving}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Ubah ke Variable"}
              </button>
            </div>
          )}
        </div>

        {!isVariable && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4">Detail Produk</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Nama Produk</label>
                  <input
                    type="text"
                    value={product.name || ""}
                    onChange={e => setProduct({ ...product, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">SKU</label>
                  <input type="text" value={product.sku || ""} onChange={e => setProduct({ ...product, sku: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Status Produk</label>
                  <select value={product.status || "publish"} onChange={e => setProduct({ ...product, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="publish">Publish</option>
                    <option value="private">Private</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Status Stok</label>
                  <select value={product.stock_status || "instock"} onChange={e => setProduct({ ...product, stock_status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out of Stock</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Harga Normal (Rp)</label>
                  <input type="number" value={product.regular_price || ""} onChange={e => setProduct({ ...product, regular_price: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Harga Diskon (Rp)</label>
                  <input type="number" value={product.sale_price || ""} onChange={e => setProduct({ ...product, sale_price: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-red-600 font-medium" placeholder="Kosongkan jika tidak ada diskon" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Description Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Deskripsi Produk</h3>
              <p className="text-xs text-slate-500 mt-0.5">Edit konten deskripsi lengkap</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isHtmlMode) {
                    editor?.commands.setContent(htmlContent);
                    setIsHtmlMode(false);
                  } else {
                    setHtmlContent(editor?.getHTML() || "");
                    setIsHtmlMode(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${isHtmlMode
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <Code className="w-4 h-4" /> HTML Mode
              </button>
              <button
                onClick={handleSaveDescription}
                disabled={descSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {descSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Deskripsi
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="rounded-xl overflow-hidden border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400 transition-all">
              {isHtmlMode ? (
                <div className="bg-slate-900 text-slate-50 relative p-1">
                  <textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    className="w-full h-full min-h-[200px] bg-transparent border-none text-sm font-mono focus:ring-0 p-4 resize-y outline-none"
                    placeholder="<p>Paste raw HTML here...</p>"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 bg-slate-100 border-b border-slate-200 px-2 py-1.5">
                    <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors ${editor?.isActive('bold') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><Bold className="w-4 h-4" /></button>
                    <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors ${editor?.isActive('italic') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><Italic className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-slate-300 mx-1" />
                    <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors ${editor?.isActive('bulletList') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><List className="w-4 h-4" /></button>
                    <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors ${editor?.isActive('orderedList') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><ListOrdered className="w-4 h-4" /></button>
                  </div>
                  <EditorContent editor={editor} />
                </>
              )}
            </div>
          </div>
        </div>


        {/* Attributes Section */}
        {isVariable && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Atribut Produk & Generate Variasi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Atur atribut dan buat kombinasi variasi sekaligus</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addAttribute}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Atribut
                </button>
              </div>
            </div>
            <div className="p-6">
              {selectedAttributes.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl mb-4">
                  <p className="text-xs text-slate-400">Belum ada atribut. Klik "Tambah Atribut" untuk mulai.</p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {selectedAttributes.map((attr, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <select
                                value={attr.id}
                                onChange={e => updateAttribute(idx, 'id', e.target.value)}
                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="0">Custom Attribute</option>
                                {globalAttributes.map(ga => (
                                  <option key={ga.id} value={ga.id}>{ga.name}</option>
                                ))}
                              </select>
                            </div>

                            {attr.id === 0 && (
                              <input
                                type="text"
                                placeholder="Nama atribut (e.g. Warna)"
                                value={attr.name}
                                onChange={e => updateAttribute(idx, 'name', e.target.value)}
                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            )}
                          </div>

                          <label className="inline-flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={attr.variation}
                              onChange={e => updateAttribute(idx, 'variation', e.target.checked)}
                              className="rounded text-blue-600"
                            />
                            <span className="text-xs font-medium">Digunakan untuk variasi</span>
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAttribute(idx)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 shrink-0"
                          title="Hapus atribut"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        {attr.id === 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium text-slate-500">Nilai (pisahkan dengan | atau ,)</label>
                            </div>
                            <textarea
                              value={attr.options}
                              onChange={e => updateAttribute(idx, 'options', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                              placeholder="Contoh: Merah | Biru | Hijau"
                              rows={2}
                            />
                          </div>
                        ) : loadingTerms[attr.id] ? (
                          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Memuat pilihan...
                          </div>
                        ) : termsCache[attr.id]?.length > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium text-slate-500">Pilih Values</label>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2.5 border border-slate-200 rounded-lg bg-white">
                              {termsCache[attr.id].map(term => {
                                const isChecked = attr.options.split(/[\r\n|,]+/).map(s => s.trim()).includes(term.name);
                                return (
                                  <label key={term.id} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${isChecked ? "bg-blue-50 border-blue-300 text-blue-700 font-medium" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                                    <input
                                      type="checkbox"
                                      className="rounded text-blue-600 w-3 h-3"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        let current = attr.options.split(/[\r\n|,]+/).map(s => s.trim()).filter(Boolean);
                                        if (e.target.checked) { if (!current.includes(term.name)) current.push(term.name); }
                                        else { current = current.filter(c => c !== term.name); }
                                        updateAttribute(idx, 'options', current.join(' | '));
                                      }}
                                    />
                                    {term.name}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-1">Tidak ada pilihan untuk atribut ini.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedAttributes.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 max-w-sm">Klik tombol ini untuk menghasilkan kombinasi variasi baru tanpa menimpa variasi lama.</p>
                  <button
                    type="button"
                    onClick={generateVariations}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> Generate Variasi
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Variations Section */}
        {isVariable && (
          <div className="space-y-6">

            {/* List Variations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">Daftar Variasi</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kelola stok, harga, dan foto untuk setiap variasi</p>
              </div>

              <div className="divide-y divide-slate-100">
                {variations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-sm">Belum ada variasi. Silakan tambahkan di bawah.</div>
                ) : (
                  variations.map(v => (
                    <div key={v.id} className="p-6 flex flex-col lg:flex-row gap-6">

                      {/* Image Upload Area */}
                      <div className="w-full lg:w-48 shrink-0">
                        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Foto Variasi</p>
                        <ImageUpload
                          currentImageUrl={(v as any).image?.src || null}
                          onUploadSuccess={(media) => {
                            // Update variation local state
                            setVariations(prev => prev.map(item => item.id === v.id ? {
                              ...item,
                              image: { id: media.id, src: media.source_url }
                            } : item));
                            showToast("Gambar berhasil diunggah", "success");
                          }}
                        />
                      </div>

                      {/* Fields */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <p className="text-sm font-bold text-slate-800 mb-3 bg-purple-50 inline-block px-3 py-1 rounded-md text-purple-800 border border-purple-100">
                            Warna: {v.attributes?.map(a => a.option).join(", ") || "N/A"}
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-500 block mb-1">SKU Variasi</label>
                          <input
                            type="text"
                            value={v.sku}
                            onChange={e => handleUpdateVarField(v.id, "sku", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-500 block mb-1">Status Stok</label>
                          <select
                            value={v.stock_status || "instock"}
                            onChange={e => handleUpdateVarField(v.id, "stock_status", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          >
                            <option value="instock">In Stock</option>
                            <option value="outofstock">Out of Stock</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-500 block mb-1">Harga Normal (Rp)</label>
                          <input
                            type="number"
                            value={v.regular_price}
                            onChange={e => handleUpdateVarField(v.id, "regular_price", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-500 block mb-1">Harga Diskon (Rp)</label>
                          <input
                            type="number"
                            value={v.sale_price || ""}
                            onChange={e => handleUpdateVarField(v.id, "sale_price", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-red-600 font-medium"
                            placeholder="Kosongkan jika tidak ada diskon"
                          />
                        </div>
                      </div>

                      {/* Delete Action */}
                      <div className="shrink-0 flex lg:flex-col justify-end lg:justify-start">
                        <button
                          onClick={() => handleDeleteVariation(v.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          title="Hapus Variasi"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add New Variation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-blue-900">Tambah Variasi Baru</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Warna *</label>
                  <input type="text" placeholder="e.g. Merah" value={newVarColor} onChange={e => setNewVarColor(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">SKU</label>
                  <input type="text" placeholder="e.g. SKU-MERAH" value={newVarSku} onChange={e => setNewVarSku(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Modal</label>
                  <input type="number" placeholder="100000" value={newVarPrice} onChange={e => setNewVarPrice(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="lg:col-span-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Harga Jual</label>
                  <input type="number" placeholder="150000" value={newVarSale} onChange={e => setNewVarSale(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="lg:col-span-1">
                  <button onClick={handleAddVariation} disabled={saving || !newVarColor} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 shadow-sm">
                    Tambah
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-white border-green-200 text-green-800 shadow-green-100' : 'bg-white border-red-200 text-red-700 shadow-red-100'
          }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
