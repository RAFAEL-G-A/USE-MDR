import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";

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
  if (request.method !== "POST") {
    return json(request, { error: "Método não permitido." }, 405);
  }

  try {
    const context = await authenticateAdmin(request);
    await assertInventoryAccess(context);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(request, { error: "Envie os dados no formato multipart/form-data." }, 415);
    }

    const formData = await request.formData();
    const action = readText(formData, "action") || "save";
    const slot = Number(readText(formData, "slot"));

    if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
      return json(request, { error: "Escolha uma posição de 1 a 4." }, 400);
    }

    const { data: existing, error: readError } = await context.adminClient
      .from("hero_slides")
      .select("slot, image_url, image_path, eyebrow, title, description, fade_enabled")
      .eq("slot", slot)
      .maybeSingle();
    if (readError) throw new Error(`Não foi possível carregar o destaque: ${readError.message}`);

    if (action === "remove") {
      const { error: deleteError } = await context.adminClient
        .from("hero_slides")
        .delete()
        .eq("slot", slot);
      if (deleteError) throw new Error(`Não foi possível remover o destaque: ${deleteError.message}`);
      if (existing?.image_path) {
        await context.adminClient.storage.from("products").remove([existing.image_path]);
      }
      return json(request, { ok: true, slot, removed: true });
    }

    if (action !== "save") {
      return json(request, { error: "Ação inválida." }, 400);
    }

    const eyebrow = readText(formData, "eyebrow");
    const title = readText(formData, "title");
    const description = readText(formData, "description");
    const fadeEnabled = readText(formData, "fade_enabled") !== "false";
    const image = formData.get("image");

    if (eyebrow.length > 60 || title.length > 120 || description.length > 300) {
      return json(request, { error: "Um dos textos ultrapassou o limite permitido." }, 400);
    }

    let imagePath = existing?.image_path ?? null;
    let imageUrl = existing?.image_url ?? null;
    let uploadedImagePath: string | null = null;

    if (image instanceof File && image.size > 0) {
      if (!ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
        return json(request, { error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, 400);
      }
      uploadedImagePath = `hero/${crypto.randomUUID()}.${fileExtension(image)}`;
      const { error: uploadError } = await context.adminClient.storage
        .from("products")
        .upload(uploadedImagePath, image, {
          cacheControl: "31536000",
          contentType: image.type,
          upsert: false,
        });
      if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);

      imagePath = uploadedImagePath;
      imageUrl = context.adminClient.storage.from("products").getPublicUrl(imagePath).data.publicUrl;
    }

    if (!imagePath || !imageUrl) {
      return json(request, { error: "Selecione uma imagem para ativar este destaque." }, 400);
    }

    const { data: slide, error: upsertError } = await context.adminClient
      .from("hero_slides")
      .upsert({
        slot,
        image_url: imageUrl,
        image_path: imagePath,
        eyebrow,
        title,
        description,
        fade_enabled: fadeEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: "slot" })
      .select("slot, image_url, eyebrow, title, description, fade_enabled")
      .single();

    if (upsertError) {
      if (uploadedImagePath) {
        await context.adminClient.storage.from("products").remove([uploadedImagePath]);
      }
      throw new Error(`Não foi possível salvar o destaque: ${upsertError.message}`);
    }

    if (uploadedImagePath && existing?.image_path && existing.image_path !== uploadedImagePath) {
      await context.adminClient.storage.from("products").remove([existing.image_path]);
    }

    return json(request, { ok: true, slide });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o destaque.";
    return json(request, { error: message }, 401);
  }
});
