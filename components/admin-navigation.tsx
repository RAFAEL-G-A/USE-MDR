"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/estoque", label: "Gerenciar estoque", description: "Produtos, imagens e quantidades", icon: InventoryIcon },
  { href: "/admin/categorias", label: "Categorias", description: "Categorias, subcategorias e imagens", icon: CategoriesIcon },
  { href: "/admin/vendas", label: "Vendas", description: "Venda única ou com vários itens", icon: SalesIcon },
  { href: "/admin/destaques", label: "Destaques", description: "Carrossel da página inicial", icon: HighlightsIcon },
  { href: "/admin/financas", label: "Finanças", description: "Resultados, despesas e relatórios", icon: EarningsIcon },
  { href: "/admin/metricas", label: "Métricas", description: "Visitas e pedidos pelo WhatsApp", icon: MetricsIcon },
];

export function AdminNavigation({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col px-3 pb-4" aria-label="Áreas administrativas">
      <p className={`px-3 pb-3 pt-1 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-muted ${collapsed ? "sr-only" : ""}`}>
        Acessos do painel
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={`group flex min-h-14 items-center rounded-2xl border transition-colors ${collapsed ? "justify-center px-3" : "gap-3 px-4 py-3"} ${active ? "border-brand bg-brand text-white shadow-lg shadow-brand/15" : "border-transparent text-foreground hover:border-brand-border hover:bg-white"}`}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{item.label}</span>
                  <span className={`mt-0.5 block truncate text-[0.65rem] ${active ? "text-white/75" : "text-muted"}`}>{item.description}</span>
                </span>
              )}
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

function CategoriesIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h6v6H4zM14 5.5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

function SalesIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16v11H4zM7 4h10v3M8 11h4m-4 3h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 10.5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function EarningsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MetricsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M3 19h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
