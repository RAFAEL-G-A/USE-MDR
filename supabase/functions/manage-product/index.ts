import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { catalogTaxonomy } from "../_shared/catalog-taxonomy.ts";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 3;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function readStringArray(formData: FormData, name: string) {
  const raw = readText(formData, name);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
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
    await assertInventoryAccess(context);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      if (String(body.action ?? "") !== "list") {
        return json(request, { error: "Ação inválida." }, 400);
      }

      const [
        { data: products, error: productsError },
        { data: costs, error: costsError },
        { data: productImages, error: imagesError },
      ] = await Promise.all([
        context.adminClient
          .from("products")
          .select("id, name, price, category, subcategory, image_url, description, stock, is_launch, created_at")
          .order("created_at", { ascending: false }),
        context.adminClient.from("product_costs").select("product_id, cost_price"),
        context.adminClient
          .from("product_images")
          .select("id, product_id, image_url, storage_path, sort_order")
          .order("sort_order", { ascending: true }),
      ]);
      if (productsError || costsError || imagesError) {
        throw new Error(`Não foi possível carregar o estoque: ${productsError?.message ?? costsError?.message ?? imagesError?.message}`);
      }
      const costsByProduct = new Map((costs ?? []).map((item) => [String(item.product_id), Number(item.cost_price)]));
      const imagesByProduct = new Map<string, Array<Record<string, unknown>>>();
      for (const image of productImages ?? []) {
        const productImagesList = imagesByProduct.get(String(image.product_id)) ?? [];
        productImagesList.push(image);
        imagesByProduct.set(String(image.product_id), productImagesList);
      }
      return json(request, {
        ok: true,
        products: (products ?? []).map((product) => ({
          ...product,
          cost_price: costsByProduct.get(String(product.id)) ?? 0,
          images: imagesByProduct.get(String(product.id)) ?? [],
        })),
      });
    }

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
    const { data: existingGallery, error: galleryReadError } = await context.adminClient
      .from("product_images")
      .select("id, image_url, storage_path, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    if (galleryReadError) throw new Error(`Não foi possível carregar a galeria: ${galleryReadError.message}`);

    if (action === "delete") {
      const { error: deleteError } = await context.adminClient.from("products").delete().eq("id", productId);
      if (deleteError) throw new Error(`Não foi possível excluir o produto: ${deleteError.message}`);
      await context.adminClient.from("product_images").delete().eq("product_id", productId);
      await context.adminClient.from("product_costs").delete().eq("product_id", productId);
      const pathsToDelete = [oldImagePath, ...(existingGallery ?? []).map((item) => item.storage_path)].filter((path): path is string => Boolean(path));
      if (pathsToDelete.length) await context.adminClient.storage.from("products").remove(pathsToDelete);
      return json(request, { ok: true, id: productId, deleted: true });
    }

    if (action === "replace_image") {
      const replacementImage = formData.get("image");
      if (!(replacementImage instanceof File) || !ACCEPTED_IMAGE_TYPES.has(replacementImage.type) || replacementImage.size > MAX_IMAGE_SIZE) {
        return json(request, { error: "Envie uma imagem WebP válida de até 5 MB." }, 400);
      }
      const replacementPath = `catalog/${crypto.randomUUID()}.${fileExtension(replacementImage)}`;
      const { error: replacementUploadError } = await context.adminClient.storage.from("products").upload(replacementPath, replacementImage, {
        cacheControl: "31536000",
        contentType: replacementImage.type,
        upsert: false,
      });
      if (replacementUploadError) throw new Error(`Não foi possível enviar a imagem: ${replacementUploadError.message}`);
      const replacementUrl = context.adminClient.storage.from("products").getPublicUrl(replacementPath).data.publicUrl;
      const { error: replacementUpdateError } = await context.adminClient.from("products").update({ image_url: replacementUrl }).eq("id", productId);
      if (replacementUpdateError) {
        await context.adminClient.storage.from("products").remove([replacementPath]);
        throw new Error(`Não foi possível atualizar a imagem: ${replacementUpdateError.message}`);
      }
      if (oldImagePath && oldImagePath !== replacementPath) {
        await context.adminClient.storage.from("products").remove([oldImagePath]);
      }
      return json(request, { ok: true, id: productId, image_url: replacementUrl });
    }

    if (action !== "update") return json(request, { error: "Ação inválida." }, 400);

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
    const requestedRemovalIds = new Set(readStringArray(formData, "remove_image_ids"));
    const galleryToRemove = (existingGallery ?? []).filter((item) => requestedRemovalIds.has(String(item.id)));
    const retainedGallery = (existingGallery ?? []).filter((item) => !requestedRemovalIds.has(String(item.id)));

    if (!name || name.length > 120) return json(request, { error: "Informe um nome com até 120 caracteres." }, 400);
    if (!Number.isFinite(price) || price <= 0) return json(request, { error: "Informe um preço válido." }, 400);
    if (!Number.isFinite(costPrice) || costPrice < 0) return json(request, { error: "Informe um preço de custo válido." }, 400);
    if (!Number.isInteger(stock) || stock < 0) return json(request, { error: "Informe um estoque válido." }, 400);
    if (!catalogTaxonomy[category]?.includes(subcategory)) return json(request, { error: "Categoria ou subcategoria inválida." }, 400);
    if (description.length > 1000) return json(request, { error: "A descrição deve ter até 1000 caracteres." }, 400);
    if (galleryImages.length + retainedGallery.length > MAX_GALLERY_IMAGES) {
      return json(request, { error: `O produto pode ter no máximo ${MAX_GALLERY_IMAGES} imagens complementares.` }, 400);
    }
    if (galleryImages.some((item) => !ACCEPTED_IMAGE_TYPES.has(item.type) || item.size > MAX_IMAGE_SIZE)) {
      return json(request, { error: "Cada imagem complementar deve ser JPG, PNG ou WebP e ter até 5 MB." }, 400);
    }

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

    if (galleryToRemove.length) {
      const removalIds = galleryToRemove.map((item) => item.id);
      const { error: galleryDeleteError } = await context.adminClient
        .from("product_images")
        .delete()
        .eq("product_id", productId)
        .in("id", removalIds);
      if (galleryDeleteError) throw new Error(`Não foi possível remover imagens da galeria: ${galleryDeleteError.message}`);
      const removalPaths = galleryToRemove.map((item) => item.storage_path).filter((path): path is string => Boolean(path));
      if (removalPaths.length) await context.adminClient.storage.from("products").remove(removalPaths);
    }

    const usedSortOrders = new Set(retainedGallery.map((item) => Number(item.sort_order)));
    const availableSortOrders = [1, 2, 3].filter((order) => !usedSortOrders.has(order));
    const newGalleryUploads: Array<{ path: string; publicUrl: string; sortOrder: number }> = [];
    for (let index = 0; index < galleryImages.length; index += 1) {
      const galleryImage = galleryImages[index];
      const galleryPath = `catalog/${crypto.randomUUID()}.${fileExtension(galleryImage)}`;
      const { error: galleryUploadError } = await context.adminClient.storage.from("products").upload(galleryPath, galleryImage, {
        cacheControl: "31536000",
        contentType: galleryImage.type,
        upsert: false,
      });
      if (galleryUploadError) {
        if (newGalleryUploads.length) {
          await context.adminClient.storage.from("products").remove(newGalleryUploads.map((item) => item.path));
        }
        throw new Error(`Não foi possível enviar uma imagem da galeria: ${galleryUploadError.message}`);
      }
      newGalleryUploads.push({
        path: galleryPath,
        publicUrl: context.adminClient.storage.from("products").getPublicUrl(galleryPath).data.publicUrl,
        sortOrder: availableSortOrders[index],
      });
    }
    if (newGalleryUploads.length) {
      const { error: galleryInsertError } = await context.adminClient.from("product_images").insert(
        newGalleryUploads.map((item) => ({
          product_id: productId,
          image_url: item.publicUrl,
          storage_path: item.path,
          sort_order: item.sortOrder,
        })),
      );
      if (galleryInsertError) {
        await context.adminClient.storage.from("products").remove(newGalleryUploads.map((item) => item.path));
        throw new Error(`Não foi possível salvar a galeria: ${galleryInsertError.message}`);
      }
    }

    const { error: costError } = await context.adminClient
      .from("product_costs")
      .upsert({
        product_id: productId,
        cost_price: costPrice,
        updated_by: context.user.id,
        updated_at: new Date().toISOString(),
      });
    if (costError) throw new Error(`Produto atualizado, mas o custo não pôde ser salvo: ${costError.message}`);

    const { data: updatedGallery } = await context.adminClient
      .from("product_images")
      .select("id, image_url, storage_path, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });

    return json(request, { ok: true, product: { ...product, cost_price: costPrice, images: updatedGallery ?? [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível alterar o produto.";
    return json(request, { error: message }, 401);
  }
});
