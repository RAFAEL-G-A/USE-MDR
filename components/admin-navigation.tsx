"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/estoque", label: "Gerenciar estoque", mobileLabel: "Estoque", description: "Produtos, imagens e quantidades", icon: InventoryIcon },
  { href: "/admin/vendas", label: "Vendas", mobileLabel: "Vendas", description: "Venda única ou com vários itens", icon: SalesIcon },
  { href: "/admin/destaques", label: "Destaques", mobileLabel: "Destaques", description: "Carrossel da página inicial", icon: HighlightsIcon },
  { href: "/admin/financas", label: "Finanças", mobileLabel: "Finanças", description: "Resultados, despesas e relatórios", icon: EarningsIcon },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto max-w-5xl px-3 py-3 md:px-8" aria-label="Áreas administrativas">
      <p className="mb-2 px-2 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-muted md:hidden">Acessos do painel</p>
      <div className="grid grid-cols-4 gap-1.5 md:gap-3">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} prefetch={false} aria-current={active ? "page" : undefined} className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border px-2 py-2.5 text-center transition-colors md:px-5 ${active ? "border-brand bg-brand text-white shadow-lg shadow-brand/15" : "border-brand-border bg-white text-brand hover:bg-brand-soft"}`}>
            <Icon className="size-5 shrink-0 md:size-6" />
            <span>
            <span className="block text-[0.65rem] font-extrabold sm:hidden">{item.mobileLabel}</span>
            <span className="hidden text-sm font-extrabold sm:block">{item.label}</span>
            <span className={`mt-1 hidden text-[0.65rem] md:block ${active ? "text-white/75" : "text-muted"}`}>{item.description}</span>
            </span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}

function InventoryIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

function HighlightsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

function SalesIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16v11H4zM7 4h10v3M8 11h4m-4 3h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 10.5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function EarningsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
