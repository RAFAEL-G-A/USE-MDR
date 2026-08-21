import type { StaticImageData } from "next/image";
import { categoryDefinitions } from "@/lib/category-definitions";
import { catalogTaxonomy } from "@/lib/catalog-taxonomy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SubcategoryRow = { name: string; sort_order: number };
type CategoryRow = {
  category_key: string;
  name: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  catalog_subcategories: SubcategoryRow[] | null;
};

export type CategoryVisual = {
  key: string;
  name: string;
  description: string;
  image: StaticImageData | string;
  filterCategory: string;
};

export type CatalogConfiguration = {
  categories: CategoryVisual[];
  taxonomy: Record<string, readonly string[]>;
};

function fallbackConfiguration(): CatalogConfiguration {
  return {
    categories: categoryDefinitions,
    taxonomy: catalogTaxonomy,
  };
}
export async function getCatalogConfiguration(): Promise<CatalogConfiguration> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return fallbackConfiguration();

  const { data, error } = await supabase
    .from("catalog_categories")
    .select("category_key, name, description, image_url, sort_order, catalog_subcategories(name, sort_order)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("sort_order", { referencedTable: "catalog_subcategories", ascending: true });

  if (error || !data?.length) {
    const fallback = fallbackConfiguration();
    const { data: legacyImages } = await supabase.from("category_images").select("category_key, image_url");
    const overrides = new Map((legacyImages ?? []).map((item) => [String(item.category_key), String(item.image_url)]));
    return {
      ...fallback,
      categories: fallback.categories.map((category) => ({
        ...category,
        image: overrides.get(category.key) ?? category.image,
      })),
    };
  }

  const defaults = new Map(categoryDefinitions.map((category) => [category.key, category]));
  const rows = data as CategoryRow[];
  return {
    categories: rows.flatMap((row) => {
      const fallback = defaults.get(row.category_key);
      const image = row.image_url || fallback?.image;
      if (!image) return [];
      return [{
        key: row.category_key,
        name: row.name,
        description: row.description,
        image,
        filterCategory: row.name,
      }];
    }),
    taxonomy: Object.fromEntries(rows.map((row) => [
      row.name,
      [...(row.catalog_subcategories ?? [])]
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((subcategory) => subcategory.name),
    ])),
  };
}
