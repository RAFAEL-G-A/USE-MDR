import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { catalogTaxonomy } from "../_shared/catalog-taxonomy.ts";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fileExtension(file: File) {
  const byMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byMimeType[file.type];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    assertInventoryAccess(context);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(request, { error: "Envie os dados no formato multipart/form-data." }, 415);
    }

    const formData = await request.formData();
    const name = readText(formData, "name");
    const category = readText(formData, "category");
    const subcategory = readText(formData, "subcategory");
    const description = readText(formData, "description");
    const price = Number(readText(formData, "price"));
    const costPrice = Number(readText(formData, "cost_price") || "0");
    const stock = Number(readText(formData, "stock"));
    const isLaunch = readText(formData, "is_launch") === "true";
    const image = formData.get("image");

    if (!name || name.length > 120) {
      return json(request, { error: "Informe um nome com até 120 caracteres." }, 400);
    }
    if (!Number.isFinite(price) || price <= 0) {
      return json(request, { error: "Informe um preço válido." }, 400);
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      return json(request, { error: "Informe um preço de custo válido." }, 400);
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return json(request, { error: "Informe um estoque inteiro igual ou maior que zero." }, 400);
    }
    if (!catalogTaxonomy[category]?.includes(subcategory)) {
      return json(request, { error: "A categoria ou subcategoria não é válida." }, 400);
    }
    if (description.length > 1000) {
      return json(request, { error: "A descrição deve ter até 1000 caracteres." }, 400);
    }
    if (!(image instanceof File) || !ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
      return json(request, { error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, 400);
    }

    const imagePath = `catalog/${crypto.randomUUID()}.${fileExtension(image)}`;
    const { error: uploadError } = await context.adminClient.storage
      .from("products")
      .upload(imagePath, image, {
        cacheControl: "31536000",
        contentType: image.type,
        upsert: false,
      });
    if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);

    const { data: publicImage } = context.adminClient.storage
      .from("products")
      .getPublicUrl(imagePath);
    const { data: product, error: insertError } = await context.adminClient
      .from("products")
      .insert({
        name,
        price,
        category,
        subcategory,
        image_url: publicImage.publicUrl,
        description: description || null,
        stock,
        is_launch: isLaunch,
      })
      .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
      .single();

    if (insertError) {
      await context.adminClient.storage.from("products").remove([imagePath]);
      throw new Error(`Não foi possível salvar o produto: ${insertError.message}`);
    }

    const { error: costError } = await context.adminClient
      .from("product_costs")
      .upsert({
        product_id: String(product.id),
        cost_price: costPrice,
        updated_by: context.user.id,
        updated_at: new Date().toISOString(),
      });

    if (costError) {
      await context.adminClient.from("products").delete().eq("id", product.id);
      await context.adminClient.storage.from("products").remove([imagePath]);
      throw new Error(`Não foi possível salvar o preço de custo: ${costError.message}`);
    }

    return json(request, { ok: true, product: { ...product, cost_price: costPrice } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cadastrar o produto.";
    return json(request, { error: message }, 401);
  }
});
