import Image from "next/image";
import Link from "next/link";
import heroBeautyImage from "@/public/images/hero-usemdr-beauty-ai.png";
import labiosImage from "@/public/images/categories/labios.png";
import olhosImage from "@/public/images/categories/olhos.png";
import peleImage from "@/public/images/categories/pele.png";
import skincareImage from "@/public/images/categories/skincare.png";
import pinceisImage from "@/public/images/categories/pinceis.png";
import kitsImage from "@/public/images/categories/kits.png";
import acessoriosImage from "@/public/images/categories/acessorios.png";
import { Brand } from "@/components/brand";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ProductCard, type ProductCardItem } from "@/components/product-card";
import { demoProducts } from "@/lib/demo-products";
import { getLaunchProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

const categories = [
  { name: "Lábios", image: labiosImage },
  { name: "Olhos", image: olhosImage },
  { name: "Pele", image: peleImage },
  { name: "Skincare", image: skincareImage },
  { name: "Pincéis", image: pinceisImage },
  { name: "Kits", image: kitsImage },
  { name: "Acessórios", image: acessoriosImage },
];

export default async function Home() {
  const supabaseProducts = await getLaunchProducts();
  const products: ProductCardItem[] = supabaseProducts.length
    ? supabaseProducts.map((product) => ({ id: product.id, name: product.name, category: product.category, price: product.price, image: product.imageUrl }))
    : demoProducts;

  return (
    <div id="inicio" className="min-h-screen pb-28 md:pb-0">
      <header className="border-b border-brand-border/70 bg-background text-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-3 md:px-8 md:py-4">
          <Brand />
          <nav className="mt-2 hidden items-center gap-8 border-t border-brand-border/70 px-8 pt-2 text-sm font-semibold text-muted md:flex" aria-label="Navegação principal">
            <Link href="/" className="text-brand">Início</Link>
            <Link href="/catalogo" className="transition-colors hover:text-brand">Buscar</Link>
            <Link href="/favoritos" className="transition-colors hover:text-brand">Favoritos</Link>
            <Link href="/carrinho" className="transition-colors hover:text-brand">Carrinho</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <section className="relative flex min-h-[35rem] items-end overflow-hidden rounded-[2rem] border border-brand-border bg-brand-soft p-7 shadow-soft sm:min-h-[38rem] sm:p-10 md:min-h-[30rem] md:items-center md:p-14">
          <Image src={heroBeautyImage} alt="Modelo apresenta um gloss rosa em campanha de beleza da USE MDR" fill preload sizes="(max-width: 768px) calc(100vw - 2.5rem), 1216px" className="object-cover object-[58%_center] md:object-[66%_42%]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,234,241,0.98)_0%,rgba(255,225,235,0.9)_38%,rgba(255,218,229,0.28)_65%,rgba(255,218,229,0)_100%)]" aria-hidden="true" />
          <div className="relative z-10 max-w-[68%] sm:max-w-md md:max-w-xl">
            <p className="mb-4 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand sm:text-xs">✦ NOVIDADES</p>
            <h1 className="font-serif text-[2.45rem] leading-[0.98] tracking-[-0.05em] text-foreground sm:text-6xl md:text-7xl">Beleza que combina com o seu jeito.</h1>
            <p className="mt-5 max-w-xs text-xs leading-5 text-muted sm:text-base sm:leading-7">Maquiagem, skincare e acessórios selecionados para realçar o que há de mais bonito em você.</p>
            <Link href="/catalogo#produtos" className="mt-7 inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full bg-brand px-4 text-[0.62rem] font-extrabold tracking-wide text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-strong sm:min-h-14 sm:px-7 sm:text-sm">
              EXPLORAR NOVIDADES <span className="text-xl leading-none" aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="pt-12 sm:pt-16" aria-labelledby="categories-title">
          <div className="mb-6 flex items-end justify-between gap-5">
            <div><p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">EXPLORE</p><h2 id="categories-title" className="font-serif text-4xl leading-none tracking-[-0.045em] sm:text-5xl">Categorias</h2></div>
            <Link href="/catalogo" className="pb-1 text-xs font-bold text-brand sm:text-sm">Ver todas →</Link>
          </div>
          <ul className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-7 md:gap-5 md:overflow-visible md:px-0">
            {categories.map(({ name, image }) => (
              <li key={name} className="w-24 shrink-0 snap-start text-center md:w-auto">
                <Link href={{ pathname: "/catalogo", query: { categoria: name } }} className="group block">
                  <span className="relative mx-auto block aspect-square w-20 overflow-hidden rounded-full border border-brand-border bg-brand-soft shadow-sm sm:w-24 md:w-full md:max-w-28">
                    <Image src={image} alt="" fill sizes="112px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  </span>
                  <span className="mt-3 block text-xs font-semibold text-foreground group-hover:text-brand sm:text-sm">{name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="lancamentos" className="pt-14 sm:pt-20" aria-labelledby="new-products-title">
          <div className="mb-6 flex items-end justify-between gap-5 sm:mb-8">
            <div><p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">ACABOU DE CHEGAR</p><h2 id="new-products-title" className="font-serif text-4xl leading-none tracking-[-0.045em] sm:text-5xl">Lançamentos</h2></div>
            <Link href="/catalogo#produtos" className="pb-1 text-xs font-bold text-brand sm:text-sm">Ver todos →</Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-6 lg:grid-cols-4">
            {products.map((product) => <ProductCard key={product.id} product={product} showNew />)}
          </div>
        </section>
      </main>
      <MobileNavigation active="home" />
    </div>
  );
}
