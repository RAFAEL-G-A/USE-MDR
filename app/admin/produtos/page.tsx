import type { Metadata } from "next";
import Link from "next/link";
import { AdminProductForm } from "@/components/admin-product-form";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Gerenciar catálogo | USE MDR",
  description: "Área administrativa de produtos e destaques da USE MDR.",
  robots: { index: false, follow: false },
};

export default function AdminProductsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffeaf1_0,transparent_32rem)]">
      <header className="border-b border-brand-border/70 bg-background text-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-5 py-3 md:px-8">
          <Brand />
          <Link
            href="/catalogo"
            className="rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand-soft"
          >
            Ver catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-[0.68rem] font-extrabold tracking-[0.24em] text-brand">
            ÁREA ADMINISTRATIVA
          </p>
          <h1 className="font-serif text-4xl leading-none tracking-[-0.045em] sm:text-5xl">
            Gerenciar catálogo
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted sm:text-base">
            Atualize o carrossel da página inicial e adicione produtos diretamente
            ao catálogo da USE MDR.
          </p>
        </div>

        <AdminProductForm />
      </main>
    </div>
  );
}
