"use client";

import { useState, useEffect } from "react";
import { fetchAll, wooFetch, appendCache } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Save, AlertCircle, RefreshCw, CheckCircle2, ChevronDown, Plus, Trash2, Bold, Italic, List, ListOrdered, ImagePlus, X as XIcon } from "lucide-react";

export default function UploadProductPage() {
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: "success"|"error"|"loading"} | null>(null);

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
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [catSearch, setCatSearch] = useState("");
  const [showCatDD, setShowCatDD] = useState(false);

  // Tiptap Editor for Description
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[200px] p-4 bg-white border border-slate-200 rounded-b-lg'
      }
    }
  });

  const [selectedAttributes, setSelectedAttributes] = useState<{
    id: number;
    name: string;
    options: string; // Comma separated for input
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
  }[]>([]);

  useEffect(() => {
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

  const addAttribute = () => {
    if (globalAttributes.length === 0) {
      // Allow custom attributes if none global exist, but global is safer
      setSelectedAttributes([...selectedAttributes, { id: 0, name: "", options: "", variation: type === 'variable' }]);
    } else {
      setSelectedAttributes([...selectedAttributes, { id: globalAttributes[0].id, name: globalAttributes[0].name, options: "", variation: type === 'variable' }]);
    }
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
    // Collect attributes marked for variation
    const varAttrs = selectedAttributes.filter(a => a.variation && a.options.trim());
    if (varAttrs.length === 0) {
      showToast("No attributes marked for variations with options", "error");
      return;
    }

    // Parse options: split by | or ,
    const parsedAttrs = varAttrs.map(a => ({
      id: a.id,
      name: a.name,
      options: a.options.split(/[|,]/).map(s => s.trim()).filter(Boolean)
    }));

    // Cartesian product of options
    const cartesian = (arrays: any[][]): any[][] => {
      return arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]]);
    };

    const combinations = cartesian(parsedAttrs.map(a => a.options));

    const newVars = combinations.map(comb => {
      const combArray = Array.isArray(comb) ? comb : [comb];
      const attrsForVar = parsedAttrs.map((a, i) => ({
        id: a.id,
        name: a.name,
        option: combArray[i]
      }));
      const key = attrsForVar.map(a => a.option).join('-');
      return {
        key,
        attributes: attrsForVar,
        regular_price: regularPrice || "", // Default to parent's price if set
        sale_price: salePrice || "",
        sku: sku ? `${sku}-${key.toUpperCase().replace(/\s+/g, '')}` : ""
      };
    });

    setVariations(newVars);
    showToast(`Generated ${newVars.length} variations`, "success");
  };

  const handleUpload = async () => {
    if (!name) {
      showToast("Product name is required", "error");
      return;
    }

    setLoading(true);
    setUploadStep(null);

    try {
      // 1. Prepare Parent Product payload
      const payload: any = {
        name,
        type,
        sku,
        description: editor?.getHTML() || "",
      };

      // Only attach prices if they exist, to prevent "0" defaults
      if (type === 'simple') {
        if (regularPrice) payload.regular_price = regularPrice;
        if (salePrice) payload.sale_price = salePrice;
      }

      if (selCatId) {
        // Find all parent categories recursively
        const getParentIds = (id: number): number[] => {
          const cat = categories.find(c => c.id === id);
          if (!cat || !cat.parent) return [id];
          return [id, ...getParentIds(cat.parent)];
        };
        const allCatIds = getParentIds(selCatId);
        payload.categories = allCatIds.map(id => ({ id }));
      }

      if (selectedAttributes.length > 0) {
        payload.attributes = selectedAttributes.map(a => ({
          id: a.id,
          name: a.name,
          visible: true,
          variation: a.variation,
          options: a.options.split(/[|,]/).map(s => s.trim()).filter(Boolean)
        }));
      }

      // Attach uploaded images
      if (images.length > 0) {
        payload.images = images.map(img => ({ id: img.id, alt: img.alt }));
      }

      // 2. Create Parent Product
      setUploadStep("Membuat produk...");
      showToast("Membuat produk...", "loading");
      const createdProduct = await wooFetch("products", "POST", payload);
      const parentId = createdProduct.id;

      // 3. Create Variations if variable
      if (type === 'variable' && variations.length > 0) {
        setUploadStep(`Membuat ${variations.length} variasi...`);
        showToast(`Membuat ${variations.length} variasi...`, "loading");
        const createVarsPayload = {
          create: variations.map(v => ({
            regular_price: v.regular_price,
            sale_price: v.sale_price,
            sku: v.sku,
            attributes: v.attributes.map(a => ({
              id: a.id,
              name: a.name,
              option: a.option
            }))
          }))
        };

        await wooFetch(`products/${parentId}/variations/batch`, "POST", createVarsPayload);
      }

      setUploadStep("Selesai! Mengalihkan ke dashboard...");
      showToast("Produk berhasil diupload!", "success");

      // Log activity
      logActivity({ action: "upload_product", product_id: parentId, product_name: name });

      // Manually inject into local cache so dashboard is instant
      appendCache("products", createdProduct);

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);

    } catch (err: any) {
      showToast(err.message, "error");
      setUploadStep(null);
    } finally {
      setLoading(false);
    }
  };

  // Category Tree building
  const catTree = (() => {
    const buildTree = (parentId = 0, depth = 0): any[] => {
      return categories
        .filter(c => c.parent === parentId)
        .flatMap(c => [{ ...c, depth }, ...buildTree(c.id, depth + 1)]);
    };
    const tree = buildTree();
    if (!catSearch.trim()) return tree;
    return tree.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));
  })();

  const selectedCatName = selCatId === null 
    ? "Select a Category..." 
    : categories.find(c => c.id === selCatId)?.name || "Unknown";


  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-white">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p>Loading attributes and categories...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-auto">
      {/* Topbar */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-20 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Upload New Product</h2>
          <p className="text-sm text-slate-500 mt-1">Create a new product in your WooCommerce store</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleUpload}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Publish Product
          </button>
          {uploadStep && (
            <p className="text-xs text-blue-600 font-medium animate-pulse">{uploadStep}</p>
          )}
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Basic Info Section */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                placeholder="MOTHERBOARD XYZ"
              />
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <input 
                type="text" 
                value={sku} onChange={e => setSku(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                placeholder="MOTHERBOARD-001"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <div className="relative">
                <button 
                  onClick={() => setShowCatDD(!showCatDD)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-left focus:ring-2 focus:ring-blue-500"
                >
                  <span className="text-slate-700">{selectedCatName}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                
                {showCatDD && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCatDD(false)} />
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 shadow-xl rounded-xl z-20 overflow-hidden flex flex-col max-h-64">
                      <div className="p-2 border-b border-slate-100">
                        <input 
                          type="text" 
                          placeholder="Search categories..." 
                          value={catSearch} onChange={e => setCatSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="overflow-y-auto p-1 flex-1">
                        {catTree.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setSelCatId(c.id); setShowCatDD(false); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 ${selCatId === c.id ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"}`}
                          >
                            <span className="text-slate-300 mr-1">{'—'.repeat(c.depth)}</span>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Description</label>
              <div className="rounded-lg overflow-hidden border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500">
                <div className="flex items-center gap-1 bg-slate-100 border-b border-slate-200 p-2">
                  <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-slate-200 ${editor?.isActive('bold') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><Bold className="w-4 h-4" /></button>
                  <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-slate-200 ${editor?.isActive('italic') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><Italic className="w-4 h-4" /></button>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-slate-200 ${editor?.isActive('bulletList') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><List className="w-4 h-4" /></button>
                  <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-slate-200 ${editor?.isActive('orderedList') ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}><ListOrdered className="w-4 h-4" /></button>
                </div>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </section>

        {/* Product Images Section */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">
            Gambar Produk
          </h3>

          {/* Upload area */}
          <label className={`flex flex-col items-center justify-center gap-3 w-full py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            uploadingImages
              ? "border-blue-300 bg-blue-50"
              : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
          }`}>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploadingImages}
              onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
            />
            {uploadingImages ? (
              <>
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-blue-600 font-medium">Mengupload gambar...</span>
              </>
            ) : (
              <>
                <ImagePlus className="w-8 h-8 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Klik untuk pilih gambar</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP — bisa pilih lebih dari satu</p>
                </div>
              </>
            )}
          </label>

          {/* Preview grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {images.map((img, i) => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-24 object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold">
                      Featured
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((x) => x.id !== img.id))}
                    className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Hapus gambar"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Product Data Section */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-lg font-semibold text-slate-800">Product Data</h3>
            <select 
              value={type} 
              onChange={e => setType(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="simple">Simple Product</option>
              <option value="variable">Variable Product</option>
            </select>
          </div>

          {type === 'simple' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Regular Price (Rp)</label>
                <input 
                  type="number" 
                  value={regularPrice} onChange={e => setRegularPrice(e.target.value)}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sale Price (Rp)</label>
                <input 
                  type="number" 
                  value={salePrice} onChange={e => setSalePrice(e.target.value)}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="80000"
                />
              </div>
            </div>
          )}

          {/* Attributes Section */}
          <div className={`mt-6 pt-4 ${type==='simple' ? 'border-t border-slate-100' : ''}`}>
            <h4 className="text-md font-medium text-slate-800 mb-3">Attributes</h4>
            
            {selectedAttributes.map((attr, idx) => (
              <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-3">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <select 
                      value={attr.id}
                      onChange={e => updateAttribute(idx, 'id', e.target.value)}
                      className="w-1/3 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                    >
                      {globalAttributes.length === 0 && <option value="0">Custom Attribute</option>}
                      {globalAttributes.map(ga => (
                        <option key={ga.id} value={ga.id}>{ga.name}</option>
                      ))}
                    </select>
                    
                    {attr.id === 0 && (
                      <input 
                        type="text" 
                        placeholder="Attribute Name"
                        value={attr.name}
                        onChange={e => updateAttribute(idx, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                      />
                    )}

                    {type === 'variable' && (
                      <label className="flex items-center gap-2 text-sm text-slate-600 ml-auto bg-white px-3 py-1.5 border border-slate-200 rounded-lg">
                        <input 
                          type="checkbox" 
                          checked={attr.variation}
                          onChange={e => updateAttribute(idx, 'variation', e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        Used for variations
                      </label>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Values</label>
                    {attr.id === 0 ? (
                      <textarea 
                        value={attr.options}
                        onChange={e => updateAttribute(idx, 'options', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Red | Blue | Green or S, M, L"
                        rows={2}
                      />
                    ) : loadingTerms[attr.id] ? (
                      <div className="text-sm text-slate-400 py-2 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/> Loading terms...</div>
                    ) : termsCache[attr.id]?.length > 0 ? (
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-white">
                        {termsCache[attr.id].map(term => {
                          const isChecked = attr.options.split(/[|,]/).map(s => s.trim()).includes(term.name);
                          return (
                            <label key={term.id} className="flex items-center gap-1.5 text-sm text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100 hover:bg-slate-100 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="rounded text-blue-600"
                                checked={isChecked}
                                onChange={(e) => {
                                  let current = attr.options.split(/[|,]/).map(s => s.trim()).filter(Boolean);
                                  if (e.target.checked) {
                                    if (!current.includes(term.name)) current.push(term.name);
                                  } else {
                                    current = current.filter(c => c !== term.name);
                                  }
                                  updateAttribute(idx, 'options', current.join(' | '));
                                }}
                              />
                              {term.name}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 py-2">No terms found for this attribute.</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-start">
                  <button 
                    onClick={() => removeAttribute(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove Attribute"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            <button 
              onClick={addAttribute}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Attribute
            </button>
          </div>

          {/* Variations Generation (Only for Variable) */}
          {type === 'variable' && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-slate-800">Variations</h4>
                <button 
                  onClick={generateVariations}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" /> Generate Variations
                </button>
              </div>

              {variations.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <div className="col-span-4">Variation Attributes</div>
                    <div className="col-span-3">SKU</div>
                    <div className="col-span-2">Regular Price</div>
                    <div className="col-span-2">Sale Price</div>
                  </div>
                  
                  {variations.map((v, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 px-4 py-3 bg-white border border-slate-200 rounded-xl items-center shadow-sm">
                      <div className="col-span-4 flex flex-wrap gap-1 text-sm text-slate-700 font-medium">
                        {v.attributes.map(a => `${a.option}`).join(' • ')}
                      </div>
                      <div className="col-span-3">
                        <input 
                          type="text" value={v.sku} 
                          onChange={e => {
                            const nv = [...variations];
                            nv[i].sku = e.target.value;
                            setVariations(nv);
                          }}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="SKU"
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" value={v.regular_price} 
                          onChange={e => {
                            const nv = [...variations];
                            nv[i].regular_price = e.target.value;
                            setVariations(nv);
                          }}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Rp"
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" value={v.sale_price} 
                          onChange={e => {
                            const nv = [...variations];
                            nv[i].sale_price = e.target.value;
                            setVariations(nv);
                          }}
                          onWheel={e => (e.target as HTMLElement).blur()}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 text-red-600"
                          placeholder="Rp"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button onClick={() => {
                          const nv = [...variations];
                          nv.splice(i, 1);
                          setVariations(nv);
                        }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                  <p className="text-slate-500 text-sm mb-2">No variations generated yet.</p>
                  <p className="text-xs text-slate-400">Add attributes above, mark "Used for variations", and click "Generate Variations".</p>
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium z-50 animate-in slide-in-from-bottom-5 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {toast.type === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
           toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
           <AlertCircle className="w-4 h-4 text-red-500" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
