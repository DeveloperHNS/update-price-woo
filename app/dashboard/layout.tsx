"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getActiveStore, setActiveStore, StoreProfile } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, UserProfile } from "@/lib/profile";
import Link from "next/link";
import { LayoutDashboard, UploadCloud, LogOut, Store, Menu, X, ClipboardList, ShieldCheck, User, Users, ArrowLeftRight, DollarSign } from "lucide-react";

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      const active = getActiveStore();
      if (!active) {
        router.replace("/");
      } else {
        setStore(active);
        // Load user profile + role
        getCurrentProfile().then(setProfile);
      }
    });
  }, [router]);

  if (!store) return null;

  const isAdmin = profile?.role === "admin";

  const navItems = [
    { name: "Manage Products", href: "/dashboard", icon: LayoutDashboard },
    { name: "Update Harga", href: "/dashboard/update-prices", icon: DollarSign },
    { name: "Upload Product", href: "/dashboard/upload", icon: UploadCloud },
    { name: "Sync Harga", href: "/dashboard/sync", icon: ArrowLeftRight },
    // Activity Logs — hanya admin yang bisa lihat
    ...(isAdmin ? [{ name: "Activity Logs", href: "/dashboard/logs", icon: ClipboardList }] : []),
    // Admin-only: user management
    ...(isAdmin ? [{ name: "Manajemen User", href: "/dashboard/admin/users", icon: Users }] : []),
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setActiveStore(null);
    router.replace("/login");
  };

  const askSwitchStore = () => {
    setConfirm({
      title: "Pindah Toko?",
      message: "Kamu akan keluar dari toko ini dan kembali ke halaman pemilihan toko.",
      confirmLabel: "Ya, Pindah Toko",
      confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
      onConfirm: () => { setConfirm(null); router.push("/"); },
    });
  };

  const askSignOut = () => {
    setConfirm({
      title: "Keluar Akun?",
      message: "Kamu akan logout dari aplikasi. Sesi kamu akan diakhiri.",
      confirmLabel: "Ya, Keluar",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
      onConfirm: () => { setConfirm(null); handleSignOut(); },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden">

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Store className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-sm leading-tight truncate">Price Manager</h1>
            <p className="text-[10px] text-slate-400 truncate">{store ? new URL(store.url).hostname : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700 min-w-[44px] min-h-[44px] justify-center"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>

        {/* Logo + Store + Close button */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 text-white min-w-0">
            <Store className="w-7 h-7 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight">Price Manager</h1>
              <div className="text-xs text-slate-400 truncate w-32" title={store.url}>
                {new URL(store.url).hostname}
              </div>
            </div>
          </div>
          {/* Close sidebar — mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700 min-w-[44px] min-h-[44px] justify-center shrink-0"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-medium shadow-md shadow-blue-900/20"
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-blue-200" : "text-slate-400"}`} />
                <span className="flex-1">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info + Actions */}
        <div className="p-4 mt-auto border-t border-slate-800">
          {/* User email + role badge */}
          {profile && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2 bg-slate-800 rounded-xl">
              <div className={`p-1.5 rounded-lg ${isAdmin ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
                {isAdmin
                  ? <ShieldCheck className="w-4 h-4 text-amber-400" />
                  : <User className="w-4 h-4 text-blue-400" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white font-medium truncate" title={profile.email}>
                  {profile.full_name || profile.email.split("@")[0]}
                </div>
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${isAdmin ? "text-amber-400" : "text-blue-400"}`}>
                  {isAdmin ? "Admin" : `PIC${profile.pic_category ? ` · ${profile.pic_category}` : ""}`}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <button
              onClick={askSwitchStore}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl hover:bg-slate-800 transition-colors text-left text-slate-300"
            >
              <Store className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Switch Store</span>
            </button>
            <button
              onClick={askSignOut}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl hover:bg-red-900/40 transition-colors text-left text-slate-300 hover:text-red-300"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
        {children}
      </main>

      {/* Confirm Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-1">{confirm.title}</h3>
            <p className="text-sm text-slate-500 mb-6">{confirm.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirm.onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${confirm.confirmClass}`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
