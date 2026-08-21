import { getCatalogConfiguration, type CategoryVisual } from "@/lib/catalog-configuration";

export type { CategoryVisual } from "@/lib/catalog-configuration";

export async function getCategoryVisuals(): Promise<CategoryVisual[]> {
  return (await getCatalogConfiguration()).categories;
}
