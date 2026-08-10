"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { categoryDefinitions } from "@/lib/category-definitions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Feedback = { type: "success" | "error"; message: string } | null;
type CategoryResponse = { category?: { category_key: string; image_url: string } };

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminCategoryImages() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [customImages, setCustomImages] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState(categoryDefinitions[0].key);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const currentCategory = categoryDefinitions.find((category) => category.key === activeKey) ?? categoryDefinitions[0];
  const localPreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);
  const preview = localPreview ?? customImages[activeKey] ?? currentCategory.image;
  const isCustomized = Boolean(customImages[activeKey]);

  useEffect(() => {
    let cancelled = false;
    void supabase.from("category_images").select("category_key, image_url").then(({ data }) => {
      if (cancelled) return;
      setCustomImages(Object.fromEntries((data ?? []).map((item) => [item.category_key, item.image_url])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  function selectCategory(categoryKey: string) {
    setActiveKey(categoryKey);
    setImageFile(null);
    setFeedback(null);
  }

  async function saveImage() {
    setFeedback(null);
    if (!imageFile || !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type) || imageFile.size > MAX_IMAGE_SIZE) {
      setFeedback({ type: "error", message: "Selecione uma imagem JPG, PNG ou WebP de até 5 MB." });
      return;
    }
    setSaving(true);
    const requestData = new FormData();
    requestData.set("action", "save");
    requestData.set("category_key", activeKey);
    requestData.set("image", imageFile);
    const { data, error } = await supabase.functions.invoke<CategoryResponse>("manage-category-image", { body: requestData });
    if (error || !data?.category) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível salvar a imagem.") });
    } else {
      setCustomImages((current) => ({ ...current, [activeKey]: data.category!.image_url }));
      setImageFile(null);
      setFeedback({ type: "success", message: `Imagem de ${currentCategory.name} atualizada na loja.` });
    }
    setSaving(false);
  }

  async function resetImage() {
    setResetting(true);
    setFeedback(null);
    const requestData = new FormData();
    requestData.set("action", "reset");
    requestData.set("category_key", activeKey);
    const { error } = await supabase.functions.invoke("manage-category-image", { body: requestData });
    if (error) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível restaurar a imagem padrão.") });
    } else {
      setCustomImages((current) => {
        const next = { ...current };
        delete next[activeKey];
        return next;
      });
      setImageFile(null);
      setFeedback({ type: "success", message: `Imagem padrão de ${currentCategory.name} restaurada.` });
    }
    setResetting(false);
  }

  return (
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">IMAGENS DAS CATEGORIAS</p>
      <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Vitrine por categoria</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Troque as imagens exibidas na Home e na página de categorias. A foto anterior é apagada automaticamente após a substituição.</p>

      <div className="-mx-5 mt-6 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-7" role="tablist" aria-label="Categorias para editar">
        {categoryDefinitions.map((category) => {
          const categoryImage = customImages[category.key] ?? category.image;
          const active = category.key === activeKey;
          return (
            <button key={category.key} type="button" role="tab" aria-selected={active} onClick={() => selectCategory(category.key)} disabled={loading} className={`w-24 shrink-0 rounded-2xl border p-2 text-center transition-colors sm:w-auto ${active ? "border-brand bg-brand-soft text-brand" : "border-brand-border bg-white text-foreground"}`}>
              <span className="relative mx-auto block size-14 overflow-hidden rounded-full border border-brand-border bg-brand-soft"><Image src={categoryImage} alt="" fill sizes="56px" className="object-cover" /></span>
              <span className="mt-2 block text-[0.65rem] font-extrabold">{category.name}</span>
              {customImages[category.key] && <span className="mt-1 block text-[0.5rem] font-bold text-brand">PERSONALIZADA</span>}
            </button>
          );
        })}
      </div>

      {loading ? <p className="mt-7 text-sm text-muted">Carregando imagens...</p> : (
        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.1em]">Categoria selecionada</p>
            <h3 className="mt-2 font-serif text-3xl">{currentCategory.name}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">Use uma imagem quadrada, bem iluminada e sem textos importantes nas bordas. Ela será recortada automaticamente conforme o tamanho da tela.</p>
            <p className="mt-4 inline-flex rounded-full bg-brand-soft px-3 py-2 text-[0.65rem] font-bold text-brand">{isCustomized ? "Imagem personalizada ativa" : "Usando imagem padrão"}</p>
          </div>

          <div>
            <label htmlFor="category-image" className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-brand-border bg-brand-soft/50">
              <Image src={preview} alt={`Prévia da categoria ${currentCategory.name}`} fill unoptimized={Boolean(localPreview)} className="object-cover" />
              <span className="absolute inset-x-4 bottom-4 rounded-full bg-white/90 px-4 py-2 text-center text-[0.65rem] font-extrabold text-brand shadow-sm backdrop-blur">TOQUE PARA TROCAR</span>
            </label>
            <input id="category-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
            <p className="mt-2 text-xs text-muted">JPG, PNG ou WebP, máximo de 5 MB.</p>
          </div>

          <div className="lg:col-span-2">
            {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.message}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={saveImage} disabled={!imageFile || saving || resetting} className="min-h-13 rounded-full bg-brand px-6 text-xs font-extrabold text-white shadow-lg shadow-brand/20 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "SALVANDO..." : "SALVAR NOVA IMAGEM"}</button>
              {isCustomized && <button type="button" onClick={resetImage} disabled={saving || resetting} className="min-h-13 rounded-full border border-brand-border px-6 text-xs font-extrabold text-brand disabled:opacity-50">{resetting ? "RESTAURANDO..." : "RESTAURAR IMAGEM PADRÃO"}</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
