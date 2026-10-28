"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/lib/useTheme";
import {
  LayoutDashboard,
  Calendar,
  Users,
  KeyRound,
  Archive,
  Bell,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/code-requests", label: "Code Requests", icon: KeyRound },
  { href: "/admin/archives", label: "Archives", icon: Archive },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // The drawer only shows when it was opened on the current route, so
  // navigating closes it without a setState-in-effect round trip.
  const [menu, setMenu] = useState<{ open: boolean; pathname: string | null }>({ open: false, pathname: null });
  const mobileOpen = menu.open && menu.pathname === pathname;

  const { darkMode, toggleTheme } = useTheme();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const SidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="w-20 h-20 rounded-xl bg-secondary/15 flex items-center justify-center shrink-0 overflow-hidden">
          <img src="/SJA-Logo.png" alt="SJA logo" className="w-16 h-16 object-contain" />
        </div>
        <div className="text-sm font-bold text-foreground">Admin area</div>
      </div>

      <div className="px-4 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40 px-2 mb-2">
          Navigation
        </div>
        <nav className="space-y-1.5" aria-label="Admin navigation">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-secondary text-white shadow-sm"
                    : "text-foreground/70 hover:bg-background hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1" />

      <div className="px-4 py-4 border-t border-border space-y-1.5">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:bg-background hover:text-foreground transition-colors"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
          {darkMode ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:bg-background hover:text-secondary transition-colors"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          Log out
        </button>
      </div>

      <div className="px-5 py-3 border-t border-border">
        <p className="text-[11px] text-foreground/40">SJA Digital Calendar · Admin</p>
      </div>
    </>
  );

  // Login page renders without the admin shell
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 border-r border-border bg-card">
        {SidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <button
          onClick={() => setMenu({ open: true, pathname })}
          className="p-2 rounded-lg hover:bg-background transition-colors"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="text-sm font-bold">Admin</div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-background transition-colors"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile slide-out */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMenu((m) => ({ ...m, open: false }))}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-card border-r border-border shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-bold">Menu</span>
              <button
                onClick={() => setMenu((m) => ({ ...m, open: false }))}
                className="p-2 rounded-lg hover:bg-background transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {SidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 md:p-8 pt-16 md:pt-6 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
