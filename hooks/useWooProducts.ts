import { useEffect, useMemo, useState } from "react";
import { consumePendingProduct, wooFetch, WooProduct, WooVariation } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { getCurrentProfile, parseCategoryAccess, type UserProfile } from "@/lib/profile";

export type WooCategory = {
  id: number;
  name: string;
  parent: number;
  count: number;
};

const PER_PAGE = 50;
export type StockState = "instock" | "outofstock";

export function useWooProducts() {
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCurrentProfile().then(setProfile);
  }, []);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [selCatId, setSelCatId] = useState<number | null>(null);
  const [showCatDD, setShowCatDD] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // State for Variations
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [varCache, setVarCache] = useState<Record<number, WooVariation[]>>({});
  const [varLoading, setVarLoading] = useState<Set<number>>(new Set());
  const [updatingStock, setUpdatingStock] = useState<Set<number>>(new Set());
  // Per-variation stock update: key = "${parentId}-${varId}"
  const [updatingVarStock, setUpdatingVarStock] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [productToDelete, setProductToDelete] = useState<WooProduct | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string, type: "success" | "error" | "loading" } | null>(null);
  // Mobile filter panel open/close
  const [filterOpen, setFilterOpen] = useState(false);

  // Mapped Prices
  const [mappedPrices, setMappedPrices] = useState<Record<number, { cp: string | null; price: string | null; sp: string | null }>>({});

  const fetchMappedPrices = async (wooIds: number[]) => {
    if (wooIds.length === 0) return;
    try {
      const res = await fetch("/api/sync/mapped-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ woo_ids: wooIds })
      });
      const data = await res.json();
      if (data.prices) {
        setMappedPrices(prev => ({ ...prev, ...data.prices }));
      }
    } catch (err) {
      console.error("Failed to fetch mapped prices", err);
    }
  };

  // Sorting state (ascending, descending, default/null)
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder("asc");
    } else if (sortOrder === "asc") {
      setSortOrder("desc");
    } else {
      setSortField(null);
      setSortOrder(null);
    }
  };

  const sortedProducts = useMemo(() => {
    if (!sortField || !sortOrder) return products;

    return [...products].sort((a, b) => {
      let valA: any = a[sortField as keyof WooProduct];
      let valB: any = b[sortField as keyof WooProduct];

      // Handle specific fields
      if (sortField === "regular_price" || sortField === "sale_price") {
        const valAStr = String(a[sortField as keyof WooProduct] || "0");
        const valBStr = String(b[sortField as keyof WooProduct] || "0");
        const numA = parseFloat(valAStr);
        const numB = parseFloat(valBStr);
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }

      if (sortField === "stock_status") {
        valA = a.stock_status === "outofstock" ? "outofstock" : "instock";
        valB = b.stock_status === "outofstock" ? "outofstock" : "instock";
      }

      // Convert to string/number and compare
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();

      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [products, sortField, sortOrder]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [selCatId]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await wooFetch(
          "products/categories",
          "GET",
          undefined,
          { per_page: 100, page: 1, _fields: "id,name,parent,count" }
        ) as WooCategory[];
        setCategories(cats.sort((a, b) => a.parent - b.parent || a.name.localeCompare(b.name)));
      } catch {
        // Category fetch failure should not block product page rendering.
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadProductsPage = async () => {
      setLoading(true);
      setError("");
      try {
        const params: Record<string, string | number> = {
          per_page: PER_PAGE,
          page,
          orderby: "date",
          order: "desc",
          _fields: "id,name,sku,type,regular_price,sale_price,parent,stock_status,status",
        };

        const access = parseCategoryAccess(profile?.pic_category ?? null);
        const isRestricted = profile && (profile.role === 'pic' || profile.role === 'product_staff') && access.woo !== "ALL";

        if (isRestricted && !access.woo) {
          setProducts([]);
          setHasNextPage(false);
          setLoading(false);
          return;
        }

        if (selCatId !== null) {
          params.category = selCatId;
        } else if (isRestricted && !debouncedSearch) {
          params.category = access.woo as string;
        }

        let items: WooProduct[] = [];
        if (debouncedSearch) {
          let promises: Promise<any>[] = [];
          const query = debouncedSearch.trim();

          if (/^#\d+$/.test(query)) {
            const idToSearch = query.substring(1);
            promises.push(
              wooFetch(`products/${idToSearch}`, "GET").then(p => p ? [p] : []).catch(() => [])
            );
          } else {
            promises = [
              wooFetch("products", "GET", undefined, { ...params, search: query }),
              wooFetch("products", "GET", undefined, { ...params, sku: query })
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
                promises.push(wooFetch("products", "GET", undefined, { ...params, search: nonAttrWords.join(" ") }).catch(() => []));
              }

              // Fallback: cari dengan kata terpanjang saja (biasanya merek/seri spesifik)
              const longestWord = [...words].sort((a,b) => b.length - a.length)[0];
              if (longestWord && longestWord.length > 3) {
                promises.push(wooFetch("products", "GET", undefined, { ...params, search: longestWord }).catch(() => []));
              }
            }
          }

          const results = await Promise.all(promises);

          let combined = results.flat() as WooProduct[];
          const uniqueMap = new Map<number, WooProduct>();
          combined.forEach(p => {
            if (p && p.id && !uniqueMap.has(p.id)) uniqueMap.set(p.id, p);
          });
          items = Array.from(uniqueMap.values());

          // Fuzzy Client-Side Filter & Relevance Sort
          if (!/^#\d+$/.test(query) && query.length > 0) {
            const cleanQuery = query.toLowerCase().replace(/(\d+)\s*(gb|tb|mb|mhz|hz|inch)/g, "$1$2");
            const filterWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);

            const scoredItems = items.map(p => {
              const nameLower = p.name.toLowerCase().replace(/(\d+)\s*(gb|tb|mb|mhz|hz|inch)/g, "$1$2");
              const skuLower = (p.sku || "").toLowerCase();
              const attrLower = (p.attributes?.flatMap(a => [a.name, ...a.options]) || []).join(" ").toLowerCase().replace(/(\d+)\s*(gb|tb|mb|mhz|hz|inch)/g, "$1$2");

              let score = 0;
              let allMatch = true;

              for (const w of filterWords) {
                let matched = false;
                if (nameLower.includes(w)) {
                  score += 10;
                  matched = true;
                } else if (skuLower.includes(w)) {
                  score += 5;
                  matched = true;
                } else if (attrLower.includes(w)) {
                  score += 1;
                  matched = true;
                }

                if (!matched) {
                  allMatch = false;
                }
              }

              return { product: p, score, allMatch };
            });

            items = scoredItems
              .filter(item => item.allMatch)
              .sort((a, b) => b.score - a.score)
              .map(item => item.product);
          }
        } else {
          items = await wooFetch("products", "GET", undefined, params) as WooProduct[];
        }

        const parentProducts = items.filter((item) => !item.parent || item.parent === 0);
        setProducts(parentProducts);
        setHasNextPage(items.length === PER_PAGE);

        // Fetch mapped prices for these products
        fetchMappedPrices(parentProducts.map(p => p.id));

        if (page === 1 && !debouncedSearch && selCatId === null) {
          const pending = consumePendingProduct();
          if (pending) {
            setProducts((prev) => [pending, ...prev.filter((p) => p.id !== pending.id)].slice(0, PER_PAGE));
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    loadProductsPage();
  }, [page, debouncedSearch, selCatId, profile?.pic_category, profile?.role]);

  const showToast = (msg: string, type: "success" | "error" | "loading") => {
    setToast({ msg, type });
    if (type !== "loading") setTimeout(() => setToast(null), 3500);
  };

  const toggleExpand = async (id: number) => {
    const newExp = new Set(expanded);
    if (newExp.has(id)) {
      newExp.delete(id);
      setExpanded(newExp);
      return;
    }
    newExp.add(id);
    setExpanded(newExp);

    if (!varCache[id] && !varLoading.has(id)) {
      setVarLoading(prev => new Set(prev).add(id));
      try {
        const vars = await wooFetch(
          `products/${id}/variations`,
          "GET",
          undefined,
          { _fields: "id,sku,regular_price,sale_price,attributes,stock_status", per_page: 100, page: 1 }
        ) as WooVariation[];
        setVarCache(prev => ({ ...prev, [id]: vars }));
        fetchMappedPrices(vars.map(v => v.id));
      } catch (err: any) {
        showToast("Failed to load variations: " + err.message, "error");
      } finally {
        setVarLoading(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    }
  };

  const catTree = useMemo(() => {
    const access = parseCategoryAccess(profile?.pic_category ?? null);
    const isRestricted = profile && (profile.role === 'pic' || profile.role === 'product_staff') && access.woo !== "ALL";
    let allowedCats = categories;

    if (isRestricted) {
      if (!access.woo) return [];
      const allowedIds = access.woo.split(",").map(id => parseInt(id, 10));
      allowedCats = categories.filter(c => allowedIds.includes(c.id));
      let tree = allowedCats.map(c => ({ ...c, depth: 0 }));
      if (catSearch.trim()) {
        tree = tree.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));
      }
      return tree;
    }

    const buildTree = (parentId = 0, depth = 0): any[] => {
      return allowedCats
        .filter(c => c.parent === parentId)
        .flatMap(c => [{ ...c, depth }, ...buildTree(c.id, depth + 1)]);
    };
    const tree = buildTree();
    if (!catSearch.trim()) return tree;
    return tree.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));
  }, [categories, catSearch, profile]);

  const selectedCatName = selCatId === null
    ? "All Categories"
    : categories.find(c => c.id === selCatId)?.name || "Unknown";
  const getStockState = (status?: string): StockState => status === "outofstock" ? "outofstock" : "instock";
  const deriveParentStockFromVariations = (variations: WooVariation[]): StockState => {
    return variations.some((variation) => getStockState(variation.stock_status) === "instock")
      ? "instock"
      : "outofstock";
  };
  const ensureVariationsLoaded = async (parentId: number): Promise<WooVariation[]> => {
    const cached = varCache[parentId];
    if (cached) return cached;
    const vars = await wooFetch(
      `products/${parentId}/variations`,
      "GET",
      undefined,
      { _fields: "id,sku,regular_price,sale_price,attributes,stock_status", per_page: 100, page: 1 }
    ) as WooVariation[];
    setVarCache((prev) => ({ ...prev, [parentId]: vars }));
    fetchMappedPrices(vars.map(v => v.id));
    return vars;
  };
  const toggleProductStock = async (product: WooProduct) => {
    if (updatingStock.has(product.id)) return;
    setUpdatingStock((prev) => new Set(prev).add(product.id));
    showToast("Updating stock...", "loading");
    try {
      if (product.type === "variable") {
        const variations = await ensureVariationsLoaded(product.id);
        if (variations.length === 0) throw new Error("No variations found");
        const targetStatus: StockState = deriveParentStockFromVariations(variations) === "instock" ? "outofstock" : "instock";
        const updatedVariations = await Promise.all(
          variations.map(async (variation) => {
            await wooFetch(
              `products/${product.id}/variations/${variation.id}`,
              "PATCH",
              { stock_status: targetStatus }
            );
            return { ...variation, stock_status: targetStatus };
          })
        );
        setVarCache((prev) => ({ ...prev, [product.id]: updatedVariations }));
        const nextParentStatus = deriveParentStockFromVariations(updatedVariations);
        setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, stock_status: nextParentStatus } : item));
        logActivity({ action: "toggle_stock", product_id: product.id, product_name: product.name, old_value: deriveParentStockFromVariations(variations), new_value: targetStatus });
      } else {
        const prevStatus = getStockState(product.stock_status);
        const targetStatus: StockState = prevStatus === "instock" ? "outofstock" : "instock";
        await wooFetch(`products/${product.id}`, "PATCH", { stock_status: targetStatus });
        setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, stock_status: targetStatus } : item));
        logActivity({ action: "toggle_stock", product_id: product.id, product_name: product.name, old_value: prevStatus, new_value: targetStatus });
      }
      showToast("Stock updated", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update stock";
      showToast("Failed to update stock: " + message, "error");
    } finally {
      setUpdatingStock((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const toggleVariationStock = async (product: WooProduct, v: WooVariation) => {
    const key = `${product.id}-${v.id}`;
    if (updatingVarStock.has(key)) return;
    setUpdatingVarStock((prev) => new Set(prev).add(key));
    showToast("Updating stock...", "loading");
    try {
      const prevStatus = v.stock_status === "outofstock" ? "outofstock" : "instock";
      const target: StockState = prevStatus === "instock" ? "outofstock" : "instock";
      await wooFetch(`products/${product.id}/variations/${v.id}`, "PATCH", { stock_status: target });
      const updatedVars = (varCache[product.id] || []).map((x) =>
        x.id === v.id ? { ...x, stock_status: target } : x
      );
      setVarCache((prev) => ({ ...prev, [product.id]: updatedVars }));
      // Recalculate and sync parent stock
      const newParentStock = deriveParentStockFromVariations(updatedVars);
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, stock_status: newParentStock } : p)
      );
      logActivity({ action: "toggle_stock", product_id: v.id, product_name: `${product.name} — Variasi #${v.id}`, old_value: prevStatus, new_value: target });
      showToast("Stock variasi diperbarui", "success");
    } catch (err: unknown) {
      showToast("Gagal: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setUpdatingVarStock((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }
  };

  const toggleProductStatus = async (product: WooProduct) => {
    if (updatingStatus.has(product.id)) return;
    setUpdatingStatus(prev => new Set(prev).add(product.id));
    showToast("Mengubah status...", "loading");
    try {
      const prev = product.status === 'private' ? 'private' : 'publish';
      const target = prev === 'publish' ? 'private' : 'publish';
      await wooFetch(`products/${product.id}`, "PATCH", { status: target });
      setProducts(prevList => prevList.map(item => item.id === product.id ? { ...item, status: target } : item));
      logActivity({ action: "toggle_status", product_id: product.id, product_name: product.name, old_value: prev, new_value: target });
      showToast(target === 'publish' ? "Produk dipublish" : "Produk diprivatkan", "success");
    } catch (err: unknown) {
      showToast("Gagal: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setUpdatingStatus(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    if (deleting.has(productToDelete.id)) return;

    setDeleting(prev => new Set(prev).add(productToDelete.id));
    showToast("Menghapus produk...", "loading");
    try {
      await wooFetch(`products/${productToDelete.id}`, "DELETE", undefined, { force: true });
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      logActivity({ action: "delete_product", product_id: productToDelete.id, product_name: productToDelete.name });
      showToast("Produk berhasil dihapus", "success");
    } catch (err: unknown) {
      showToast("Gagal menghapus: " + (err instanceof Error ? err.message : "error"), "error");
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(productToDelete.id); return n; });
      setProductToDelete(null);
    }
  };

  return {
    products,
    setProducts,
    categories,
    loading,
    error,
    profile,
    search,
    setSearch,
    debouncedSearch,
    setDebouncedSearch,
    catSearch,
    setCatSearch,
    selCatId,
    setSelCatId,
    showCatDD,
    setShowCatDD,
    page,
    setPage,
    hasNextPage,
    expanded,
    setExpanded,
    varCache,
    setVarCache,
    varLoading,
    setVarLoading,
    updatingStock,
    updatingVarStock,
    updatingStatus,
    deleting,
    productToDelete,
    setProductToDelete,
    toast,
    showToast,
    filterOpen,
    setFilterOpen,
    mappedPrices,
    sortField,
    sortOrder,
    handleSort,
    sortedProducts,
    toggleExpand,
    catTree,
    selectedCatName,
    toggleProductStock,
    toggleVariationStock,
    toggleProductStatus,
    confirmDelete,
    PER_PAGE
  };
}
