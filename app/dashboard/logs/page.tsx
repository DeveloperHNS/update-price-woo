"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, UserProfile } from "@/lib/profile";
import { RefreshCw, ClipboardList, AlertCircle, ChevronRight, ShieldCheck, Download, FolderUp, CheckCircle2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

type ActivityLog = {
  id: number;
  created_at: string;
  user_email: string | null;
  store_url: string | null;
  action: string;
  product_id: number | null;
  product_name: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  update_price: { label: "Update Harga", color: "bg-blue-100 text-blue-800" },
  update_sku: { label: "Update SKU", color: "bg-indigo-100 text-indigo-800" },
  update_name: { label: "Update Nama", color: "bg-violet-100 text-violet-800" },
  toggle_stock: { label: "Toggle Stok", color: "bg-amber-100 text-amber-800" },
  toggle_status: { label: "Toggle Status", color: "bg-sky-100 text-sky-800" },
  upload_product: { label: "Upload Produk", color: "bg-green-100 text-green-800" },
  delete_product: { label: "Hapus Produk", color: "bg-red-100 text-red-800" },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_LABELS[action] ?? { label: action, color: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [exportingDrive, setExportingDrive] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedLogs = useMemo(() => {
    if (!sortConfig) return logs;
    return [...logs].sort((a, b) => {
      const { key, direction } = sortConfig;
      const valA = String(a[key as keyof ActivityLog] || "").toLowerCase();
      const valB = String(b[key as keyof ActivityLog] || "").toLowerCase();
      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [logs, sortConfig]);

  useEffect(() => {
    getCurrentProfile().then(p => {
      setProfile(p);
      if (p && p.role !== "admin") router.replace("/dashboard");
    });
  }, [router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterAction !== "all") query = query.eq("action", filterAction);

      const { data, error: sbError } = await query;
      if (sbError) throw new Error(sbError.message);
      setLogs((data as ActivityLog[]) ?? []);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat logs");
    } finally {
      setLoading(false);
    }
  }, [filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => {
    const timer = setInterval(() => fetchLogs(), 30_000);
    return () => clearInterval(timer);
  }, [fetchLogs]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  function exportCSV() {
    const headers = ["Waktu", "User", "Aksi", "Produk", "Product ID", "Field", "Nilai Lama", "Nilai Baru"];
    const rows = logs.map(l => [
      formatDate(l.created_at), l.user_email ?? "", l.action,
      l.product_name ?? "", String(l.product_id ?? ""),
      l.field ?? "", l.old_value ?? "", l.new_value ?? "",
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportToDrive() {
    if (logs.length === 0) return;
    setExportingDrive(true);
    try {
      const rows = logs.map(l => ({
        Waktu: formatDate(l.created_at), User: l.user_email ?? "", Aksi: l.action,
        Produk: l.product_name ?? "", ProductID: String(l.product_id ?? ""),
        Field: l.field ?? "", NilaiLama: l.old_value ?? "", NilaiBaru: l.new_value ?? "",
      }));
      const res = await fetch("/api/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Berhasil diunggah ke Google Sheets", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal export ke Drive", "error");
    } finally {
      setExportingDrive(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Topbar ── */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        {/* Row 1: title + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-5 h-5 text-slate-500 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">Activity Logs</h2>
            {profile?.role === "admin" && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200 shrink-0">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {logs.length > 0 && (
              <>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  onClick={exportToDrive}
                  disabled={exportingDrive}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Upload ke Google Drive"
                >
                  {exportingDrive
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <FolderUp className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Drive</span>
                </button>
              </>
            )}
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Row 2: last refresh info */}
        <p className="text-[11px] text-slate-400 mt-1">
          Auto-refresh 30 dtk · Terakhir: {lastRefresh.toLocaleTimeString("id-ID")}
        </p>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
        <label className="text-xs font-semibold text-slate-500 shrink-0">Filter:</label>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">Semua Aksi</option>
          {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-400 font-medium shrink-0">{logs.length} entri</span>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
            <p className="text-sm">Memuat logs...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <AlertCircle className="w-8 h-8 mb-3" />
            <p className="text-sm font-medium">{error}</p>
            <p className="text-xs text-slate-400 mt-1">Pastikan tabel activity_logs sudah dibuat di Supabase.</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <ClipboardList className="w-12 h-12 mb-3 text-slate-200" />
            <p className="text-sm font-medium">Belum ada aktivitas</p>
            <p className="text-xs mt-1">Log akan muncul setelah ada perubahan produk.</p>
          </div>
        ) : (
          <>
            {/* ── Desktop table (sm+) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm text-left" style={{ minWidth: "900px" }}>
                <thead className="text-[11px] text-slate-500 uppercase tracking-wide bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th onClick={() => handleSort("created_at")} className="px-4 py-3 font-semibold whitespace-nowrap w-[160px] cursor-pointer hover:bg-slate-200 transition-colors select-none">
                      <div className="flex items-center gap-1 justify-between">
                        <span>Waktu</span>
                        {sortConfig?.key === "created_at" ? (
                          sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort("user_email")} className="px-4 py-3 font-semibold w-[180px] cursor-pointer hover:bg-slate-200 transition-colors select-none">
                      <div className="flex items-center gap-1 justify-between">
                        <span>User</span>
                        {sortConfig?.key === "user_email" ? (
                          sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort("action")} className="px-4 py-3 font-semibold w-[130px] cursor-pointer hover:bg-slate-200 transition-colors select-none">
                      <div className="flex items-center gap-1 justify-between">
                        <span>Aksi</span>
                        {sortConfig?.key === "action" ? (
                          sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort("product_name")} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200 transition-colors select-none">
                      <div className="flex items-center gap-1 justify-between">
                        <span>Produk</span>
                        {sortConfig?.key === "product_name" ? (
                          sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort("field")} className="px-4 py-3 font-semibold w-[90px] cursor-pointer hover:bg-slate-200 transition-colors select-none">
                      <div className="flex items-center gap-1 justify-between">
                        <span>Field</span>
                        {sortConfig?.key === "field" ? (
                          sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0" />}
                      </div>
                    </th>
                    <th className="px-4 py-3 font-semibold w-[260px]">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedLogs.map((log: ActivityLog) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700" title={log.user_email ?? "-"}>
                        <span className="block truncate max-w-[160px]">
                          {log.user_email ?? <span className="text-slate-300 italic">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-800" title={log.product_name ?? ""}>
                          {log.product_name ?? <span className="text-slate-300 italic">—</span>}
                        </div>
                        {log.product_id && (
                          <div className="text-[10px] text-slate-400 font-mono">#{log.product_id}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        {log.field ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {log.old_value !== null || log.new_value !== null ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-mono max-w-[110px] truncate" title={log.old_value ?? ""}>
                              {log.old_value || <span className="italic opacity-60">kosong</span>}
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-mono max-w-[110px] truncate" title={log.new_value ?? ""}>
                              {log.new_value || <span className="italic opacity-60">kosong</span>}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="sm:hidden p-3 space-y-2 pb-6">
              {sortedLogs.map((log: ActivityLog) => (
                <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <ActionBadge action={log.action} />
                    <span className="text-[10px] text-slate-400 shrink-0">{formatDate(log.created_at)}</span>
                  </div>

                  {log.product_name && (
                    <div>
                      <p className="text-xs font-semibold text-slate-800 truncate">{log.product_name}</p>
                      {log.product_id && <p className="text-[10px] text-slate-400 font-mono">#{log.product_id}</p>}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">{log.user_email ?? "—"}</span>
                    {log.field && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 ml-2 shrink-0">{log.field}</span>}
                  </div>

                  {(log.old_value !== null || log.new_value !== null) && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-mono max-w-[110px] truncate">
                        {log.old_value || <span className="italic opacity-60">kosong</span>}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-mono max-w-[110px] truncate">
                        {log.new_value || <span className="italic opacity-60">kosong</span>}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium z-50 bg-white ${toast.type === "success" ? "border-green-200 text-green-800" : "border-red-200 text-red-700"
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
