"use client";

import { useState, useEffect } from "react";
import { fetchAll, wooFetch, appendCache } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { formatNumber, parseFormattedNumber } from "@/lib/format";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Save, AlertCircle, RefreshCw, CheckCircle2, ChevronDown, Plus, Trash2, Bold, Italic, List, ListOrdered, ImagePlus, X as XIcon, Camera, RotateCcw, GripVertical, Code } from "lucide-react";
import { getCurrentProfile, parseCategoryAccess, type UserProfile } from "@/lib/profile";

const tiptapExtensions = [StarterKit, Link.configure({ openOnClick: false })];

export default function UploadProductPage() {
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: "success"|"error"|"loading"} | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Product images
  const [images, setImages] = useState<{ id: number; src: string; alt: string }[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // WooCommerce Data
  const [categories, setCategories] = useState<any[]>([]);
  const [globalAttributes, setGlobalAttributes] = useState<any[]>([]);

  // Form State
  const [type, setType] = useState<"simple" | "variable">("simple");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [selCatIds, setSelCatIds] = useState<number[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [showCatDD, setShowCatDD] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");

  // Tiptap Editor for Description
  const editor = useEditor({
    extensions: tiptapExtensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[160px] p-4 bg-white'
      }
    }
  });

  const [selectedAttributes, setSelectedAttributes] = useState<{
    id: number;
    name: string;
    options: string;
    variation: boolean;
  }[]>([]);

  const [termsCache, setTermsCache] = useState<Record<number, any[]>>({});
  const [loadingTerms, setLoadingTerms] = useState<Record<number, boolean>>({});

  const [variations, setVariations] = useState<{
    key: string;
    attributes: {id: number, name: string, option: string}[];
    regular_price: string;
    sale_price: string;
    sku: string;
    imageId?: number;
    imageSrc?: string;
  }[]>([]);

  const [varImgPickerOpen, setVarImgPickerOpen] = useState<number | null>(null);

  useEffect(() => {
    getCurrentProfile().then(setProfile);
    
    const loadWCData = async () => {
      try {
        const [cats, attrs] = await Promise.all([
          fetchAll("products/categories"),
          fetchAll("products/attributes")
        ]);
        setCategories((cats as any[]).sort((a: any, b: any) => a.parent - b.parent || a.name.localeCompare(b.name)));
        setGlobalAttributes(attrs as any[]);
      } catch (err: any) {
        showToast("Failed to load WooCommerce metadata: " + err.message, "error");
      } finally {
        setInitialLoading(false);
      }
    };
    loadWCData();
  }, []);

  const showToast = (msg: string, type: "success"|"error"|"loading") => {
    setToast({ msg, type });
    if (type !== "loading") setTimeout(() => setToast(null), 3500);
  };

  const handleImageUpload = async (files: FileList) => {
    if (files.length === 0) return;
    setUploadingImages(true);
    showToast(`Mengupload ${files.length} gambar...`, "loading");
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/media", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload gagal");
          return { id: data.id as number, src: data.source_url as string, alt: (data.alt_text as string) || file.name };
        })
      );
      setImages((prev) => [...prev, ...uploaded]);
      showToast(`${uploaded.length} gambar berhasil diupload`, "success");
    } catch (err: unknown) {
      showToast("Gagal upload gambar: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleCreateCategory = async (catName: string) => {
    if (!catName.trim()) return;
    setLoading(true);
    showToast(`Membuat kategori "${catName}"...`, "loading");
    try {
      const res = await wooFetch("products/categories", "POST", { name: catName });
      setCategories(prev => [...prev, res].sort((a: any, b: any) => a.parent - b.parent || a.name.localeCompare(b.name)));
      setSelCatIds(prev => [...prev, res.id]);
      setCatSearch("");
      showToast("Kategori berhasil dibuat", "success");
    } catch (err: any) {
      showToast("Gagal membuat kategori: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Hapus kategori "${name}" secara permanen dari WooCommerce?`)) return;
    setLoading(true);
    showToast(`Menghapus kategori ${name}...`, "loading");
    try {
      await wooFetch(`products/categories/${id}`, "DELETE", undefined, { force: true });
      setCategories(prev => prev.filter(c => c.id !== id));
      setSelCatIds(prev => prev.filter(cid => cid !== id));
      showToast("Kategori berhasil dihapus", "success");
    } catch (err: any) {
      showToast("Gagal menghapus kategori: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    setImages(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const addAttribute = () => {
    setSelectedAttributes([...selectedAttributes, { id: 0, name: "", options: "", variation: type === 'variable' }]);
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
      showToast("No attributes marked for variations with options", "error");
      return;
    }
    const parsedAttrs = varAttrs.map(a => {
      const names = a.options.split(/[\r\n|,]+/).map(s => s.trim()).filter(Boolean);
      // For global attributes (id > 0), try to find the slug from termsCache
      const optionsWithSlug = names.map(name => {
        if (a.id > 0 && termsCache[a.id]) {
          const term = termsCache[a.id].find((t: any) => t.name === name);
          if (term && term.slug) return { name, slug: term.slug };
        }
        return { name, slug: name };
      });
      return {
        id: a.id,
        name: a.name,
        options: optionsWithSlug
      };
    });
    
    const cartesian = (arrays: any[][]): any[][] =>
      arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]]);
      
    const combinations = cartesian(parsedAttrs.map(a => a.options));
    
    const newVars = combinations.map(comb => {
      const combArray = Array.isArray(comb) ? comb : [comb];
      const attrsForVar = parsedAttrs.map((a, i) => ({ 
        id: a.id, 
        name: a.name, 
        option: combArray[i].name,
        slug: combArray[i].slug 
      }));
      const key = attrsForVar.map(a => a.option).join('-');
      return {
        key,
        attributes: attrsForVar,
        regular_price: regularPrice || "",
        sale_price: salePrice || "",
        sku: sku ? `${sku}-${key.toUpperCase().replace(/\s+/g, '')}` : ""
      };
    });
    setVariations(newVars);
    showToast(`Generated ${newVars.length} variations`, "success");
  };

  const handleUpload = async () => {
    if (!name) { showToast("Product name is required", "error"); return; }
    setLoading(true);
    setUploadStep(null);
    try {
      const descriptionToSave = isHtmlMode ? htmlContent : (editor?.getHTML() || "");
      const payload: any = { name, type, sku, description: descriptionToSave };
      if (type === 'simple') {
        if (regularPrice) payload.regular_price = regularPrice;
        if (salePrice) payload.sale_price = salePrice;
      }
      if (selCatIds.length > 0) {
        const getParentIds = (id: number): number[] => {
          const cat = categories.find(c => c.id === id);
          if (!cat || !cat.parent) return [id];
          return [id, ...getParentIds(cat.parent)];
        };
        const allCatIds = new Set<number>();
        selCatIds.forEach(id => getParentIds(id).forEach(pId => allCatIds.add(pId)));
        payload.categories = Array.from(allCatIds).map(id => ({ id }));
      }
      if (selectedAttributes.length > 0) {
        payload.attributes = selectedAttributes.map(a => ({
          id: a.id, name: a.name, visible: true, variation: a.variation,
          options: a.options.split(/[\r\n|,]+/).map(s => s.trim()).filter(Boolean)
        }));
      }
      if (images.length > 0) payload.images = images.map(img => ({ id: img.id, alt: img.alt }));

      setUploadStep("Membuat produk...");
      showToast("Membuat produk...", "loading");
      const createdProduct = await wooFetch("products", "POST", payload);
      const parentId = createdProduct.id;

      if (type === 'variable' && variations.length > 0) {
        setUploadStep(`Membuat ${variations.length} variasi...`);
        showToast(`Membuat ${variations.length} variasi...`, "loading");
        await wooFetch(`products/${parentId}/variations/batch`, "POST", {
          create: variations.map(v => ({
            regular_price: v.regular_price, sale_price: v.sale_price, sku: v.sku,
            attributes: v.attributes.map(a => ({ 
              id: a.id, 
              name: a.name, 
              // Gunakan slug untuk atribut global (id > 0), jika custom (id === 0) gunakan string opsi
              option: a.id > 0 && a.slug ? a.slug : a.option 
            })),
            ...(v.imageId ? { image: { id: v.imageId } } : {})
          }))
        });
      }

      setUploadStep("Selesai!");
      showToast("Produk berhasil diupload!", "success");
      logActivity({ action: "upload_product", product_id: parentId, product_name: name });
      appendCache("products", createdProduct);
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    } catch (err: any) {
      showToast(err.message, "error");
      setUploadStep(null);
    } finally {
      setLoading(false);
    }
  };

  const groupedCategories = (() => {
    const access = parseCategoryAccess(profile?.pic_category ?? null);
    const isRestricted = profile && (profile.role === 'pic' || profile.role === 'product_staff') && access.woo !== "ALL";
    let allowedCats = categories;

    if (isRestricted) {
      if (!access.woo) return { parents: [], allowedCats: [], orphans: [] };
      const allowedIds = access.woo.split(",").map(id => parseInt(id, 10));
      allowedCats = categories.filter(c => allowedIds.includes(c.id));
    }

    if (catSearch.trim()) {
      allowedCats = allowedCats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));
    }

    const parentIds = new Set(allowedCats.map(c => c.parent));
    allowedCats.filter(c => c.parent === 0).forEach(c => parentIds.add(c.id));

    const parents = categories.filter(c => c.parent === 0 && parentIds.has(c.id)).sort((a,b) => a.name.localeCompare(b.name));
    const orphans = allowedCats.filter(c => c.parent !== 0 && !parents.find(p => p.id === c.parent));

    return { parents, allowedCats, orphans };
  })();

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-white">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p className="text-sm">Memuat data WooCommerce...</p>
      </div>
    );
  }

  return (
    <form onSubmit={e => e.preventDefault()} className="flex flex-col h-full bg-slate-50 overflow-auto">

      {/* ── Topbar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-800 leading-tight truncate">Upload New Product</h2>
          <p className="text-xs text-slate-400 hidden sm:block mt-0.5">Buat produk baru di WooCommerce store</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {uploadStep && <p className="text-xs text-blue-600 font-medium animate-pulse hidden md:block">{uploadStep}</p>}
          <button
            onClick={handleUpload}
            disabled={loading}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{loading ? (uploadStep || "Publishing...") : "Publish"}</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-4 sm:space-y-6 pb-20">

        {/* ── Step 1: Basic Information ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Informasi Dasar</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Product name + SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-400 outline-none transition-all text-sm"
                  placeholder="MOTHERBOARD XYZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU</label>
                <input
                  type="text"
                  value={sku} onChange={e => setSku(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-400 outline-none transition-all text-sm"
                  placeholder="MBD-001"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategori</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setShowCatDD(!showCatDD)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-left hover:border-slate-400 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  >
                    <span className={selCatIds.length ? "text-slate-800 font-medium" : "text-slate-400"}>
                      {selCatIds.length === 0
                        ? "Pilih kategori..."
                        : `${selCatIds.length} kategori dipilih`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showCatDD ? "rotate-180" : ""}`} />
                  </button>

                  {showCatDD && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowCatDD(false)} />
                      <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 shadow-xl rounded-2xl z-20 overflow-hidden flex flex-col max-h-64">
                        <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Cari kategori..."
                            value={catSearch} onChange={e => setCatSearch(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {selCatIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelCatIds([])}
                              className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 whitespace-nowrap transition-colors"
                            >
                              Hapus semua
                            </button>
                          )}
                        </div>
                        <div className="overflow-y-auto p-1.5 flex-1 max-h-60">
                            {groupedCategories.allowedCats.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-4">Kategori tidak ditemukan</p>
                            ) : (() => {
                                const renderItem = (c: any, isChild = false) => {
                                  const isAllowed = groupedCategories.allowedCats.some(allowed => allowed.id === c.id);
                                  if (!isAllowed && !isChild) {
                                    return (
                                      <div key={c.id} className="flex items-center gap-1.5 px-3 py-1">
                                        <span className="text-xs font-semibold text-slate-400">{c.name}</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={c.id} className="flex items-center gap-1 group">
                                      <button
                                        type="button"
                                        onClick={() => setSelCatIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                                        className={`flex-1 text-left px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 transition-colors ${selCatIds.includes(c.id) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
                                      >
                                        <input type="checkbox" checked={selCatIds.includes(c.id)} readOnly className="rounded text-blue-600 focus:ring-blue-500 shrink-0" />
                                        <span className={`truncate ${isChild ? "text-xs text-slate-600" : "text-sm font-semibold"}`}>{c.name}</span>
                                      </button>
                                      {profile?.role === 'admin' && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id, c.name); }}
                                          className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                                          title="Hapus Kategori"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                };

                                return (
                                  <div className="space-y-2">
                                    {groupedCategories.parents.map(p => {
                                      const children = groupedCategories.allowedCats.filter(c => c.parent === p.id).sort((a,b) => a.name.localeCompare(b.name));
                                      return (
                                        <div key={`group-${p.id}`} className="space-y-0.5">
                                          {renderItem(p, false)}
                                          {children.length > 0 && (
                                            <div className="pl-6 border-l-2 border-slate-100 ml-3 space-y-0.5">
                                              {children.map(c => renderItem(c, true))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {groupedCategories.orphans.length > 0 && (
                                      <div className="space-y-0.5 pt-2 border-t border-slate-100 mt-2">
                                        <span className="text-[11px] font-semibold text-slate-500 px-3 block mb-1">Kategori Lainnya</span>
                                        {groupedCategories.orphans.map(c => renderItem(c, true))}
                                      </div>
                                    )}
                                  </div>
                                );
                            })()}
                          
                          {/* Create New Category Button */}
                          {catSearch.trim() && !categories.some(c => c.name.toLowerCase() === catSearch.toLowerCase().trim()) && (
                            <button
                              type="button"
                              onClick={() => handleCreateCategory(catSearch.trim())}
                              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors border border-blue-100"
                            >
                              <Plus className="w-4 h-4" />
                              Tambah "{catSearch.trim()}"
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {selCatIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelCatIds([])}
                    title="Reset semua kategori"
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-300 rounded-xl transition-colors shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Selected category chips */}
              {selCatIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {categories.filter(c => selCatIds.includes(c.id)).map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                      {c.name}
                      <button
                        type="button"
                        onClick={() => setSelCatIds(prev => prev.filter(id => id !== c.id))}
                        className="hover:text-blue-900 transition-colors ml-0.5"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Deskripsi Produk</label>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                    isHtmlMode 
                      ? 'bg-blue-50 text-blue-700 border-blue-200' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> HTML Mode
                </button>
              </div>

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
        </section>

        {/* ── Step 2: Images ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Gambar Produk</h3>
          </div>
          <div className="p-4 sm:p-6">
            <label className={`flex flex-col items-center justify-center gap-2 w-full py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              uploadingImages ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
            }`}>
              <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingImages}
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
              {uploadingImages ? (
                <>
                  <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
                  <span className="text-sm text-blue-600 font-medium">Mengupload gambar...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-7 h-7 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Klik untuk pilih gambar</p>
                    <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WebP · bisa pilih lebih dari satu</p>
                  </div>
                </>
              )}
            </label>

            {images.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-slate-400">
                  <span className="font-semibold">Drag & drop</span> untuk mengubah urutan.{" "}
                  <span className="font-semibold text-blue-600">Gambar pertama = Featured Image.</span>
                </p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="image-list">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {images.map((img, i) => (
                          <Draggable key={img.id} draggableId={String(img.id)} index={i}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`flex items-center gap-3 p-2.5 bg-slate-50 border rounded-xl transition-colors ${
                                  snapshot.isDragging
                                    ? "border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-200"
                                    : "border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {/* Drag handle */}
                                <div {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.src} alt={img.alt} className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-lg shrink-0 border border-slate-200" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {i === 0 && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">★ Featured</span>}
                                    <span className="text-xs text-slate-500 truncate">{img.alt}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-300 mt-0.5 font-mono">ID: {img.id}</p>
                                </div>
                                <div className="flex items-center shrink-0">
                                  <button type="button" onClick={() => setImages(prev => prev.filter(x => x.id !== img.id))}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
                                    <XIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}
          </div>
        </section>

        {/* ── Step 3: Product Data ── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">Data Produk</h3>
            </div>

            {/* Product type toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => { setType("simple"); setVariations([]); }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${type === "simple" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setType("variable")}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${type === "variable" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Variable
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Price (Simple only) */}
            {type === 'simple' && (
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga Normal (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={regularPrice ? formatNumber(regularPrice) : ""}
                    onChange={e => setRegularPrice(parseFormattedNumber(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="100.000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga Coret (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={salePrice ? formatNumber(salePrice) : ""}
                    onChange={e => setSalePrice(parseFormattedNumber(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="80.000"
                  />
                </div>
              </div>
            )}

            {/* Attributes */}
            <div className={type === 'simple' ? "border-t border-slate-100 pt-6" : ""}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">Atribut Produk</h4>
                <button
                  type="button"
                  onClick={addAttribute}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Atribut
                </button>
              </div>

              {selectedAttributes.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-400">Belum ada atribut. Klik "Tambah Atribut" untuk mulai.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedAttributes.map((attr, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      {/* Attribute header row */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          {/* Type selector + custom name */}
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
                              {/* Reset attribute to Custom */}
                              {attr.id !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateAttribute(idx, 'id', "0")}
                                  title="Reset ke Custom Attribute"
                                  className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg border border-slate-200 transition-colors shrink-0"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
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

                          {/* Used for variations toggle */}
                          {type === 'variable' && (
                            <label className="inline-flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={attr.variation}
                                onChange={e => updateAttribute(idx, 'variation', e.target.checked)}
                                className="rounded text-blue-600"
                              />
                              <span className="text-xs font-medium">Digunakan untuk variasi</span>
                            </label>
                          )}
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

                      {/* Values */}
                      <div>
                        {attr.id === 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium text-slate-500">Nilai (pisahkan dengan | atau ,)</label>
                              {attr.options && (
                                <button type="button" onClick={() => updateAttribute(idx, 'options', '')}
                                  className="text-xs text-red-500 hover:text-red-600 hover:underline transition-colors">
                                  Hapus semua
                                </button>
                              )}
                            </div>
                            <textarea
                              value={attr.options}
                              onChange={e => updateAttribute(idx, 'options', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                              placeholder="Contoh: Merah | Biru | Hijau, atau pisah dengan Enter"
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
                              <div className="flex items-center gap-2">
                                <button type="button"
                                  onClick={() => {
                                    const all = termsCache[attr.id].map(t => t.name).join(' | ');
                                    updateAttribute(idx, 'options', all);
                                  }}
                                  className="text-xs text-blue-500 hover:text-blue-600 hover:underline transition-colors">
                                  Pilih semua
                                </button>
                                {attr.options && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <button type="button" onClick={() => updateAttribute(idx, 'options', '')}
                                      className="text-xs text-red-500 hover:text-red-600 hover:underline transition-colors">
                                      Hapus semua
                                    </button>
                                  </>
                                )}
                              </div>
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
            </div>

            {/* Variations (Variable only) */}
            {type === 'variable' && (
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Variasi
                    {variations.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{variations.length} variasi</span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2">
                    {variations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setVariations([])}
                        title="Reset semua variasi"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={generateVariations}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Generate Variasi
                    </button>
                  </div>
                </div>

                {variations.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-sm text-slate-500 mb-1">Belum ada variasi.</p>
                    <p className="text-xs text-slate-400">Tambah atribut, centang "Digunakan untuk variasi", lalu klik Generate.</p>
                  </div>
                ) : (
                  <>
                    {/* ── Desktop table ── */}
                    <div className="hidden md:block space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-1">Img</div>
                        <div className="col-span-3">Variasi</div>
                        <div className="col-span-3">SKU</div>
                        <div className="col-span-2">Harga Normal</div>
                        <div className="col-span-2">Harga Coret</div>
                        <div className="col-span-1" />
                      </div>
                      {variations.map((v, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl items-center hover:border-slate-300 transition-colors">
                          <div className="col-span-1">
                            <button type="button" onClick={() => setVarImgPickerOpen(i)}
                              className={`w-9 h-9 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-colors ${v.imageSrc ? 'border-blue-400 p-0' : 'border-dashed border-slate-300 hover:border-blue-400 bg-slate-50'}`}>
                              {v.imageSrc
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={v.imageSrc} alt="" className="w-full h-full object-cover" />
                                : <Camera className="w-3.5 h-3.5 text-slate-400" />}
                            </button>
                          </div>
                          <div className="col-span-3 text-sm font-medium text-slate-700 truncate">{v.attributes.map(a => a.option).join(' · ')}</div>
                          <div className="col-span-3">
                            <input type="text" value={v.sku}
                              onChange={e => { const nv = [...variations]; nv[i].sku = e.target.value; setVariations(nv); }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="SKU" />
                          </div>
                          <div className="col-span-2">
                            <input type="text" inputMode="numeric" value={v.regular_price ? formatNumber(v.regular_price) : ""}
                              onChange={e => { const nv = [...variations]; nv[i].regular_price = parseFormattedNumber(e.target.value); setVariations(nv); }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="100.000" />
                          </div>
                          <div className="col-span-2">
                            <input type="text" inputMode="numeric" value={v.sale_price ? formatNumber(v.sale_price) : ""}
                              onChange={e => { const nv = [...variations]; nv[i].sale_price = parseFormattedNumber(e.target.value); setVariations(nv); }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 text-red-600"
                              placeholder="80.000" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button type="button" onClick={() => { const nv = [...variations]; nv.splice(i, 1); setVariations(nv); }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Mobile cards ── */}
                    <div className="md:hidden space-y-3">
                      {variations.map((v, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <button type="button" onClick={() => setVarImgPickerOpen(i)}
                                className={`w-9 h-9 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-colors shrink-0 ${v.imageSrc ? 'border-blue-400 p-0' : 'border-dashed border-slate-300 bg-slate-50'}`}>
                                {v.imageSrc
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={v.imageSrc} alt="" className="w-full h-full object-cover" />
                                  : <Camera className="w-3.5 h-3.5 text-slate-400" />}
                              </button>
                              <span className="text-sm font-semibold text-slate-800">{v.attributes.map(a => a.option).join(' · ')}</span>
                            </div>
                            <button type="button" onClick={() => { const nv = [...variations]; nv.splice(i, 1); setVariations(nv); }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input type="text" value={v.sku}
                              onChange={e => { const nv = [...variations]; nv[i].sku = e.target.value; setVariations(nv); }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="SKU Variasi" />
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 font-medium mb-1 block">Harga Normal</label>
                                <input type="text" inputMode="numeric" value={v.regular_price ? formatNumber(v.regular_price) : ""}
                                  onChange={e => { const nv = [...variations]; nv[i].regular_price = parseFormattedNumber(e.target.value); setVariations(nv); }}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="100.000" />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 font-medium mb-1 block">Harga Coret</label>
                                <input type="text" inputMode="numeric" value={v.sale_price ? formatNumber(v.sale_price) : ""}
                                  onChange={e => { const nv = [...variations]; nv[i].sale_price = parseFormattedNumber(e.target.value); setVariations(nv); }}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 text-red-600"
                                  placeholder="80.000" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium z-50 max-w-xs sm:max-w-sm w-full ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {toast.type === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> :
           toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> :
           <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
        </div>
      )}

      {/* ── Variation image picker ── */}
      {varImgPickerOpen !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setVarImgPickerOpen(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 w-full sm:max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-800 text-sm">Pilih Gambar Variasi</h4>
              <button type="button" onClick={() => setVarImgPickerOpen(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <XIcon className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {images.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Upload gambar produk dulu di bagian atas.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button type="button"
                  onClick={() => {
                    const idx = varImgPickerOpen;
                    setVariations(prev => prev.map((v, i) => i === idx ? { ...v, imageId: undefined, imageSrc: undefined } : v));
                    setVarImgPickerOpen(null);
                  }}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xs font-medium transition-colors ${
                    !variations[varImgPickerOpen]?.imageId ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  Tidak ada
                </button>
                {images.map(img => {
                  const selected = variations[varImgPickerOpen]?.imageId === img.id;
                  return (
                    <button key={img.id} type="button"
                      onClick={() => {
                        const idx = varImgPickerOpen;
                        setVariations(prev => prev.map((v, i) => i === idx ? { ...v, imageId: img.id, imageSrc: img.src } : v));
                        setVarImgPickerOpen(null);
                      }}
                      className={`aspect-square rounded-xl border-2 overflow-hidden transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
