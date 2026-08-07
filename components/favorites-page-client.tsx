"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ProductCard } from "@/components/product-card";
import { useFavorites } from "@/components/favorites-provider";

export function FavoritesPageClient() {
  const { favorites } = useFavorites();
  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="border-b border-brand-border/70 bg-background/95"><div className="mx-auto flex min-h-24 max-w-7xl items-center justify-center px-5 md:min-h-28 md:justify-between md:px-8"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold md:flex"><Link href="/">Início</Link><Link href="/catalogo">Buscar</Link><Link href="/favoritos" className="text-brand">Favoritos</Link><Link href="/carrinho">Carrinho</Link></nav></div></header>
      <main className="mx-auto max-w-7xl px-5 py-9 md:px-8 md:py-14"><p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">SALVOS PARA VOCÊ</p><h1 className="font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">Favoritos</h1><p className="mt-4 text-sm text-muted">{favorites.length} {favorites.length === 1 ? "produto favorito" : "produtos favoritos"}</p>{favorites.length ? <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-6 lg:grid-cols-4">{favorites.map((product, index) => <ProductCard key={product.id} product={product} eager={index < 2} />)}</div> : <section className="mt-10 rounded-[2rem] border border-dashed border-brand-border bg-brand-soft/40 px-6 py-16 text-center"><p className="font-serif text-3xl">Nenhum favorito ainda</p><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">Toque no coração de um produto para guardar seus preferidos neste aparelho.</p><Link href="/catalogo#produtos" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-brand px-6 text-xs font-extrabold text-white">DESCOBRIR PRODUTOS</Link></section>}</main>
      <MobileNavigation active="favorites" />
    </div>
  );
}
