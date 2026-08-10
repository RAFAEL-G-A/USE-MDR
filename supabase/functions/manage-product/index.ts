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

function storagePathFromUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  const marker = "/storage/v1/object/public/products/";
  const markerIndex = imageUrl.indexOf(marker);
  if (markerIndex < 0) return null;
  const encodedPath = imageUrl.slice(markerIndex + marker.length).split("?")[0];
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    assertInventoryAccess(context);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(request, { error: "Envie os dados no formato multipart/form-data." }, 415);
    }

    const formData = await request.formData();
    const action = readText(formData, "action");
    const productId = readText(formData, "id");
    if (!productId) return json(request, { error: "Produto não informado." }, 400);

    const { data: existing, error: readError } = await context.adminClient
      .from("products")
      .select("id, image_url")
      .eq("id", productId)
      .maybeSingle();
    if (readError || !existing) return json(request, { error: "Produto não encontrado." }, 404);

    const oldImagePath = storagePathFromUrl(existing.image_url);

    if (action === "delete") {
      const { error: deleteError } = await context.adminClient.from("products").delete().eq("id", productId);
      if (deleteError) throw new Error(`Não foi possível excluir o produto: ${deleteError.message}`);
      if (oldImagePath) await context.adminClient.storage.from("products").remove([oldImagePath]);
      return json(request, { ok: true, id: productId, deleted: true });
    }

    if (action !== "update") return json(request, { error: "Ação inválida." }, 400);

    const name = readText(formData, "name");
    const category = readText(formData, "category");
    const subcategory = readText(formData, "subcategory");
    const description = readText(formData, "description");
    const price = Number(readText(formData, "price"));
    const stock = Number(readText(formData, "stock"));
    const isLaunch = readText(formData, "is_launch") === "true";
    const image = formData.get("image");

    if (!name || name.length > 120) return json(request, { error: "Informe um nome com até 120 caracteres." }, 400);
    if (!Number.isFinite(price) || price <= 0) return json(request, { error: "Informe um preço válido." }, 400);
    if (!Number.isInteger(stock) || stock < 0) return json(request, { error: "Informe um estoque válido." }, 400);
    if (!catalogTaxonomy[category]?.includes(subcategory)) return json(request, { error: "Categoria ou subcategoria inválida." }, 400);
    if (description.length > 1000) return json(request, { error: "A descrição deve ter até 1000 caracteres." }, 400);

    let imageUrl = existing.image_url;
    let newImagePath: string | null = null;
    if (image instanceof File && image.size > 0) {
      if (!ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
        return json(request, { error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, 400);
      }
      newImagePath = `catalog/${crypto.randomUUID()}.${fileExtension(image)}`;
      const { error: uploadError } = await context.adminClient.storage.from("products").upload(newImagePath, image, {
        cacheControl: "31536000",
        contentType: image.type,
        upsert: false,
      });
      if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);
      imageUrl = context.adminClient.storage.from("products").getPublicUrl(newImagePath).data.publicUrl;
    }

    const { data: product, error: updateError } = await context.adminClient
      .from("products")
      .update({ name, price, category, subcategory, description: description || null, stock, is_launch: isLaunch, image_url: imageUrl })
      .eq("id", productId)
      .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
      .single();

    if (updateError) {
      if (newImagePath) await context.adminClient.storage.from("products").remove([newImagePath]);
      throw new Error(`Não foi possível atualizar o produto: ${updateError.message}`);
    }
    if (newImagePath && oldImagePath && oldImagePath !== newImagePath) {
      await context.adminClient.storage.from("products").remove([oldImagePath]);
    }

    return json(request, { ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível alterar o produto.";
    return json(request, { error: message }, 401);
  }
});
