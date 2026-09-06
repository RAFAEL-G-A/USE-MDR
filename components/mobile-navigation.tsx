"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

function activePageForPathname(pathname: string): ActivePage {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/catalogo")) return "catalog";
  if (pathname.startsWith("/favoritos")) return "favorites";
  if (pathname.startsWith("/carrinho")) return "cart";
  return "none";
}

export function MobileNavigation() {
  const pathname = usePathname();
  const { totalQuantity } = useCart();
  const { favorites } = useFavorites();
  const active = activePageForPathname(pathname);
  const [pendingActive, setPendingActive] = useState<{ key: ActivePage; pathname: string } | null>(null);
  const visualActive = pendingActive?.pathname === pathname ? pendingActive.key : active;

  if (pathname.startsWith("/admin")) return null;

  const activeIndex = items.findIndex((item) => item.key === visualActive);

  return (
    <nav className="fixed inset-x-5 bottom-4 z-50 grid min-h-[4.5rem] grid-cols-4 rounded-[2.25rem] border border-brand-border/70 bg-white/95 px-2 py-2 shadow-[0_18px_45px_rgb(93_31_53_/_14%)] backdrop-blur-md md:hidden" aria-label="Navegação mobile">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-2 flex h-14 w-[calc((100%-1rem)/4)] items-center justify-center transition-[transform,opacity] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          opacity: activeIndex >= 0 ? 1 : 0,
          transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
        }}
      >
        <span className="size-12 -translate-y-3 rounded-full bg-brand ring-[5px] ring-background shadow-[0_12px_28px_rgb(233_30_99_/_30%)]" />
      </span>
      {items.map(({ label, href, key, Icon, enabled }) => {
        const isActive = visualActive === key;
        const classes = "relative z-10 flex min-h-14 items-center justify-center rounded-full";
        const badge = key === "cart" ? totalQuantity : key === "favorites" ? favorites.length : 0;
        const content = <><span data-cart-target={key === "cart" ? "true" : undefined} data-favorites-target={key === "favorites" ? "true" : undefined} className={`relative flex size-12 rounded-full transition-[transform,color] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none ${isActive ? "-translate-y-3 text-white" : "text-muted hover:text-brand"}`}><Icon className="m-auto size-6" />{badge > 0 && <span className={`absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full px-1 text-[0.58rem] font-extrabold leading-5 ${isActive ? "bg-white text-brand shadow-sm" : "bg-brand text-white"}`}>{badge > 99 ? "99+" : badge}</span>}</span><span className="sr-only">{label}</span></>;

        return enabled ? (
          <Link key={key} href={href} prefetch={false} onNavigate={() => setPendingActive({ key, pathname })} aria-label={label} aria-current={active === key ? "page" : undefined} className={classes}>{content}</Link>
        ) : (
          <span key={key} aria-label={label} className={`${classes} cursor-not-allowed opacity-55`} title={`${label} estará disponível em breve`}>{content}</span>
        );
      })}
    </nav>
  );
}
