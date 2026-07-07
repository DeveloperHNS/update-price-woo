import fs from 'fs';

let code = fs.readFileSync('app/dashboard/manage/[id]/page.tsx', 'utf8');

const uiCode = `
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
                                const isChecked = attr.options.split(/[\\r\\n|,]+/).map(s => s.trim()).includes(term.name);
                                return (
                                  <label key={term.id} className={\`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors \${isChecked ? "bg-blue-50 border-blue-300 text-blue-700 font-medium" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}\`}>
                                    <input
                                      type="checkbox"
                                      className="rounded text-blue-600 w-3 h-3"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        let current = attr.options.split(/[\\r\\n|,]+/).map(s => s.trim()).filter(Boolean);
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

        {/* Variations Section */}`;

code = code.replace(/\{\/\* Variations Section \*\/\}/, uiCode);

fs.writeFileSync('app/dashboard/manage/[id]/page.tsx', code);
console.log("UI updated!");
