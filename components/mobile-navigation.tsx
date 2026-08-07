"use client";

import Link from "next/link";
import { BagIcon, HeartIcon, HomeIcon, SearchIcon } from "@/components/icons";
import { useCart } from "@/components/cart-provider";
import { useFavorites } from "@/components/favorites-provider";

type ActivePage = "home" | "catalog" | "favorites" | "cart" | "none";

const items = [
  { label: "Início", href: "/", key: "home", Icon: HomeIcon, enabled: true },
  { label: "Buscar", href: "/catalogo", key: "catalog", Icon: SearchIcon, enabled: true },
  { label: "Favoritos", href: "/favoritos", key: "favorites", Icon: HeartIcon, enabled: true },
  { label: "Carrinho", href: "/carrinho", key: "cart", Icon: BagIcon, enabled: true },
] as const;

export function MobileNavigation({ active }: { active: ActivePage }) {
  const { totalQuantity } = useCart();
  const { favorites } = useFavorites();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[2rem] border border-brand-border/70 bg-white/95 p-2 shadow-soft backdrop-blur-md md:hidden" aria-label="Navegação mobile">
      {items.map(({ label, href, key, Icon, enabled }) => {
        const isActive = active === key;
        const classes = `flex min-h-16 flex-col items-center justify-center gap-1 rounded-[1.35rem] text-[0.68rem] font-semibold transition-colors ${isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft/60 hover:text-brand"}`;
        const badge = key === "cart" ? totalQuantity : key === "favorites" ? favorites.length : 0;
        const content = <><span className="relative"><Icon className="size-6" />{badge > 0 && <span className="absolute -right-3 -top-2 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[0.58rem] font-extrabold leading-5 text-white">{badge > 99 ? "99+" : badge}</span>}</span>{label}</>;

        return enabled ? (
          <Link key={key} href={href} aria-current={isActive ? "page" : undefined} className={classes}>{content}</Link>
        ) : (
          <span key={key} className={`${classes} cursor-not-allowed opacity-55`} title={`${label} estará disponível em breve`}>{content}</span>
        );
      })}
    </nav>
  );
}
