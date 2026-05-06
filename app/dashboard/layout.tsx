"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getActiveStore, setActiveStore, StoreProfile } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, UserProfile } from "@/lib/profile";
import Link from "next/link";
import { LayoutDashboard, UploadCloud, LogOut, Store, Menu, X, ClipboardList, ShieldCheck, User } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { name: "Upload Product", href: "/dashboard/upload", icon: UploadCloud },
    // Only show Activity Logs to all, but admins see all users' logs
    { name: "Activity Logs", href: "/dashboard/logs", icon: ClipboardList },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setActiveStore(null);
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden">

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-lg leading-tight">Price Manager</h1>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 text-slate-300 hover:text-white">
          <Menu className="w-6 h-6" />
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

        {/* Logo + Store */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Store className="w-8 h-8 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">Price Manager</h1>
              <div className="text-xs text-slate-400 truncate w-36" title={store.url}>
                {new URL(store.url).hostname}
              </div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 -mr-2 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
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
                {/* Admin badge on Activity Logs */}
                {item.href === "/dashboard/logs" && isAdmin && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500 text-white rounded uppercase tracking-wide">
                    All
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info + Actions */}
        <div className="p-4 mt-auto border-t border-slate-800">
          {/* User email + role badge */}
          {profile && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2 bg-slate-800 rounded-xl">
              <div className={`p-1.5 rounded-lg ${isAdmin ? "bg-amber-500/20" : "bg-slate-700"}`}>
                {isAdmin
                  ? <ShieldCheck className="w-4 h-4 text-amber-400" />
                  : <User className="w-4 h-4 text-slate-400" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white font-medium truncate" title={profile.email}>
                  {profile.full_name || profile.email.split("@")[0]}
                </div>
                <div className={`text-[10px] font-semibold uppercase tracking-wider ${isAdmin ? "text-amber-400" : "text-slate-500"}`}>
                  {isAdmin ? "Admin" : "User"}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl hover:bg-slate-800 transition-colors text-left text-slate-300"
            >
              <Store className="w-4 h-4 text-slate-400" />
              <span className="text-sm">Switch Store</span>
            </button>
            <button
              onClick={handleSignOut}
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
    </div>
  );
}
