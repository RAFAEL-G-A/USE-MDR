import type { StaticImageData } from "next/image";
import { categoryDefinitions } from "@/lib/category-definitions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CategoryImageRow = {
  category_key: string;
  image_url: string;
};

export type CategoryVisual = {
  key: string;
  name: string;
  description: string;
  image: StaticImageData | string;
  filterCategory: string;
  filterSubcategory?: string;
};

export async function getCategoryVisuals(): Promise<CategoryVisual[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return categoryDefinitions;

  const { data, error } = await supabase
    .from("category_images")
    .select("category_key, image_url")
    .returns<CategoryImageRow[]>();

  if (error) {
    console.warn("Não foi possível carregar as imagens personalizadas das categorias:", error.message);
    return categoryDefinitions;
  }

  const overrides = new Map(data.map((item) => [item.category_key, item.image_url]));
  return categoryDefinitions.map((category) => ({
    ...category,
    image: overrides.get(category.key) ?? category.image,
  }));
}
