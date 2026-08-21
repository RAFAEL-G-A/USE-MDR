import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.2";
import { catalogTaxonomy } from "./catalog-taxonomy.ts";

export async function isValidCatalogSelection(
  adminClient: SupabaseClient,
  category: string,
  subcategory: string,
) {
  const { data: categoryRow, error: categoryError } = await adminClient
    .from("catalog_categories")
    .select("category_key")
    .eq("name", category)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    // Mantém o cadastro funcional durante a implantação da migration.
    return Boolean(catalogTaxonomy[category]?.includes(subcategory));
  }
  if (!categoryRow) return false;

  const { data: subcategoryRow, error: subcategoryError } = await adminClient
    .from("catalog_subcategories")
    .select("id")
    .eq("category_key", categoryRow.category_key)
    .eq("name", subcategory)
    .maybeSingle();

  if (subcategoryError) throw subcategoryError;
  return Boolean(subcategoryRow);
}
