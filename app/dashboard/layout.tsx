"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getActiveStore, StoreProfile } from "@/lib/store";
import Link from "next/link";
import { LayoutDashboard, UploadCloud, LogOut, Store, Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const active = getActiveStore();
    if (!active) {
      router.push("/");
    } else {
      setStore(active);
    }
  }, [router]);

  if (!store) return null; // Or a loading spinner

  const navItems = [
    { name: "Manage Products", href: "/dashboard", icon: LayoutDashboard },
    { name: "Upload Product", href: "/dashboard/upload", icon: UploadCloud },
  ];

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
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Store className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Price Manager</h1>
              <div className="text-xs text-slate-400 truncate w-40" title={store.url}>
                {new URL(store.url).hostname}
              </div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 -mr-2 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

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
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-slate-800 transition-colors text-left"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
            Switch Store
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
