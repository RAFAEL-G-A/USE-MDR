import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ProductDetailActions } from "@/components/product-detail-actions";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { getProductById } from "@/lib/products";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return product ? { title: `${product.name} | USE MDR Beauty`, description: product.description ?? `Conheça ${product.name} na USE MDR Beauty.` } : { title: "Produto não encontrado | USE MDR Beauty" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const portableProduct = { id: product.id, name: product.name, category: product.category, price: product.price, image: product.imageUrl };

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="border-b border-brand-border/70 bg-background text-foreground"><div className="mx-auto flex min-h-20 max-w-7xl items-center justify-center px-5 md:min-h-24 md:justify-between md:px-8"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold text-muted md:flex"><Link href="/">Início</Link><Link href="/catalogo">Buscar</Link><Link href="/favoritos">Favoritos</Link><Link href="/carrinho">Carrinho</Link></nav></div></header>
      <main className="mx-auto max-w-6xl px-5 py-7 md:px-8 md:py-14"><Link href="/catalogo#produtos" className="text-xs font-bold text-brand">← Voltar ao catálogo</Link><div className="mt-6 grid gap-8 md:grid-cols-2 md:items-center md:gap-14"><ProductImageGallery images={product.images} productName={product.name} /><div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.2em] text-brand">{product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}</p><h1 className="mt-3 font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-6xl">{product.name}</h1><p className="mt-5 text-2xl font-extrabold text-brand-strong">{currencyFormatter.format(product.price)}</p><p className="mt-6 text-sm leading-7 text-muted sm:text-base">{product.description || "Produto selecionado especialmente para realçar sua beleza e completar sua rotina de cuidados."}</p><p className="mt-5 inline-flex rounded-full bg-brand-soft px-3 py-2 text-xs font-bold text-brand">{product.stock > 0 ? "Disponível" : "Indisponível"}</p>{product.stock > 0 && <ProductDetailActions product={portableProduct} />}<div className="mt-7 rounded-[1.25rem] border border-brand-border/70 bg-white p-4 text-xs leading-6 text-muted"><strong className="text-foreground">Compra simples e segura:</strong> adicione ao carrinho e combine pagamento e entrega diretamente com a USE MDR pelo WhatsApp.</div></div></div></main>
      <MobileNavigation active="none" />
    </div>
  );
}
