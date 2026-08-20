export const PRODUCTS_PER_PAGE = 15;

export function catalogPageCount(productCount: number) {
  return Math.max(1, Math.ceil(productCount / PRODUCTS_PER_PAGE));
}

export function validCatalogPage(value: string | null, totalPages: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, totalPages);
}

export function visibleCatalogPages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const orderedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  orderedPages.forEach((page, index) => {
    const previousPage = orderedPages[index - 1];
    if (previousPage && page - previousPage > 1) result.push("ellipsis");
    result.push(page);
  });

  return result;
}
