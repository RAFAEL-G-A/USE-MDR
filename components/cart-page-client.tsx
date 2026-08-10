"use client";

import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { MobileNavigation } from "@/components/mobile-navigation";
import { TrashIcon } from "@/components/icons";
import { useCart } from "@/components/cart-provider";
import { createWhatsAppOrderUrl, normalizeWhatsAppNumber } from "@/lib/whatsapp";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CartPageClient() {
  const { items, totalQuantity, setQuantity, removeProduct, clearCart } = useCart();
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const whatsappNumber = normalizeWhatsAppNumber(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
  const whatsappUrl = whatsappNumber && items.length ? createWhatsAppOrderUrl(whatsappNumber, items) : "";

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="border-b border-brand-border/70 bg-background text-foreground"><div className="mx-auto flex min-h-20 max-w-7xl items-center justify-center px-5 md:min-h-24 md:justify-between md:px-8"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold text-muted md:flex"><Link href="/">Início</Link><Link href="/catalogo">Buscar</Link><Link href="/favoritos">Favoritos</Link><Link href="/carrinho" className="text-brand">Carrinho</Link></nav></div></header>
      <main className="mx-auto max-w-5xl px-5 py-9 md:px-8 md:py-14">
        <div className="flex items-end justify-between gap-4"><div><p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">SEU PEDIDO</p><h1 className="font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">Carrinho</h1><p className="mt-4 text-sm text-muted">{totalQuantity} {totalQuantity === 1 ? "item selecionado" : "itens selecionados"}</p></div>{items.length > 0 && <button type="button" onClick={clearCart} className="text-xs font-bold text-muted underline-offset-4 hover:text-brand hover:underline">Limpar carrinho</button>}</div>

        {items.length === 0 ? (
          <section className="mt-10 rounded-[2rem] border border-dashed border-brand-border bg-brand-soft/40 px-6 py-16 text-center"><p className="font-serif text-3xl">Seu carrinho está vazio</p><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">Explore o catálogo e adicione os produtos que deseja pedir pelo WhatsApp.</p><Link href="/catalogo#produtos" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-brand px-6 text-xs font-extrabold text-white">EXPLORAR PRODUTOS</Link></section>
        ) : (
          <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
            <section className="space-y-4" aria-label="Itens do carrinho">
              {items.map((item) => (
                <article key={item.id} className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-[1.5rem] border border-brand-border/70 bg-white p-3 shadow-sm sm:grid-cols-[7rem_1fr] sm:p-4">
                  <Link href={`/produto/${encodeURIComponent(item.id)}`} className="relative aspect-square overflow-hidden rounded-[1.1rem] bg-brand-soft"><Image src={item.image} alt={item.name} fill sizes="112px" className="object-cover" /></Link>
                  <div className="min-w-0 py-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-brand">{item.category}</p><h2 className="mt-1 text-sm font-bold sm:text-base"><Link href={`/produto/${encodeURIComponent(item.id)}`}>{item.name}</Link></h2></div><button type="button" onClick={() => removeProduct(item.id)} aria-label={`Remover ${item.name} do carrinho`} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-brand-soft hover:text-brand"><TrashIcon className="size-4" /></button></div><p className="mt-1 text-sm font-extrabold text-brand-strong">{currencyFormatter.format(item.price)}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center rounded-full border border-brand-border bg-background"><button type="button" onClick={() => setQuantity(item.id, item.quantity - 1)} aria-label={`Diminuir quantidade de ${item.name}`} className="flex size-9 items-center justify-center text-lg text-brand">−</button><span className="min-w-8 text-center text-sm font-bold" aria-label={`Quantidade: ${item.quantity}`}>{item.quantity}</span><button type="button" onClick={() => setQuantity(item.id, item.quantity + 1)} aria-label={`Aumentar quantidade de ${item.name}`} className="flex size-9 items-center justify-center text-lg text-brand">+</button></div><p className="text-sm font-extrabold">{currencyFormatter.format(item.price * item.quantity)}</p></div></div>
                </article>
              ))}
            </section>

            <aside className="rounded-[1.75rem] border border-brand-border bg-white p-6 shadow-soft lg:sticky lg:top-6"><h2 className="font-serif text-3xl">Resumo</h2><div className="mt-5 flex justify-between border-b border-brand-border/70 pb-4 text-sm text-muted"><span>Produtos ({totalQuantity})</span><span>{currencyFormatter.format(total)}</span></div><div className="flex items-end justify-between pt-5"><span className="font-bold">Total</span><strong className="text-xl text-brand-strong">{currencyFormatter.format(total)}</strong></div>{whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-6 flex min-h-14 w-full items-center justify-center rounded-full bg-[#25D366] px-4 text-center text-xs font-extrabold text-white shadow-lg shadow-[#25D366]/20 hover:bg-[#1fb85a]">FINALIZAR PEDIDO PELO WHATSAPP</a> : <button type="button" disabled className="mt-6 flex min-h-14 w-full cursor-not-allowed items-center justify-center rounded-full bg-muted/30 px-4 text-center text-xs font-extrabold text-muted">WHATSAPP A CONFIGURAR</button>}{!whatsappNumber && <p className="mt-3 text-center text-[0.68rem] leading-5 text-muted">O número oficial da loja será configurado antes da publicação.</p>}<p className="mt-4 text-center text-[0.65rem] leading-5 text-muted">Ao continuar, o WhatsApp abrirá com o resumo completo do pedido. Nenhum pagamento será realizado no site.</p></aside>
          </div>
        )}
      </main>
      <MobileNavigation active="cart" />
    </div>
  );
}
