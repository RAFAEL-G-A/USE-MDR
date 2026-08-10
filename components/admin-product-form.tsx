"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { catalogCategories, catalogTaxonomy, type CatalogCategory } from "@/lib/catalog-taxonomy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Feedback = { type: "success" | "error"; message: string } | null;

function normalizePrice(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminProductForm({ onCreated }: { onCreated?: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<CatalogCategory>("Lábios");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!imageFile || !imageFile.type.startsWith("image/") || imageFile.size > MAX_IMAGE_SIZE) {
      setFeedback({ type: "error", message: "Selecione uma imagem JPG, PNG ou WebP de até 5 MB." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const price = normalizePrice(String(formData.get("price") ?? ""));
    const stock = Number(formData.get("stock"));
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      setFeedback({ type: "error", message: "Informe nome, preço e estoque válidos." });
      return;
    }

    setSaving(true);
    const requestData = new FormData();
    requestData.set("name", name);
    requestData.set("price", String(price));
    requestData.set("category", category);
    requestData.set("subcategory", String(formData.get("subcategory") ?? ""));
    requestData.set("description", String(formData.get("description") ?? "").trim());
    requestData.set("stock", String(stock));
    requestData.set("is_launch", String(formData.get("is_launch") === "on"));
    requestData.set("image", imageFile);

    const { error } = await supabase.functions.invoke("create-product", { body: requestData });
    if (error) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível cadastrar o produto.") });
    } else {
      formRef.current?.reset();
      setCategory("Lábios");
      setImageFile(null);
      setFeedback({ type: "success", message: `${name} foi adicionado ao estoque.` });
      onCreated?.();
    }
    setSaving(false);
  }

  return (
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">NOVO PRODUTO</p>
      <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Adicionar ao estoque</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <FormField label="Nome do produto" htmlFor="product-name"><input id="product-name" name="name" required maxLength={120} className="form-control" placeholder="Ex.: Gloss Crystal Shine" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Preço" htmlFor="product-price"><input id="product-price" name="price" required inputMode="decimal" className="form-control" placeholder="29,90" /></FormField>
            <FormField label="Estoque" htmlFor="product-stock"><input id="product-stock" name="stock" type="number" required min={0} step={1} defaultValue={1} className="form-control" /></FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Categoria" htmlFor="product-category"><select id="product-category" name="category" value={category} onChange={(event) => setCategory(event.target.value as CatalogCategory)} className="form-control">{catalogCategories.map((item) => <option key={item}>{item}</option>)}</select></FormField>
            <FormField label="Subcategoria" htmlFor="product-subcategory"><select id="product-subcategory" name="subcategory" className="form-control">{catalogTaxonomy[category].map((item) => <option key={item}>{item}</option>)}</select></FormField>
          </div>
          <FormField label="Descrição" htmlFor="product-description"><textarea id="product-description" name="description" rows={5} maxLength={1000} className="form-control resize-y" placeholder="Benefícios, acabamento, conteúdo e diferenciais." /></FormField>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[1.25rem] border border-brand-border bg-brand-soft/45 px-4 py-4"><span><span className="block text-sm font-extrabold">Exibir em Lançamentos</span><span className="mt-1 block text-xs text-muted">Mostra o produto na página inicial.</span></span><input name="is_launch" type="checkbox" defaultChecked className="size-5 accent-brand" /></label>
        </div>
        <FormField label="Imagem do produto" htmlFor="product-image">
          <label htmlFor="product-image" className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-brand-border bg-brand-soft/50 text-center">
            {imagePreview ? <Image src={imagePreview} alt="Prévia da imagem" fill unoptimized className="object-cover" /> : <span className="max-w-48 px-6 text-sm leading-6 text-muted">Toque para escolher uma foto.</span>}
          </label>
          <input id="product-image" type="file" required accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
          <p className="mt-2 text-xs text-muted">Máximo de 5 MB. Prefira uma imagem quadrada.</p>
        </FormField>
        <div className="lg:col-span-2">
          {feedback && <FeedbackMessage feedback={feedback} />}
          <button type="submit" disabled={saving} className="mt-5 min-h-14 rounded-full bg-brand px-7 text-sm font-extrabold text-white shadow-lg shadow-brand/20 disabled:opacity-60">{saving ? "SALVANDO..." : "ADICIONAR PRODUTO"}</button>
        </div>
      </form>
    </section>
  );
}

export function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="text-xs font-extrabold uppercase tracking-[0.1em] text-foreground">{label}</label><div className="mt-2">{children}</div></div>;
}

export function FeedbackMessage({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.message}</p>;
}
