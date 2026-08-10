"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/estoque", label: "Gerenciar estoque", description: "Produtos, imagens e quantidades" },
  { href: "/admin/destaques", label: "Destaques", description: "Carrossel da página inicial" },
  { href: "/admin/rendimentos", label: "Rendimentos", description: "Vendas, caixa e relatórios" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto grid max-w-5xl grid-cols-3 gap-2 px-5 pb-5 md:gap-4 md:px-8" aria-label="Áreas administrativas">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-2xl border px-3 py-3 text-center transition-colors md:px-5 ${active ? "border-brand bg-brand text-white shadow-lg shadow-brand/15" : "border-brand-border bg-white text-brand hover:bg-brand-soft"}`}>
            <span className="block text-[0.68rem] font-extrabold sm:text-sm">{item.label}</span>
            <span className={`mt-1 hidden text-[0.65rem] md:block ${active ? "text-white/75" : "text-muted"}`}>{item.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
