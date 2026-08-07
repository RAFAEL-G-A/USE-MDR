"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { useCart } from "@/components/cart-provider";
import { useFavorites } from "@/components/favorites-provider";
import Link from "next/link";

export type ProductCardItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: StaticImageData | string;
  subcategory?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductCard({ product, showNew = false, eager = false }: { product: ProductCardItem; showNew?: boolean; eager?: boolean }) {
  const { addProduct } = useCart();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [justAdded, setJustAdded] = useState(false);
  const isFavorite = favoriteIds.has(product.id);
  const portableProduct = { id: product.id, name: product.name, category: product.category, price: product.price, image: typeof product.image === "string" ? product.image : product.image.src };

  function handleAddProduct() {
    addProduct({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image: portableProduct.image,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <article className="group min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-brand-border/70 bg-brand-soft shadow-sm">
        <Link href={`/produto/${encodeURIComponent(product.id)}`} aria-label={`Ver detalhes de ${product.name}`} className="absolute inset-0"><Image src={product.image} alt={product.name} fill loading={eager ? "eager" : "lazy"} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /></Link>
        {showNew && <span className="absolute left-2.5 top-2.5 rounded-full bg-brand px-2.5 py-1 text-[0.58rem] font-extrabold tracking-wide text-white sm:left-4 sm:top-4 sm:text-[0.65rem]">NOVO</span>}
        <button type="button" onClick={() => toggleFavorite(portableProduct)} aria-label={`${isFavorite ? "Remover" : "Adicionar"} ${product.name} ${isFavorite ? "dos" : "aos"} favoritos`} className={`absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm sm:right-4 sm:top-4 sm:size-10 ${isFavorite ? "text-brand" : "text-foreground"}`}>
          <HeartIcon className="size-4 sm:size-5" filled={isFavorite} />
        </button>
      </div>
      <div className="px-1 pt-3 sm:pt-4">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-brand sm:text-[0.68rem]">{product.category}</p>
        <h3 className="mt-1 min-h-10 text-sm font-semibold leading-5 text-foreground sm:text-base"><Link href={`/produto/${encodeURIComponent(product.id)}`} className="hover:text-brand">{product.name}</Link></h3>
        <p className="mt-1 text-sm font-extrabold text-brand-strong sm:text-base">{currencyFormatter.format(product.price)}</p>
        <button type="button" onClick={handleAddProduct} className={`mt-3 flex min-h-10 w-full items-center justify-center rounded-full border text-[0.65rem] font-extrabold transition-colors sm:text-xs ${justAdded ? "border-brand bg-brand text-white" : "border-brand text-brand hover:bg-brand hover:text-white"}`}>
          {justAdded ? "ADICIONADO ✓" : "ADICIONAR"}
        </button>
      </div>
    </article>
  );
}
