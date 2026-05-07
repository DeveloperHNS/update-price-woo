"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, UserProfile, PicCategory } from "@/lib/profile";
import { useRouter } from "next/navigation";
import {
  Users, RefreshCw, ShieldCheck, User, CheckCircle2,
  XCircle, Clock, AlertCircle, Trash2, Briefcase
} from "lucide-react";

type ManagedUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "pic";
  status: "pending" | "active" | "rejected";
  pic_category: PicCategory | null;
  created_at?: string;
};

const STATUS_LABELS = {
  pending:  { label: "Menunggu",   color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Clock },
  active:   { label: "Aktif",      color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  rejected: { label: "Ditolak",    color: "bg-red-100   text-red-700   border-red-200",     icon: XCircle },
};

const PIC_CATEGORIES: { value: PicCategory; label: string }[] = [
  { value: "komponen",  label: "Komponen" },
  { value: "aksesoris", label: "Aksesoris" },
  { value: "laptop",    label: "Laptop & Printer" },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Redirect non-admin
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

  if (!profile || profile.role !== "admin") return null;

  const pendingCount = users.filter(u => u.status === "pending").length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">Manajemen User</h2>
            {pendingCount > 0 && (
              <p className="text-xs text-amber-600 font-medium">{pendingCount} user menunggu persetujuan</p>
            )}
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-3 text-blue-500" /> Memuat user...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="p-4 space-y-2 max-w-4xl mx-auto">
            {["pending", "active", "rejected"].map(statusFilter => {
              const filtered = users.filter(u => u.status === statusFilter);
              if (filtered.length === 0) return null;
              const cfg = STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS];
              return (
                <div key={statusFilter}>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
                    {cfg.label} ({filtered.length})
                  </h3>
                  <div className="space-y-2">
                    {filtered.map(u => {
                      const busy = actionLoading === u.id;
                      const StatusIcon = cfg.icon;
                      const isPic = u.role === "pic";
                      return (
                        <div key={u.id} className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                          {/* Avatar */}
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${u.role === "admin" ? "bg-amber-100" : "bg-blue-50"}`}>
                            {u.role === "admin"
                              ? <ShieldCheck className="w-5 h-5 text-amber-600" />
                              : <Briefcase className="w-5 h-5 text-blue-500" />
                            }
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-800 text-sm truncate">
                                {u.full_name || "—"}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] font-bold border ${cfg.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                              <span className={`text-[10px] px-1.5 py-px rounded font-semibold ${
                                u.role === "admin"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-50 text-blue-600"
                              }`}>
                                {u.role === "admin" ? "Admin" : "PIC"}
                              </span>
                              {isPic && u.pic_category && (
                                <span className="text-[10px] px-1.5 py-px rounded font-semibold bg-slate-100 text-slate-600">
                                  {PIC_CATEGORIES.find(c => c.value === u.pic_category)?.label ?? u.pic_category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>

                            {/* PIC Category selector — hanya untuk PIC yang active */}
                            {isPic && u.status === "active" && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[11px] text-slate-500">Kategori:</span>
                                <select
                                  value={u.pic_category ?? ""}
                                  disabled={busy}
                                  onChange={e => updateUser(u.id, { pic_category: e.target.value as PicCategory })}
                                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 outline-none disabled:opacity-50"
                                >
                                  <option value="" disabled>Pilih kategori...</option>
                                  {PIC_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {u.status === "pending" && (
                              <>
                                <button
                                  onClick={() => updateUser(u.id, { status: "active" })}
                                  disabled={busy}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                  {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Setujui
                                </button>
                                <button
                                  onClick={() => updateUser(u.id, { status: "rejected" })}
                                  disabled={busy}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" /> Tolak
                                </button>
                              </>
                            )}
                            {u.status === "active" && (
                              <>
                                {u.role === "pic" && (
                                  <button
                                    onClick={() => updateUser(u.id, { role: "admin", pic_category: null })}
                                    disabled={busy}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors"
                                  >
                                    <ShieldCheck className="w-3 h-3" /> Jadikan Admin
                                  </button>
                                )}
                                {u.role === "admin" && u.id !== profile.id && (
                                  <button
                                    onClick={() => updateUser(u.id, { role: "pic" })}
                                    disabled={busy}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                  >
                                    <Briefcase className="w-3 h-3" /> Jadikan PIC
                                  </button>
                                )}
                                <button
                                  onClick={() => updateUser(u.id, { status: "rejected" })}
                                  disabled={busy || u.id === profile.id}
                                  className="flex items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
                                  title="Nonaktifkan user"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {u.status === "rejected" && (
                              <button
                                onClick={() => updateUser(u.id, { status: "active" })}
                                disabled={busy}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Aktifkan Kembali
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {users.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-sm">Belum ada user terdaftar.</div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 bg-white ${
          toast.type === "success" ? "border-green-200 text-green-800" : "border-red-200 text-red-700"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
