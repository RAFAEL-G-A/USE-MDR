"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminNavigation } from "@/components/admin-navigation";
import { Brand } from "@/components/brand";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffeaf1_0,transparent_32rem)]">
      <header className="sticky top-0 z-50 border-b border-brand-border/70 bg-background/95 text-foreground shadow-[0_8px_24px_rgba(93,31,53,0.05)] backdrop-blur-md">
        <div className="mx-auto flex min-h-18 max-w-[96rem] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-brand-border bg-white text-brand md:hidden"
              aria-label="Abrir menu administrativo"
              aria-expanded={mobileOpen}
            >
              <MenuIcon className="size-5" />
            </button>
            <div className="min-w-0 [&_a]:w-36 sm:[&_a]:w-48"><Brand /></div>
          </div>
          <Link href="/catalogo" prefetch={false} className="shrink-0 rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand-soft">Ver catálogo</Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[96rem] items-start">
        <aside className={`sticky top-18 hidden h-[calc(100vh-4.5rem)] shrink-0 border-r border-brand-border/75 bg-background/88 py-4 backdrop-blur-md transition-[width] duration-200 md:block ${collapsed ? "w-20" : "w-72"}`}>
          <div className={`mb-3 flex ${collapsed ? "justify-center" : "justify-end px-3"}`}>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="flex size-10 items-center justify-center rounded-2xl border border-brand-border bg-white text-brand hover:bg-brand-soft"
              aria-label={collapsed ? "Expandir menu administrativo" : "Recolher menu administrativo"}
              aria-expanded={!collapsed}
            >
              <ChevronIcon className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
          <AdminNavigation collapsed={collapsed} />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 md:py-10 lg:px-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menu administrativo">
          <button type="button" className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Fechar menu administrativo" />
          <aside className="relative h-full w-[min(19rem,86vw)] overflow-y-auto border-r border-brand-border bg-background px-1 py-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 px-4">
              <p className="text-xs font-extrabold tracking-[0.16em] text-brand">PAINEL USE MDR</p>
              <button type="button" onClick={() => setMobileOpen(false)} className="flex size-10 items-center justify-center rounded-2xl border border-brand-border bg-white text-brand" aria-label="Fechar menu administrativo">
                <CloseIcon className="size-4" />
              </button>
            </div>
            <AdminNavigation onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function CloseIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function ChevronIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
