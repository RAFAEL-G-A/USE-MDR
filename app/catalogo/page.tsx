import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ArrowLeftIcon, SearchIcon } from "@/components/icons";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ProductCard, type ProductCardItem } from "@/components/product-card";
import { getCategoryVisuals } from "@/lib/category-images";
import { demoProducts } from "@/lib/demo-products";
import { getLatestProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Catálogo | USE MDR Beauty", description: "Explore as categorias e encontre seus produtos favoritos na USE MDR Beauty." };

const subcategories: Record<string, string[]> = {
  "Lábios": ["Gloss", "Batons", "Lip Tint", "Balm", "Lápis Labial"],
  "Olhos": ["Paletas", "Sombras", "Máscara de Cílios", "Delineadores", "Lápis", "Sobrancelhas"],
  "Pele": ["Bases", "Corretivos", "Pós", "Blush", "Iluminadores", "Contorno", "Primer"],
  "Skincare": ["Séruns", "Hidratantes", "Esfoliantes", "Limpeza Facial", "Protetor Solar", "Máscaras"],
  "Pincéis": ["Pincéis para Rosto", "Pincéis para Olhos", "Kits de Pincéis", "Esponjas"],
  "Kits": ["Kits de Maquiagem", "Kits de Skincare", "Kits Presente"],
  "Acessórios": ["Necessaires", "Espelhos", "Organizadores", "Aplicadores", "Óculos"],
};

function firstValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function normalized(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(); }

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; categoria?: string | string[]; subcategoria?: string | string[] }> }) {
  const params = await searchParams;
  const query = firstValue(params.q);
  const selectedCategory = firstValue(params.categoria);
  const selectedSubcategory = firstValue(params.subcategoria);
  const [supabaseProducts, categories] = await Promise.all([
    getLatestProducts(60),
    getCategoryVisuals(),
  ]);
  const allProducts: ProductCardItem[] = supabaseProducts.length
    ? supabaseProducts.map((product) => ({ id: product.id, name: product.name, category: product.category, subcategory: product.subcategory, price: product.price, image: product.imageUrl }))
    : demoProducts;
  const filteredProducts = allProducts.filter((product) => {
    const categoryMatch = !selectedCategory || normalized(product.category) === normalized(selectedCategory);
    const subcategoryMatch = !selectedSubcategory || normalized(product.subcategory ?? "") === normalized(selectedSubcategory);
    const searchMatch = !query || normalized(`${product.name} ${product.category} ${product.subcategory ?? ""}`).includes(normalized(query));
    return categoryMatch && subcategoryMatch && searchMatch;
  });

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="border-b border-brand-border/70 bg-background text-foreground">
        <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-3 md:px-8 md:py-4">
          <Link href="/" aria-label="Voltar para a página inicial" className="absolute left-5 flex size-10 items-center justify-center rounded-full border border-brand-border bg-white text-foreground md:hidden"><ArrowLeftIcon className="size-5" /></Link>
          <Brand />
          <nav className="mt-2 hidden items-center gap-8 border-t border-brand-border/70 px-8 pt-2 text-sm font-semibold text-muted md:flex" aria-label="Navegação principal"><Link href="/">Início</Link><Link href="/catalogo" className="text-brand">Buscar</Link><Link href="/favoritos">Favoritos</Link><Link href="/carrinho">Carrinho</Link></nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <div className="max-w-2xl"><p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">EXPLORE</p><h1 className="font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">Categorias</h1><p className="mt-4 text-sm leading-6 text-muted sm:text-base">Escolha uma categoria para descobrir produtos feitos para você.</p></div>

        <form action="/catalogo" method="get" className="relative mt-7 max-w-2xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-brand" />
          <input name="q" defaultValue={query} placeholder="Buscar produtos..." aria-label="Buscar produtos" className="min-h-14 w-full rounded-full border border-brand-border bg-white py-3 pl-12 pr-24 text-sm outline-none transition-shadow placeholder:text-muted/70 focus:shadow-[0_0_0_3px_var(--brand-soft)] sm:pr-28" />
          <button type="submit" className="absolute right-1.5 top-1/2 min-h-11 -translate-y-1/2 rounded-full bg-brand px-4 text-[0.65rem] font-extrabold text-white hover:bg-brand-strong sm:px-5 sm:text-xs">BUSCAR</button>
        </form>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-label="Categorias de produtos">
          {categories.map((category, index) => (
            <Link key={category.name} href={{ pathname: "/catalogo", query: { categoria: category.name } }} className={`group relative min-h-56 overflow-hidden rounded-[1.75rem] border border-brand-border shadow-sm sm:min-h-72 ${index === 6 ? "col-span-2 lg:col-span-1" : ""}`}>
              <Image src={category.image} alt="" fill loading={index < 2 ? "eager" : "lazy"} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#35151f]/80 via-[#54222c]/15 to-transparent" aria-hidden="true" />
              <span className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-6"><strong className="block text-xl font-extrabold sm:text-2xl">{category.name}</strong><span className="mt-1 block text-xs text-white/90 sm:text-sm">{category.description}</span><span className="mt-4 flex items-center gap-2 text-xs font-bold">Explorar <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-lg backdrop-blur">→</span></span></span>
            </Link>
          ))}
        </section>

        <section id="produtos" className="scroll-mt-6 pt-16 sm:pt-20" aria-labelledby="products-title">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">ENCONTRE O SEU FAVORITO</p><h2 id="products-title" className="font-serif text-4xl leading-none tracking-[-0.045em] sm:text-5xl">{selectedCategory || query ? "Resultados" : "Todos os produtos"}</h2></div>
            {(selectedCategory || selectedSubcategory || query) && <Link href="/catalogo#produtos" className="rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-bold text-brand">Limpar filtros</Link>}
          </div>
          {selectedCategory && subcategories[selectedCategory] && <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={`Subcategorias de ${selectedCategory}`}><Link href={{ pathname: "/catalogo", query: { categoria: selectedCategory } }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${!selectedSubcategory ? "border-brand bg-brand text-white" : "border-brand-border bg-white text-brand"}`}>Todos</Link>{subcategories[selectedCategory].map((subcategory) => <Link key={subcategory} href={{ pathname: "/catalogo", query: { categoria: selectedCategory, subcategoria: subcategory } }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${selectedSubcategory === subcategory ? "border-brand bg-brand text-white" : "border-brand-border bg-white text-brand"}`}>{subcategory}</Link>)}</nav>}
          {(selectedCategory || selectedSubcategory || query) && <p className="mb-6 text-sm text-muted">{filteredProducts.length} {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}{selectedSubcategory ? ` em ${selectedSubcategory}` : selectedCategory ? ` em ${selectedCategory}` : ""}{query ? ` para “${query}”` : ""}.</p>}
          {filteredProducts.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-6 lg:grid-cols-4">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="rounded-[1.75rem] border border-dashed border-brand-border bg-brand-soft/40 px-6 py-12 text-center"><p className="font-serif text-2xl">Nenhum produto encontrado</p><p className="mt-2 text-sm text-muted">Tente outro termo ou explore uma categoria diferente.</p></div>}
        </section>
      </main>
      <MobileNavigation active="catalog" />
    </div>
  );
}
