import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.2";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function logChange(
  adminClient: SupabaseClient,
  adminUserId: string,
  action: string,
  key: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await adminClient.from("catalog_change_log").insert({
    admin_user_id: adminUserId,
    action,
    category_key: key,
    details,
  });
  if (error) console.error("Não foi possível registrar o histórico de categorias:", error.message);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function categoryKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function fileExtension(file: File) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
}

function validImage(image: FormDataEntryValue | null): image is File {
  return image instanceof File && ACCEPTED_IMAGE_TYPES.has(image.type) && image.size > 0 && image.size <= MAX_IMAGE_SIZE;
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
      const action = text(body.action);

      if (action === "list") {
        const [categoriesResult, productsResult, historyResult] = await Promise.all([
          context.adminClient
            .from("catalog_categories")
            .select("category_key, name, description, image_url, sort_order, is_active, catalog_subcategories(name, sort_order)")
            .order("sort_order", { ascending: true })
            .order("sort_order", { referencedTable: "catalog_subcategories", ascending: true }),
          context.adminClient.from("products").select("category, subcategory"),
          context.adminClient
            .from("catalog_change_log")
            .select("id, action, category_key, details, created_at")
            .order("created_at", { ascending: false })
            .limit(30),
        ]);
        const loadError = categoriesResult.error ?? productsResult.error ?? historyResult.error;
        if (loadError) throw new Error(`Não foi possível carregar as categorias: ${loadError.message}`);
        return json(request, {
          ok: true,
          categories: categoriesResult.data ?? [],
          products: productsResult.data ?? [],
          history: historyResult.data ?? [],
        });
      }

      const key = text(body.category_key);
      if (!key) return json(request, { error: "Categoria não informada." }, 400);

      const { data: category, error: categoryError } = await context.adminClient
        .from("catalog_categories")
        .select("category_key, name, is_active")
        .eq("category_key", key)
        .maybeSingle();
      if (categoryError) throw new Error(`Não foi possível localizar a categoria: ${categoryError.message}`);
      if (!category) return json(request, { error: "Categoria não encontrada." }, 404);

      if (action === "toggle_category") {
        const isActive = body.is_active === true;
        const { error } = await context.adminClient
          .from("catalog_categories")
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq("category_key", key);
        if (error) throw new Error(`Não foi possível alterar a visibilidade: ${error.message}`);
        await logChange(context.adminClient, context.user.id, isActive ? "activate_category" : "hide_category", key);
        return json(request, { ok: true, is_active: isActive });
      }

      if (action === "reorder_categories") {
        const keys = Array.isArray(body.category_keys) ? body.category_keys.map(text) : [];
        const { error } = await context.adminClient.rpc("reorder_catalog_categories", {
          p_category_keys: keys,
          p_admin_user_id: context.user.id,
        });
        if (error) throw new Error(`Não foi possível salvar a ordem: ${error.message}`);
        return json(request, { ok: true });
      }

      if (action === "reorder_subcategories") {
        const names = Array.isArray(body.subcategories) ? body.subcategories.map(text) : [];
        const { error } = await context.adminClient.rpc("reorder_catalog_subcategories", {
          p_category_key: key,
          p_subcategories: names,
          p_admin_user_id: context.user.id,
        });
        if (error) throw new Error(`Não foi possível salvar a ordem: ${error.message}`);
        return json(request, { ok: true });
      }

      if (action === "rename_category") {
        const newName = text(body.new_name);
        if (!newName || newName.length > 40) return json(request, { error: "Informe um nome com até 40 caracteres." }, 400);
        const { data: affectedProducts, error } = await context.adminClient.rpc("rename_catalog_category", {
          p_category_key: key,
          p_new_name: newName,
          p_admin_user_id: context.user.id,
        });
        if (error) throw new Error(`Não foi possível renomear a categoria: ${error.message}`);
        return json(request, { ok: true, affected_products: affectedProducts });
      }

      const subcategory = text(body.subcategory);
      if (!subcategory || subcategory.length > 60) return json(request, { error: "Informe uma subcategoria com até 60 caracteres." }, 400);

      if (action === "rename_subcategory") {
        const newName = text(body.new_name);
        if (!newName || newName.length > 60) return json(request, { error: "Informe o novo nome com até 60 caracteres." }, 400);
        const { data: affectedProducts, error } = await context.adminClient.rpc("rename_catalog_subcategory", {
          p_category_key: key,
          p_previous_name: subcategory,
          p_new_name: newName,
          p_admin_user_id: context.user.id,
        });
        if (error) throw new Error(`Não foi possível renomear a subcategoria: ${error.message}`);
        return json(request, { ok: true, affected_products: affectedProducts });
      }

      if (action === "add_subcategory") {
        const { data: lastItem } = await context.adminClient
          .from("catalog_subcategories")
          .select("sort_order")
          .eq("category_key", key)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data, error } = await context.adminClient
          .from("catalog_subcategories")
          .insert({ category_key: key, name: subcategory, sort_order: Number(lastItem?.sort_order ?? 0) + 1 })
          .select("id, category_key, name, sort_order")
          .single();
        if (error) {
          if (error.code === "23505") return json(request, { error: "Essa subcategoria já existe." }, 409);
          throw new Error(`Não foi possível adicionar a subcategoria: ${error.message}`);
        }
        await logChange(context.adminClient, context.user.id, "add_subcategory", key, { subcategory });
        return json(request, { ok: true, subcategory: data }, 201);
      }

      if (action === "delete_subcategory") {
        const { count, error: countError } = await context.adminClient
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("category", category.name)
          .eq("subcategory", subcategory);
        if (countError) throw new Error(`Não foi possível verificar os produtos: ${countError.message}`);
        if ((count ?? 0) > 0) {
          return json(request, { error: `Não é possível remover: existem ${count} produto(s) nessa subcategoria.` }, 409);
        }
        const { error } = await context.adminClient
          .from("catalog_subcategories")
          .delete()
          .eq("category_key", key)
          .eq("name", subcategory);
        if (error) throw new Error(`Não foi possível remover a subcategoria: ${error.message}`);
        await logChange(context.adminClient, context.user.id, "delete_subcategory", key, { subcategory });
        return json(request, { ok: true, deleted: true });
      }

      return json(request, { error: "Ação inválida." }, 400);
    }

    if (!contentType.includes("multipart/form-data")) {
      return json(request, { error: "Envie os dados no formato correto." }, 415);
    }

    const formData = await request.formData();
    const action = text(formData.get("action"));
    const image = formData.get("image");
    if (!validImage(image)) return json(request, { error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, 400);

    if (action === "create_category") {
      const name = text(formData.get("name"));
      const description = text(formData.get("description"));
      const firstSubcategory = text(formData.get("subcategory"));
      const key = categoryKey(name);
      if (!key || name.length > 40) return json(request, { error: "Informe um nome de categoria com até 40 caracteres." }, 400);
      if (!firstSubcategory || firstSubcategory.length > 60) return json(request, { error: "Informe a primeira subcategoria." }, 400);
      if (description.length > 100) return json(request, { error: "A descrição deve ter até 100 caracteres." }, 400);

      const uploadPath = `categories/${key}/${crypto.randomUUID()}.${fileExtension(image)}`;
      const { error: uploadError } = await context.adminClient.storage.from("products").upload(uploadPath, image, {
        cacheControl: "31536000", contentType: image.type, upsert: false,
      });
      if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);
      const imageUrl = context.adminClient.storage.from("products").getPublicUrl(uploadPath).data.publicUrl;
      const { data: lastCategory } = await context.adminClient.from("catalog_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data: category, error: insertError } = await context.adminClient
        .from("catalog_categories")
        .insert({ category_key: key, name, description, image_url: imageUrl, image_path: uploadPath, sort_order: Number(lastCategory?.sort_order ?? 0) + 1 })
        .select("category_key, name, description, image_url, sort_order")
        .single();
      if (insertError) {
        await context.adminClient.storage.from("products").remove([uploadPath]);
        if (insertError.code === "23505") return json(request, { error: "Essa categoria já existe." }, 409);
        throw new Error(`Não foi possível criar a categoria: ${insertError.message}`);
      }
      const { error: subcategoryError } = await context.adminClient
        .from("catalog_subcategories")
        .insert({ category_key: key, name: firstSubcategory, sort_order: 1 });
      if (subcategoryError) {
        await context.adminClient.from("catalog_categories").delete().eq("category_key", key);
        await context.adminClient.storage.from("products").remove([uploadPath]);
        throw new Error(`Não foi possível criar a primeira subcategoria: ${subcategoryError.message}`);
      }
      await logChange(context.adminClient, context.user.id, "create_category", key, { name, first_subcategory: firstSubcategory });
      return json(request, { ok: true, category }, 201);
    }

    if (action === "update_image") {
      const key = text(formData.get("category_key"));
      const { data: existing, error: readError } = await context.adminClient
        .from("catalog_categories")
        .select("category_key, image_path")
        .eq("category_key", key)
        .maybeSingle();
      if (readError || !existing) return json(request, { error: "Categoria não encontrada." }, 404);
      const uploadPath = `categories/${key}/${crypto.randomUUID()}.${fileExtension(image)}`;
      const { error: uploadError } = await context.adminClient.storage.from("products").upload(uploadPath, image, {
        cacheControl: "31536000", contentType: image.type, upsert: false,
      });
      if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);
      const imageUrl = context.adminClient.storage.from("products").getPublicUrl(uploadPath).data.publicUrl;
      const { error: updateError } = await context.adminClient
        .from("catalog_categories")
        .update({ image_url: imageUrl, image_path: uploadPath, updated_at: new Date().toISOString() })
        .eq("category_key", key);
      if (updateError) {
        await context.adminClient.storage.from("products").remove([uploadPath]);
        throw new Error(`Não foi possível atualizar a imagem: ${updateError.message}`);
      }
      if (existing.image_path && existing.image_path !== uploadPath) {
        await context.adminClient.storage.from("products").remove([existing.image_path]);
      }
      await logChange(context.adminClient, context.user.id, "update_category_image", key);
      return json(request, { ok: true, image_url: imageUrl });
    }

    return json(request, { error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerenciar as categorias.";
    return json(request, { error: message }, 401);
  }
});
