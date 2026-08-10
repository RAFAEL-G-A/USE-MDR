import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoProducts } from "@/lib/demo-products";

type ProductRow = {
  id: string | number;
  name: string;
  price: number | string;
  category: string;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  stock: number;
  is_launch: boolean;
  created_at: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  subcategory: string | null;
  imageUrl: string;
  description: string | null;
  stock: number;
};

function parseProductPrice(value: number | string) {
  if (typeof value === "number") return value;
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  return Number(normalized);
}

export async function getLatestProducts(limit = 4): Promise<CatalogProduct[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ProductRow[]>();

  if (error) {
    console.warn("Não foi possível carregar os produtos do Supabase; usando o catálogo demonstrativo:", error.message);
    return [];
  }

  return data
    .filter((product) => product.image_url)
    .map((product) => ({
      id: String(product.id),
      name: product.name,
      price: parseProductPrice(product.price),
      category: product.category,
      subcategory: product.subcategory,
      imageUrl: product.image_url as string,
      description: product.description,
      stock: product.stock,
    }))
    .filter((product) => Number.isFinite(product.price));
}

export async function getLaunchProducts(limit = 6): Promise<CatalogProduct[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
    .eq("is_launch", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<ProductRow[]>();

  if (error) {
    console.warn("Não foi possível carregar os lançamentos do Supabase:", error.message);
    return [];
  }

  return data
    .filter((product) => product.image_url)
    .map((product) => ({
      id: String(product.id),
      name: product.name,
      price: parseProductPrice(product.price),
      category: product.category,
      subcategory: product.subcategory,
      imageUrl: product.image_url as string,
      description: product.description,
      stock: product.stock,
    }))
    .filter((product) => Number.isFinite(product.price));
}

export async function getProductById(id: string): Promise<CatalogProduct | null> {
  const demoProduct = demoProducts.find((product) => product.id === id);
  if (demoProduct) {
    return {
      id: demoProduct.id,
      name: demoProduct.name,
      price: demoProduct.price,
      category: demoProduct.category,
      subcategory: demoProduct.subcategory ?? null,
      imageUrl: typeof demoProduct.image === "string" ? demoProduct.image : demoProduct.image.src,
      description: demoProduct.description,
      stock: demoProduct.stock,
    };
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
    .eq("id", id)
    .limit(1)
    .returns<ProductRow[]>();

  if (error || !data[0] || !data[0].image_url) return null;
  const product = data[0];
  const price = parseProductPrice(product.price);
  if (!Number.isFinite(price)) return null;

  return {
    id: String(product.id),
    name: product.name,
    price,
    category: product.category,
    subcategory: product.subcategory,
    imageUrl: product.image_url as string,
    description: product.description,
    stock: product.stock,
  };
}
