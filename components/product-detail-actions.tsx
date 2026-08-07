"use client";

import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { useCart } from "@/components/cart-provider";
import { useFavorites } from "@/components/favorites-provider";
import type { CartProduct } from "@/lib/cart-store";

export function ProductDetailActions({ product }: { product: CartProduct }) {
  const { addProduct } = useCart();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [justAdded, setJustAdded] = useState(false);
  const isFavorite = favoriteIds.has(product.id);

  function addToCart() {
    addProduct(product);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  }

  return <div className="mt-7 flex gap-3"><button type="button" onClick={addToCart} className="flex min-h-14 flex-1 items-center justify-center rounded-full bg-brand px-5 text-xs font-extrabold text-white shadow-lg shadow-brand/20 hover:bg-brand-strong">{justAdded ? "ADICIONADO ✓" : "ADICIONAR AO CARRINHO"}</button><button type="button" onClick={() => toggleFavorite(product)} aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} className={`flex size-14 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white ${isFavorite ? "text-brand" : "text-foreground"}`}><HeartIcon className="size-6" filled={isFavorite} /></button></div>;
}
