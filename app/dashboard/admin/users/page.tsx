"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, UserProfile, parseCategoryAccess } from "@/lib/profile";
import { fetchAll } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Users, RefreshCw, ShieldCheck, CheckCircle2,
  XCircle, Clock, AlertCircle, Trash2, Briefcase
} from "lucide-react";

type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "pic" | "product_staff";
  status: "pending" | "active" | "rejected";
  pic_category: string | null;
  created_at?: string;
};

const STATUS_CFG = {
  pending:  { label: "Menunggu",  color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Clock,         section: "bg-amber-50 border-amber-200" },
  active:   { label: "Aktif",     color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2,  section: "bg-green-50 border-green-200" },
  rejected: { label: "Ditolak",   color: "bg-red-100 text-red-700 border-red-200",         icon: XCircle,       section: "bg-red-50 border-red-200" },
};


export default function AdminUsersPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; email: string } | null>(null);
  const [wooCategories, setWooCategories] = useState<any[]>([]);
  const [erpCategories, setErpCategories] = useState<string[]>([]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    getCurrentProfile().then(p => {
      setProfile(p);
      if (p && p.role !== "admin") router.replace("/dashboard");
    });
  }, [router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error((await res.json()).error || "Gagal memuat user");
      const data = await res.json();
      setUsers(data.users as ManagedUser[]);
      
      try {
        const cats = await fetchAll("products/categories");
        setWooCategories(cats as any[]);
      } catch (e: any) {
        console.error("Gagal memuat kategori WooCommerce", e);
      }
      
      try {
        const erpRes = await fetch("/api/admin/erp-categories");
        if (erpRes.ok) {
          const erpData = await erpRes.json();
          setErpCategories(erpData.categories || []);
        }
      } catch (e: any) {
        console.error("Gagal memuat kategori ERP", e);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateUser = async (userId: string, patch: Partial<Pick<ManagedUser, "status" | "role" | "pic_category">>) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal update");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
      showToast("Berhasil diupdate", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(userId);
    setDeleteConfirm(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal hapus user");
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast("User berhasil dihapus", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (!profile || profile.role !== "admin") return null;

  const pendingCount = users.filter(u => u.status === "pending").length;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Topbar ── */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-amber-100 rounded-xl shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">Manajemen User</h2>
            {pendingCount > 0 && (
              <p className="text-xs text-amber-600 font-medium">
                {pendingCount} user menunggu persetujuan
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-3 text-blue-500" />
            <span className="text-sm">Memuat data user...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto w-full pb-10">

            {users.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-medium">Belum ada user terdaftar</p>
              </div>
            )}

            {(["pending", "active", "rejected"] as const).map(statusFilter => {
              const filtered = users.filter(u => u.status === statusFilter);
              if (filtered.length === 0) return null;
              const cfg = STATUS_CFG[statusFilter];
              const StatusIcon = cfg.icon;

              return (
                <div key={statusFilter}>
                  {/* Section header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${cfg.section}`}>
                    <StatusIcon className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {cfg.label} <span className="font-normal opacity-70">({filtered.length})</span>
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {filtered.map(u => {
                      const busy = actionLoading === u.id;
                      const isPic = u.role === "pic";

                      return (
                        <div
                          key={u.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors shadow-sm"
                        >
                          {/* Top row: avatar + info + status badge */}
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl shrink-0 ${u.role === "admin" ? "bg-amber-100" : u.role === "product_staff" ? "bg-purple-50" : "bg-blue-50"}`}>
                              {u.role === "admin"
                                ? <ShieldCheck className="w-5 h-5 text-amber-600" />
                                : u.role === "product_staff"
                                  ? <Users className="w-5 h-5 text-purple-600" />
                                  : <Briefcase className="w-5 h-5 text-blue-500" />
                              }
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Roles & Categories Display */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-800 text-sm truncate">
                                  {u.full_name || "—"}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] font-bold border ${cfg.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {cfg.label}
                                </span>
                                <span className={`text-[10px] px-1.5 py-px rounded font-semibold ${
                                  u.role === "admin" ? "bg-amber-100 text-amber-700" : u.role === "product_staff" ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-600"
                                }`}>
                                  {u.role === "admin" ? "Admin" : u.role === "product_staff" ? "Product Staff" : "PIC"}
                                </span>
                                
                                {(isPic || u.role === "product_staff") && (() => {
                                  const access = parseCategoryAccess(u.pic_category);
                                  const colorClass = u.role === "product_staff" ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-600";
                                  return (
                                    <>
                                      {/* WOO ACCESS */}
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-400 font-medium">Woo:</span>
                                        {access.woo === "ALL" ? (
                                          <span className="text-[10px] px-1.5 py-px rounded font-medium bg-emerald-100 text-emerald-700">Semua Kategori</span>
                                        ) : access.woo ? access.woo.split(",").map(catId => {
                                          const cName = wooCategories.find(c => c.id.toString() === catId)?.name || catId;
                                          return (
                                            <span key={`woo-${catId}`} className={`text-[10px] px-1.5 py-px rounded font-medium ${colorClass}`}>
                                              {cName}
                                            </span>
                                          );
                                        }) : <span className="text-[10px] text-slate-400 italic">Tidak ada</span>}
                                      </div>
                                      
                                      {/* ERP ACCESS */}
                                      <div className="flex items-center gap-1 ml-2">
                                        <span className="text-[10px] text-slate-400 font-medium">ERP:</span>
                                        {access.erp === "ALL" ? (
                                          <span className="text-[10px] px-1.5 py-px rounded font-medium bg-emerald-100 text-emerald-700">Semua Kategori</span>
                                        ) : access.erp ? access.erp.split(",").map(cat => (
                                            <span key={`erp-${cat}`} className={`text-[10px] px-1.5 py-px rounded font-medium ${colorClass}`}>
                                              {cat}
                                            </span>
                                        )) : <span className="text-[10px] text-slate-400 italic">Tidak ada</span>}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>

                              {/* PIC category selector */}
                              {(isPic || u.role === "product_staff") && u.status === "active" && (() => {
                                const access = parseCategoryAccess(u.pic_category);
                                const isAll = access.woo === "ALL" && access.erp === "ALL";
                                
                                return (
                                <div className="mt-2.5 space-y-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      disabled={busy}
                                      onClick={() => updateUser(u.id, { pic_category: isAll ? null : "ALL" })}
                                      className={`text-[10px] px-2 py-1 rounded-md font-bold border transition-colors disabled:opacity-50 ${isAll ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                                    >
                                      AKSES SEMUA (DEALER / FULL)
                                    </button>
                                  </div>
                                  
                                  {!isAll && (
                                    <>
                                      {/* WooCommerce Access */}
                                      <div className="space-y-1.5">
                                        <span className="text-[11px] text-slate-500 font-medium block">Akses Website (WooCommerce):</span>
                                        <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
                                          {wooCategories.map(c => {
                                            const isSelected = access.woo?.split(",").includes(c.id.toString());
                                            return (
                                              <button
                                                key={`woo-${c.id}`}
                                                disabled={busy}
                                                onClick={() => {
                                                  const currentArr = access.woo && access.woo !== "ALL" ? access.woo.split(",") : [];
                                                  const newArr = isSelected ? currentArr.filter(x => x !== c.id.toString()) : [...currentArr, c.id.toString()];
                                                  const newAccess = { ...access, woo: newArr.length ? newArr.join(",") : null };
                                                  updateUser(u.id, { pic_category: JSON.stringify(newAccess) });
                                                }}
                                                className={`text-[10px] px-2 py-1 rounded-md font-medium border transition-colors disabled:opacity-50 ${isSelected ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"}`}
                                              >
                                                {c.name}
                                              </button>
                                            );
                                          })}
                                          {wooCategories.length === 0 && <span className="text-[10px] text-slate-400">Memuat kategori WooCommerce...</span>}
                                        </div>
                                      </div>

                                      {/* ERP Access */}
                                      <div className="space-y-1.5">
                                        <span className="text-[11px] text-slate-500 font-medium block">Akses ERP / Accurate:</span>
                                        <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
                                          {erpCategories.map(cat => {
                                            const isSelected = access.erp?.split(",").includes(cat);
                                            return (
                                              <button
                                                key={`erp-${cat}`}
                                                disabled={busy}
                                                onClick={() => {
                                                  const currentArr = access.erp && access.erp !== "ALL" ? access.erp.split(",") : [];
                                                  const newArr = isSelected ? currentArr.filter(x => x !== cat) : [...currentArr, cat];
                                                  const newAccess = { ...access, erp: newArr.length ? newArr.join(",") : null };
                                                  updateUser(u.id, { pic_category: JSON.stringify(newAccess) });
                                                }}
                                                className={`text-[10px] px-2 py-1 rounded-md font-medium border transition-colors disabled:opacity-50 ${isSelected ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"}`}
                                              >
                                                {cat}
                                              </button>
                                            );
                                          })}
                                          {erpCategories.length === 0 && <span className="text-[10px] text-slate-400">Memuat kategori ERP...</span>}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  {busy && <div className="flex items-center gap-1.5 text-xs text-slate-400"><RefreshCw className="w-3 h-3 animate-spin" /> Menyimpan...</div>}
                                </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                            {u.status === "pending" && (
                              <>
                                <button
                                  onClick={() => updateUser(u.id, { status: "active" })}
                                  disabled={busy}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                  {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Setujui
                                </button>
                                <button
                                  onClick={() => updateUser(u.id, { status: "rejected" })}
                                  disabled={busy}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" /> Tolak
                                </button>
                              </>
                            )}

                            {u.status === "active" && (
                              <>
                                {u.role !== "admin" && (
                                  <button
                                    onClick={() => updateUser(u.id, { role: "admin", pic_category: null })}
                                    disabled={busy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors"
                                  >
                                    <ShieldCheck className="w-3 h-3" /> Jadikan Admin
                                  </button>
                                )}
                                {u.role !== "pic" && u.id !== profile.id && (
                                  <button
                                    onClick={() => updateUser(u.id, { role: "pic" })}
                                    disabled={busy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                  >
                                    <Briefcase className="w-3 h-3" /> Jadikan PIC
                                  </button>
                                )}
                                {u.role !== "product_staff" && u.id !== profile.id && (
                                  <button
                                    onClick={() => updateUser(u.id, { role: "product_staff", pic_category: null })}
                                    disabled={busy}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                  >
                                    <Users className="w-3 h-3" /> Jadikan Product Staff
                                  </button>
                                )}
                                <button
                                  onClick={() => updateUser(u.id, { status: "rejected" })}
                                  disabled={busy || u.id === profile.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg disabled:opacity-30 transition-colors border border-slate-200 hover:border-red-200"
                                  title="Nonaktifkan user"
                                >
                                  <Trash2 className="w-3 h-3" /> Nonaktifkan
                                </button>
                              </>
                            )}

                            {u.status === "rejected" && (
                              <>
                                <button
                                  onClick={() => updateUser(u.id, { status: "active" })}
                                  disabled={busy}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Aktifkan Kembali
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ id: u.id, email: u.email })}
                                  disabled={busy}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-medium rounded-lg disabled:opacity-30 transition-colors border border-red-200"
                                  title="Hapus permanen"
                                >
                                  <Trash2 className="w-3 h-3" /> Hapus Permanen
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete Confirm Dialog ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center mb-1">Hapus User?</h3>
            <p className="text-sm text-slate-500 text-center mb-1">
              Akun <span className="font-semibold text-slate-700">{deleteConfirm.email}</span> akan dihapus permanen.
            </p>
            <p className="text-xs text-red-500 text-center mb-6">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => deleteUser(deleteConfirm.id)}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 bg-white ${
          toast.type === "success" ? "border-green-200 text-green-800" : "border-red-200 text-red-700"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
