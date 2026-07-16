import { useState, useEffect } from "react";
import { WooProduct, WooVariation, wooFetch } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { ChevronRight, ChevronDown, RefreshCw, Globe, Lock, Trash2, ListTree, GitBranch, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import { formatNumber, parseFormattedNumber } from "@/lib/format";

type StockState = "instock" | "outofstock";

export function EditableCell({ id, parentId, field, val, type, prodType, prefix = "", productName = "", onUpdate, showToast }: {
  id: number;
  parentId?: number;
  field: "sku" | "name" | "regular_price" | "sale_price";
  val: string;
  type: "text" | "number";
  prodType: "simple" | "variation";
  prefix?: string;
  productName?: string;
  onUpdate: (id: number, field: string, val: string, type: string, parentId?: number) => void;
  showToast: (msg: string, type: "success" | "error" | "loading") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(val || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(val || "");
  }, [val]);

  const handleSave = async () => {
    if (value === (val || "")) {
      setEditing(false);
      return;
    }

    setSaving(true);
    showToast("Saving...", "loading");
    try {
      const endpoint = prodType === 'variation' && parentId
        ? `products/${parentId}/variations/${id}`
        : `products/${id}`;

      await wooFetch(endpoint, 'PUT', { [field]: value });
      onUpdate(id, field, value, prodType, parentId);
      const actionMap: Record<string, string> = { sku: "update_sku", name: "update_name", regular_price: "update_price", sale_price: "update_sale_price" };
      logActivity({ action: actionMap[field] ?? `update_${field}`, product_id: id, product_name: productName || undefined, field, old_value: val || "", new_value: value });
      showToast("Saved successfully!", "success");
      setEditing(false);
    } catch (err: any) {
      showToast("Failed to save: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setValue(val || "");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 relative z-10" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          type="text"
          value={type === 'number' ? formatNumber(String(value)) : value}
          onChange={e => {
            if (type === 'number') {
              setValue(parseFormattedNumber(e.target.value));
            } else {
              setValue(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-full min-w-[80px] max-w-[160px] px-2 py-1 text-sm border border-blue-500 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
        <button onClick={handleSave} disabled={saving} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setValue(val || ""); setEditing(false); }} disabled={saving} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group inline-flex items-center gap-2 cursor-pointer px-2 py-1 -ml-2 rounded hover:bg-slate-200/50 transition-colors"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      <span>
        {value ? (
          <>
            <span className="opacity-60 text-xs mr-0.5">{prefix}</span>
            {type === 'number' ? Number(value).toLocaleString('id-ID') : value}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </span>
      <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export type SharedProductProps = {
  product: WooProduct;
  expanded: boolean;
  onToggleExpand: () => void;
  varCache: WooVariation[];
  isLoadingVars: boolean;
  isUpdatingStock: boolean;
  onToggleStock: () => void;
  isUpdatingStatus: boolean;
  onToggleStatus: () => void;
  isDeleting: boolean;
  onDelete: () => void;
  updatingVarStock: Set<string>;
  onToggleVariationStock: (v: WooVariation) => void;
  onUpdate: (id: number, field: string, val: string, type: string, parentId?: number) => void;
  showToast: (msg: string, type: "success" | "error" | "loading") => void;
  mappedPrices: Record<number, { cp: string | null; price: string | null; sp: string | null }>;
  isAdmin: boolean;
};

export function ProductRow(props: SharedProductProps) {
  const { product: p, expanded, onToggleExpand, varCache, isLoadingVars, isUpdatingStock, onToggleStock, isUpdatingStatus, onToggleStatus, isDeleting, onDelete, updatingVarStock, onToggleVariationStock, onUpdate, showToast, mappedPrices, isAdmin } = props;
  const isVar = p.type === 'variable';
  const stockStatus: StockState = p.stock_status === "outofstock" ? "outofstock" : "instock";
  const isPublished = p.status !== 'private';

  return (
    <>
      <tr className={`group border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${isVar ? "border-l-2 border-l-purple-300" : "border-l-2 border-l-transparent"}`}>
        <td className="px-2 py-3 w-10">
          {isVar ? (
            <button
              onClick={onToggleExpand}
              className={`p-1.5 rounded-lg transition-colors ${expanded ? "bg-purple-100 text-purple-600" : "text-slate-300 hover:text-slate-600 hover:bg-slate-100"}`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-7 h-7" />
          )}
        </td>
        <td className="px-3 py-3 hidden md:table-cell">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{p.id}</span>
        </td>
        <td className="px-3 py-3 hidden sm:table-cell">
          <EditableCell id={p.id} field="sku" val={p.sku} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} />
        </td>
        <td className="px-3 py-3 max-w-[220px]">
          <div className="font-medium text-slate-800 leading-snug">
            <EditableCell id={p.id} field="name" val={p.name} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {/* Type badge — always visible on mobile, hidden md+ (shown in dedicated col) */}
            <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold md:hidden ${isVar ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
              {isVar ? "Variable" : "Simple"}
            </span>
            {p.sku && <span className="sm:hidden text-[10px] text-slate-400 font-mono truncate">{p.sku}</span>}
          </div>
        </td>
        <td className="px-3 py-3 hidden md:table-cell">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${isVar
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-sky-50 text-sky-700 border-sky-200"
            }`}>
            {isVar ? "Variable" : "Simple"}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stockStatus === "instock" ? "bg-green-500" : "bg-red-400"}`} />
            <span className={`text-xs font-medium ${stockStatus === "instock" ? "text-green-700" : "text-red-600"}`}>
              {stockStatus === "instock" ? "In Stock" : "Habis"}
            </span>
          </div>
        </td>
        <td className="px-3 py-3 hidden sm:table-cell">
          {isVar
            ? <span className="text-slate-300 text-xs italic">per variasi</span>
            : <EditableCell id={p.id} field="regular_price" val={p.regular_price} type="number" prodType="simple" prefix="Rp " productName={p.name} onUpdate={onUpdate} showToast={showToast} />
          }
        </td>
        <td className="px-3 py-3 hidden lg:table-cell">
          <div className="text-xs font-medium text-slate-600">
            {isVar ? <span className="text-slate-300">—</span> : <EditableCell id={p.id} field="sale_price" val={p.sale_price || ""} type="number" prodType="simple" prefix="Rp " productName={p.name} onUpdate={onUpdate} showToast={showToast} />}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1.5">
            {/* Stock toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleStock(); }}
                disabled={isUpdatingStock}
                role="switch"
                aria-checked={stockStatus === "instock"}
                title={stockStatus === "instock" ? "Klik untuk Habis" : "Klik untuk In Stock"}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${stockStatus === "instock" ? "bg-green-500" : "bg-slate-300"} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${stockStatus === "instock" ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
              <span className={`text-[11px] font-medium leading-none ${stockStatus === "instock" ? "text-green-700" : "text-slate-400"}`}>
                {isUpdatingStock ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : stockStatus === "instock" ? "Ada" : "Habis"}
              </span>
            </div>
            {/* Status (Publish / Private) */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
              disabled={isUpdatingStatus}
              title={isPublished ? "Klik untuk Private" : "Klik untuk Publish"}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors w-fit disabled:opacity-40 disabled:cursor-not-allowed ${isPublished
                  ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                }`}
            >
              {isUpdatingStatus
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : isPublished ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />
              }
              {isPublished ? "Publish" : "Private"}
            </button>
            {/* Delete button */}
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={isDeleting}
                title="Hapus Produk"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors w-fit disabled:opacity-40 disabled:cursor-not-allowed bg-red-50 text-red-600 border-red-200 hover:bg-red-100`}
              >
                {isDeleting
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <Trash2 className="w-3 h-3" />
                }
                Hapus
              </button>
            )}
            <Link
              href={`/dashboard/manage/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              title="Edit Produk & Variasi"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors w-fit ${isVar
                  ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                }`}
            >
              {isVar ? <ListTree className="w-3 h-3" /> : <GitBranch className="w-3 h-3" />}
              {isVar ? "Edit Variasi" : "Ke Variable"}
            </Link>
          </div>
        </td>
      </tr>

      {expanded && isVar && (
        isLoadingVars ? (
          <tr className="bg-slate-50 border-l-4 border-l-purple-300">
            <td colSpan={8} className="px-8 py-4 text-center text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading variations...
            </td>
          </tr>
        ) : varCache.length > 0 ? (
          varCache.map((v) => {
            const varInStock = v.stock_status !== "outofstock";
            return (
              <tr key={v.id} className="bg-violet-50/40 border-b border-slate-100 border-l-2 border-l-purple-400 hover:bg-violet-50">
                <td className="px-2 py-2 w-10">
                  <div className="flex justify-center">
                    <div className="w-px h-4 bg-purple-200" />
                  </div>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-50 px-1.5 py-0.5 rounded">#{v.id}</span>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <EditableCell id={v.id} parentId={p.id} field="sku" val={v.sku} type="text" prodType="variation" productName={`${p.name} — Variasi #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium">
                    <ChevronRight className="w-3 h-3 text-purple-300 shrink-0" />
                    <span className="truncate">{v.attributes?.map((a) => `${a.name}: ${a.option}`).join(" • ") || "Variation"}</span>
                  </div>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                    Var
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${varInStock ? "bg-green-500" : "bg-red-400"}`} />
                    <span className={`text-[11px] font-medium ${varInStock ? "text-green-700" : "text-red-600"}`}>
                      {varInStock ? "Ada" : "Habis"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <EditableCell id={v.id} parentId={p.id} field="regular_price" val={v.regular_price} type="number" prodType="variation" prefix="Rp " productName={`${p.name} — Variasi #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                </td>
                <td className="px-3 py-2 hidden lg:table-cell">
                  <div className="text-[11px] font-medium text-slate-500">
                    <EditableCell id={v.id} parentId={p.id} field="sale_price" val={v.sale_price || ""} type="number" prodType="variation" prefix="Rp " productName={`${p.name} #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleVariationStock(v)}
                      disabled={updatingVarStock.has(`${p.id}-${v.id}`)}
                      role="switch"
                      aria-checked={varInStock}
                      title={varInStock ? "Klik untuk Habis" : "Klik untuk Ada"}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${varInStock ? "bg-green-500" : "bg-slate-300"} disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${varInStock ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                    </button>
                    {updatingVarStock.has(`${p.id}-${v.id}`) && (
                      <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        ) : (
          <tr className="bg-slate-50 border-l-4 border-l-purple-300">
            <td colSpan={8} className="px-8 py-4 text-center text-slate-500 text-sm italic">
              No variations found for this product.
            </td>
          </tr>
        )
      )}
    </>
  );
}

export function ProductCard(props: SharedProductProps) {
  const { product: p, expanded, onToggleExpand, varCache, isLoadingVars, isUpdatingStock, onToggleStock, isUpdatingStatus, onToggleStatus, isDeleting, onDelete, updatingVarStock, onToggleVariationStock, onUpdate, showToast, isAdmin } = props;
  const isVar = p.type === 'variable';
  const stockStatus: StockState = p.stock_status === "outofstock" ? "outofstock" : "instock";
  const isPublished = p.status !== 'private';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-3.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-bold tracking-wide ${isVar ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                {isVar ? "Variable" : "Simple"}
              </span>
              <span className="text-[10px] font-mono text-slate-300">#{p.id}</span>
            </div>
            <div className="font-semibold text-slate-800 text-[15px] leading-snug">
              <EditableCell id={p.id} field="name" val={p.name} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} />
            </div>
            {p.sku && (
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">SKU: <EditableCell id={p.id} field="sku" val={p.sku} type="text" prodType="simple" productName={p.name} onUpdate={onUpdate} showToast={showToast} /></div>
            )}
          </div>
          {isVar && (
            <button
              onClick={onToggleExpand}
              className={`p-2.5 rounded-xl transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center border ${expanded
                  ? "bg-purple-100 text-purple-600 border-purple-200"
                  : "bg-slate-50 text-slate-400 border-slate-200"
                }`}
              aria-label={expanded ? "Tutup variasi" : "Lihat variasi"}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stockStatus === "instock" ? "bg-green-500" : "bg-red-400"}`} />
            <span className={`text-xs font-semibold ${stockStatus === "instock" ? "text-green-700" : "text-red-600"}`}>
              {stockStatus === "instock" ? "In Stock" : "Out of Stock"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono">
            {isVar
              ? <span className="italic text-slate-300">Harga per variasi</span>
              : <EditableCell id={p.id} field="regular_price" val={p.regular_price} type="number" prodType="simple" prefix="Rp " productName={p.name} onUpdate={onUpdate} showToast={showToast} />
            }
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStock(); }}
              disabled={isUpdatingStock}
              role="switch"
              aria-checked={stockStatus === "instock"}
              title={stockStatus === "instock" ? "Klik untuk Habis" : "Klik untuk Ada"}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${stockStatus === "instock" ? "bg-green-500" : "bg-slate-300"} disabled:opacity-40`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${stockStatus === "instock" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-[9px] text-slate-400 font-medium">Stok</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
              disabled={isUpdatingStatus}
              title={isPublished ? "Klik untuk Private" : "Klik untuk Publish"}
              className={`inline-flex items-center justify-center h-7 w-12 rounded-full border transition-colors disabled:opacity-40 ${isPublished
                  ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                  : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                }`}
            >
              {isUpdatingStatus
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : isPublished ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />
              }
            </button>
            <span className="text-[9px] text-slate-400 font-medium">{isPublished ? "Publish" : "Private"}</span>
          </div>
          {isAdmin && (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={isDeleting}
                title="Hapus Produk"
                className={`inline-flex items-center justify-center h-7 w-12 rounded-full border transition-colors disabled:opacity-40 bg-red-50 text-red-600 border-red-200 hover:bg-red-100`}
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[9px] text-slate-400 font-medium">Hapus</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <Link
              href={`/dashboard/manage/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              title="Edit Produk & Variasi"
              className={`inline-flex items-center justify-center h-7 w-12 rounded-full border transition-colors ${isVar
                  ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                }`}
            >
              {isVar ? <ListTree className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
            </Link>
            <span className="text-[9px] text-slate-400 font-medium">{isVar ? "Variasi" : "Ke Var"}</span>
          </div>
        </div>
      </div>

      {expanded && isVar && (
        <div className="border-t border-purple-100 bg-violet-50/60">
          {isLoadingVars ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Loading variasi...
            </div>
          ) : varCache.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 italic">Tidak ada variasi.</div>
          ) : (
            <div className="divide-y divide-purple-100/60">
              {varCache.map((v) => {
                const varInStock = v.stock_status !== "outofstock";
                return (
                  <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <ChevronRight className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{v.attributes?.map(a => `${a.name}: ${a.option}`).join(" • ") || "Variation"}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 pl-4.5">
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${varInStock ? "bg-green-500" : "bg-red-400"}`} />
                          <span className={`text-[10px] font-medium ${varInStock ? "text-green-700" : "text-red-600"}`}>
                            {varInStock ? "Ada" : "Habis"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          <EditableCell id={v.id} parentId={p.id} field="regular_price" val={v.regular_price} type="number" prodType="variation" prefix="Rp " productName={`${p.name} #${v.id}`} onUpdate={onUpdate} showToast={showToast} />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleVariationStock(v)}
                      disabled={updatingVarStock.has(`${p.id}-${v.id}`)}
                      role="switch"
                      aria-checked={varInStock}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${varInStock ? "bg-green-500" : "bg-slate-300"} disabled:opacity-40`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${varInStock ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
