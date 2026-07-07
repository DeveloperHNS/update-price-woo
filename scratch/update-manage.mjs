import fs from 'fs';

let code = fs.readFileSync('scratch/manage_page.tsx', 'utf8');

// 1. Add fetchAll to imports
code = code.replace(/import \{ wooFetch, WooProduct, WooVariation \} from "@\/lib\/api";/, 'import { wooFetch, fetchAll, WooProduct, WooVariation } from "@/lib/api";');

// 2. Add ChevronDown icon
code = code.replace(/import \{ ArrowLeft,/g, 'import { ArrowLeft, ChevronDown,');

// 3. Add states
const stateCode = `
  // WooCommerce Global Attributes
  const [globalAttributes, setGlobalAttributes] = useState<any[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<{id: number; name: string; options: string; variation: boolean;}[]>([]);
  const [termsCache, setTermsCache] = useState<Record<number, any[]>>({});
  const [loadingTerms, setLoadingTerms] = useState<Record<number, boolean>>({});
`;
code = code.replace(/const \[newVarSale, setNewVarSale\] = useState\(""\);/, 'const [newVarSale, setNewVarSale] = useState("");\n' + stateCode);

// 4. Update loadData to also load global attributes
const loadDataCode = `
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, attrs] = await Promise.all([
        wooFetch(\`products/\${id}\`, "GET") as Promise<WooProduct>,
        fetchAll("products/attributes")
      ]);
      setGlobalAttributes(attrs as any[]);
      setProduct(p);
      
      if (p.attributes) {
        setSelectedAttributes(p.attributes.map((a: any) => ({
          id: a.id || 0,
          name: a.name,
          options: a.options ? a.options.join(" | ") : "",
          variation: a.variation
        })));
      }

      if (p.type === "variable") {
        const vars = await wooFetch(\`products/\${id}/variations\`, "GET", undefined, { per_page: 100 }) as WooVariation[];
        setVariations(vars);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load product data");
    } finally {
      setLoading(false);
    }
  };
`;
code = code.replace(/const loadData = async \(\) => \{[\s\S]*?setLoading\(false\);\n    \}\n  \};/, loadDataCode);

// 5. Add Attribute management functions
const attrFunctions = `
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
            const terms = await fetchAll(\`products/attributes/\${globalAttr.id}/terms\`);
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
    const parsedAttrs = varAttrs.map(a => ({
      id: a.id,
      name: a.name,
      options: a.options.split(/[\\r\\n|,]+/).map(s => s.trim()).filter(Boolean)
    }));
    const cartesian = (arrays: any[][]): any[][] =>
      arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]]);
    const combinations = cartesian(parsedAttrs.map(a => a.options));
    
    let generatedCount = 0;
    const currentVars = [...variations];
    
    combinations.forEach(comb => {
      const combArray = Array.isArray(comb) ? comb : [comb];
      const attrsForVar = parsedAttrs.map((a, i) => ({ id: a.id, name: a.name, option: combArray[i] }));
      
      // Check if this combination already exists
      const exists = currentVars.some(v => {
        if (!v.attributes) return false;
        // check if every attr in attrsForVar matches
        return attrsForVar.every(newAttr => 
          v.attributes.some((existAttr:any) => existAttr.name === newAttr.name && existAttr.option === newAttr.option)
        );
      });
      
      if (!exists) {
        const key = attrsForVar.map(a => a.option).join('-');
        currentVars.push({
          id: 0, // 0 marks it as new
          sku: product?.sku ? \`\${product.sku}-\${key.toUpperCase().replace(/\\s+/g, '')}\` : "",
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
      showToast(\`Berhasil men-generate \${generatedCount} variasi baru\`, "success");
    } else {
      showToast("Semua kombinasi variasi sudah ada", "success");
    }
  };
`;
code = code.replace(/const convertToVariable = async \(\) => \{/, attrFunctions + '\n\n  const convertToVariable = async () => {');

// 6. Update handleSaveAll to handle Creates and Updates
const saveAllCode = `
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // First update the parent product attributes
      if (selectedAttributes.length > 0) {
        const formattedAttrs = selectedAttributes.map(a => ({
          id: a.id, name: a.name, visible: true, variation: a.variation,
          options: a.options.split(/[\\r\\n|,]+/).map(s => s.trim()).filter(Boolean)
        }));
        await wooFetch(\`products/\${id}\`, "PUT", { attributes: formattedAttrs });
      }

      // Then save variations
      const updates = variations.filter(v => v.id > 0).map(v => ({
        id: v.id,
        regular_price: v.regular_price,
        sale_price: v.sale_price,
        sku: v.sku,
        stock_status: v.stock_status,
        image: (v as any).image
      }));
      
      const creates = variations.filter(v => v.id === 0).map(v => ({
        regular_price: v.regular_price,
        sale_price: v.sale_price,
        sku: v.sku,
        stock_status: v.stock_status,
        attributes: v.attributes,
        image: (v as any).image
      }));
      
      if (updates.length > 0 || creates.length > 0) {
        await wooFetch(\`products/\${id}/variations/batch\`, "POST", { update: updates, create: creates });
      }
      
      showToast("Variasi berhasil disimpan", "success");
      await loadData(); // Reload to get actual IDs of new variations
    } catch (err: any) {
      showToast(err.message || "Gagal menyimpan variasi", "error");
    } finally {
      setSaving(false);
    }
  };
`;
code = code.replace(/const handleSaveAll = async \(\) => \{[\s\S]*?setSaving\(false\);\n    \}\n  \};/, saveAllCode);

fs.writeFileSync('scratch/manage_page2.tsx', code);
console.log("Done");
