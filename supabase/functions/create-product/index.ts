import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { isValidCatalogSelection } from "../_shared/catalog-validation.ts";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 3;
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
    await assertInventoryAccess(context);

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
    const galleryImages = formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);

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
    if (!(await isValidCatalogSelection(context.adminClient, category, subcategory))) {
      return json(request, { error: "A categoria ou subcategoria não é válida." }, 400);
    }
    if (description.length > 1000) {
      return json(request, { error: "A descrição deve ter até 1000 caracteres." }, 400);
    }
    if (!(image instanceof File) || !ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
      return json(request, { error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, 400);
    }
    if (galleryImages.length > MAX_GALLERY_IMAGES) {
      return json(request, { error: `Adicione no máximo ${MAX_GALLERY_IMAGES} imagens complementares.` }, 400);
    }
    if (galleryImages.some((item) => !ACCEPTED_IMAGE_TYPES.has(item.type) || item.size > MAX_IMAGE_SIZE)) {
      return json(request, { error: "Cada imagem complementar deve ser JPG, PNG ou WebP e ter até 5 MB." }, 400);
    }

    const uploadedImages: Array<{ path: string; publicUrl: string }> = [];
    for (const file of [image, ...galleryImages]) {
      const path = `catalog/${crypto.randomUUID()}.${fileExtension(file)}`;
      const { error: uploadError } = await context.adminClient.storage
        .from("products")
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) {
        if (uploadedImages.length) {
          await context.adminClient.storage.from("products").remove(uploadedImages.map((item) => item.path));
        }
        throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);
      }
      uploadedImages.push({
        path,
        publicUrl: context.adminClient.storage.from("products").getPublicUrl(path).data.publicUrl,
      });
    }

    const { data: product, error: insertError } = await context.adminClient
      .from("products")
      .insert({
        name,
        price,
        category,
        subcategory,
        image_url: uploadedImages[0].publicUrl,
        description: description || null,
        stock,
        is_launch: isLaunch,
      })
      .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
      .single();

    if (insertError) {
      await context.adminClient.storage.from("products").remove(uploadedImages.map((item) => item.path));
      throw new Error(`Não foi possível salvar o produto: ${insertError.message}`);
    }

    const galleryRows = uploadedImages.slice(1).map((item, index) => ({
      product_id: String(product.id),
      image_url: item.publicUrl,
      storage_path: item.path,
      sort_order: index + 1,
    }));
    if (galleryRows.length) {
      const { error: galleryError } = await context.adminClient.from("product_images").insert(galleryRows);
      if (galleryError) {
        await context.adminClient.from("products").delete().eq("id", product.id);
        await context.adminClient.storage.from("products").remove(uploadedImages.map((item) => item.path));
        throw new Error(`Não foi possível salvar a galeria: ${galleryError.message}`);
      }
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
      await context.adminClient.from("product_images").delete().eq("product_id", String(product.id));
      await context.adminClient.from("products").delete().eq("id", product.id);
      await context.adminClient.storage.from("products").remove(uploadedImages.map((item) => item.path));
      throw new Error(`Não foi possível salvar o preço de custo: ${costError.message}`);
    }

    return json(request, { ok: true, product: { ...product, cost_price: costPrice, images: galleryRows } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cadastrar o produto.";
    return json(request, { error: message }, 401);
  }
});
