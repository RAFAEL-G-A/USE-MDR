"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard, type ProductCardItem } from "@/components/product-card";
import { catalogPageCount, PRODUCTS_PER_PAGE, validCatalogPage, visibleCatalogPages } from "@/lib/catalog-pagination";

type CatalogProductPaginationProps = {
  initialPage: number;
  products: ProductCardItem[];
};

export function CatalogProductPagination({ initialPage, products }: CatalogProductPaginationProps) {
  const totalPages = catalogPageCount(products.length);
  const [currentPage, setCurrentPage] = useState(() => Math.min(Math.max(initialPage, 1), totalPages));
  const pageOptions = useMemo(() => visibleCatalogPages(currentPage, totalPages), [currentPage, totalPages]);
  const firstProductIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const visibleProducts = products.slice(firstProductIndex, firstProductIndex + PRODUCTS_PER_PAGE);
  const firstVisibleNumber = products.length ? firstProductIndex + 1 : 0;
  const lastVisibleNumber = Math.min(firstProductIndex + PRODUCTS_PER_PAGE, products.length);

  useEffect(() => {
    const syncPageFromHistory = () => {
      const page = validCatalogPage(new URL(window.location.href).searchParams.get("pagina"), totalPages);
      setCurrentPage(page);
    };

    window.addEventListener("popstate", syncPageFromHistory);
    return () => window.removeEventListener("popstate", syncPageFromHistory);
  }, [totalPages]);

  function changePage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage === currentPage) return;

    const url = new URL(window.location.href);
    if (nextPage === 1) url.searchParams.delete("pagina");
    else url.searchParams.set("pagina", String(nextPage));
    url.hash = "produtos";
    window.history.pushState(null, "", url);
    setCurrentPage(nextPage);
    document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <p className="mb-5 text-xs font-semibold text-muted" aria-live="polite">
        Exibindo {firstVisibleNumber}–{lastVisibleNumber} de {products.length} produtos
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
        {visibleProducts.map((product, index) => (
          <ProductCard key={product.id} product={product} eager={index < 4} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-12 rounded-[1.75rem] border border-brand-border bg-white px-3 py-4 shadow-sm sm:px-5" aria-label="Paginação do catálogo">
          <p className="mb-4 text-center text-xs font-bold text-muted">
            Página <span className="text-brand">{currentPage}</span> de {totalPages}
          </p>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} className="min-h-10 rounded-full border border-brand-border px-3 text-[0.65rem] font-extrabold text-brand disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:text-xs">
              ← Anterior
            </button>

            <label className="sm:hidden">
              <span className="sr-only">Selecionar página</span>
              <select value={currentPage} onChange={(event) => changePage(Number(event.target.value))} className="min-h-10 rounded-full border border-brand-border bg-background px-3 text-xs font-extrabold text-brand">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <option key={page} value={page}>Página {page}</option>)}
              </select>
            </label>

            <div className="hidden items-center gap-1 sm:flex" aria-label="Páginas disponíveis">
              {pageOptions.map((page, index) => page === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="flex size-9 items-center justify-center text-xs text-muted" aria-hidden="true">…</span>
              ) : (
                <button key={page} type="button" onClick={() => changePage(page)} aria-label={`Ir para a página ${page}`} aria-current={page === currentPage ? "page" : undefined} className={`flex size-10 items-center justify-center rounded-full text-xs font-extrabold transition-colors ${page === currentPage ? "bg-brand text-white shadow-md shadow-brand/20" : "border border-brand-border bg-background text-brand hover:bg-brand-soft"}`}>
                  {page}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages} className="min-h-10 rounded-full border border-brand-border px-3 text-[0.65rem] font-extrabold text-brand disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:text-xs">
              Próxima →
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
