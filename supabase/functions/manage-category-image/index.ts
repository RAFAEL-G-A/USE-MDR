import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CATEGORY_KEYS = new Set(["labios", "olhos", "pele", "skincare", "pinceis", "kits", "acessorios"]);

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
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    await assertInventoryAccess(context);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(request, { error: "Envie os dados no formato multipart/form-data." }, 415);
    }

    const formData = await request.formData();
    const action = readText(formData, "action") || "save";
    const categoryKey = readText(formData, "category_key");
    if (!CATEGORY_KEYS.has(categoryKey)) return json(request, { error: "Categoria inválida." }, 400);

    const { data: existing, error: readError } = await context.adminClient
      .from("category_images")
      .select("category_key, image_url, image_path")
      .eq("category_key", categoryKey)
      .maybeSingle();
    if (readError) throw new Error(`Não foi possível carregar a imagem da categoria: ${readError.message}`);

    if (action === "reset") {
      const { error: deleteError } = await context.adminClient
        .from("category_images")
        .delete()
        .eq("category_key", categoryKey);
      if (deleteError) throw new Error(`Não foi possível restaurar a imagem padrão: ${deleteError.message}`);
      if (existing?.image_path) await context.adminClient.storage.from("products").remove([existing.image_path]);
      return json(request, { ok: true, category_key: categoryKey, reset: true });
    }

    if (action !== "save") return json(request, { error: "Ação inválida." }, 400);
    const image = formData.get("image");
    if (!(image instanceof File) || !ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
      return json(request, { error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, 400);
    }

    const uploadedPath = `categories/${categoryKey}/${crypto.randomUUID()}.${fileExtension(image)}`;
    const { error: uploadError } = await context.adminClient.storage.from("products").upload(uploadedPath, image, {
      cacheControl: "31536000",
      contentType: image.type,
      upsert: false,
    });
    if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);

    const imageUrl = context.adminClient.storage.from("products").getPublicUrl(uploadedPath).data.publicUrl;
    const { data: category, error: upsertError } = await context.adminClient
      .from("category_images")
      .upsert({ category_key: categoryKey, image_url: imageUrl, image_path: uploadedPath, updated_at: new Date().toISOString() }, { onConflict: "category_key" })
      .select("category_key, image_url")
      .single();

    if (upsertError) {
      await context.adminClient.storage.from("products").remove([uploadedPath]);
      throw new Error(`Não foi possível salvar a imagem da categoria: ${upsertError.message}`);
    }
    if (existing?.image_path && existing.image_path !== uploadedPath) {
      await context.adminClient.storage.from("products").remove([existing.image_path]);
    }

    return json(request, { ok: true, category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a imagem da categoria.";
    return json(request, { error: message }, 401);
  }
});
