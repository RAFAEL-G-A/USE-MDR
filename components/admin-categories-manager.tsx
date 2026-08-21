"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { FeedbackMessage, FormField } from "@/components/admin-product-form";
import { categoryDefinitions } from "@/lib/category-definitions";
import { catalogTaxonomy } from "@/lib/catalog-taxonomy";
import { compressProductImage, formatImageSize, PRODUCT_IMAGE_ACCEPT, type CompressedProductImage } from "@/lib/image-compression";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Category = {
  key: string;
  name: string;
  description: string;
  image: string | StaticImageData;
  customImageUrl: string | null;
  isActive: boolean;
  productCount: number;
  subcategoryCounts: Record<string, number>;
  subcategories: string[];
};
type HistoryItem = { id: string; action: string; category_key: string; details: Record<string, unknown>; created_at: string };
type Feedback = { type: "success" | "error"; message: string } | null;

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

function fallbackCategories(): Category[] {
  return categoryDefinitions.map((category) => ({
    key: category.key,
    name: category.name,
    description: category.description,
    image: category.image,
    customImageUrl: null,
    isActive: true,
    productCount: 0,
    subcategoryCounts: {},
    subcategories: [...(catalogTaxonomy[category.name as keyof typeof catalogTaxonomy] ?? [])],
  }));
}

function historyLabel(action: string) {
  return ({
    create_category: "Categoria criada",
    add_subcategory: "Subcategoria adicionada",
    delete_subcategory: "Subcategoria removida",
    rename_category: "Categoria renomeada",
    rename_subcategory: "Subcategoria renomeada",
    update_category_image: "Imagem atualizada",
    activate_category: "Categoria reativada",
    hide_category: "Categoria ocultada",
    reorder_categories: "Categorias reordenadas",
    reorder_subcategories: "Subcategorias reordenadas",
  } as Record<string, string>)[action] ?? "Configuração atualizada";
}

export function AdminCategoriesManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [selectedKey, setSelectedKey] = useState(categoryDefinitions[0].key);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [renamingSubcategory, setRenamingSubcategory] = useState<string | null>(null);
  const [subcategoryRenameValue, setSubcategoryRenameValue] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState<CompressedProductImage | null>(null);
  const [replacementImage, setReplacementImage] = useState<CompressedProductImage | null>(null);
  const selected = categories.find((category) => category.key === selectedKey) ?? categories[0];
  const filteredCategories = categories.filter((category) => `${category.name} ${category.subcategories.join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()));
  const replacementPreview = useMemo(() => replacementImage ? URL.createObjectURL(replacementImage.file) : null, [replacementImage]);
  const newCategoryPreview = useMemo(() => newCategoryImage ? URL.createObjectURL(newCategoryImage.file) : null, [newCategoryImage]);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke<{
      categories?: Array<Record<string, unknown>>;
      products?: Array<{ category: string; subcategory: string }>;
      history?: HistoryItem[];
    }>("manage-catalog-categories", { body: { action: "list" } });
    if (!error && data?.categories?.length) {
      const defaults = new Map(categoryDefinitions.map((category) => [category.key, category]));
      const products = data.products ?? [];
      const next = data.categories.flatMap((row) => {
        const fallback = defaults.get(String(row.category_key));
        const image = row.image_url ? String(row.image_url) : fallback?.image;
        if (!image) return [];
        const subcategories = (row.catalog_subcategories ?? []) as Array<{ name: string; sort_order: number }>;
        return [{
          key: String(row.category_key),
          name: String(row.name),
          description: String(row.description),
          image,
          customImageUrl: row.image_url ? String(row.image_url) : null,
          isActive: Boolean(row.is_active),
          productCount: products.filter((product) => product.category === String(row.name)).length,
          subcategoryCounts: Object.fromEntries(subcategories.map((item) => [item.name, products.filter((product) => product.category === String(row.name) && product.subcategory === item.name).length])),
          subcategories: [...subcategories].sort((left, right) => left.sort_order - right.sort_order).map((item) => item.name),
        }];
      });
      setCategories(next);
      setSelectedKey((current) => next.some((category) => category.key === current) ? current : next[0]?.key ?? "");
      setHistory(data.history ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCategories(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCategories]);
  useEffect(() => () => {
    if (replacementPreview) URL.revokeObjectURL(replacementPreview);
    if (newCategoryPreview) URL.revokeObjectURL(newCategoryPreview);
  }, [replacementPreview, newCategoryPreview]);

  async function prepareImage(file: File | null, target: "new" | "replacement") {
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const compressed = await compressProductImage(file);
      if (target === "new") setNewCategoryImage(compressed);
      else setReplacementImage(compressed);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível preparar a imagem." });
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCategoryImage) {
      setFeedback({ type: "error", message: "Escolha uma imagem para a nova categoria." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const source = new FormData(event.currentTarget);
    const request = new FormData();
    request.set("action", "create_category");
    request.set("name", String(source.get("name") ?? ""));
    request.set("description", String(source.get("description") ?? ""));
    request.set("subcategory", String(source.get("subcategory") ?? ""));
    request.set("image", newCategoryImage.file);
    const { data, error } = await supabase.functions.invoke<{ category?: { category_key: string } }>("manage-catalog-categories", { body: request });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível criar a categoria.") });
    else {
      event.currentTarget.reset();
      setNewCategoryImage(null);
      await loadCategories();
      if (data?.category?.category_key) setSelectedKey(data.category.category_key);
      setFeedback({ type: "success", message: "Categoria criada e disponibilizada nos formulários e no catálogo." });
    }
    setBusy(false);
  }

  async function addSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    const form = event.currentTarget;
    const subcategory = String(new FormData(form).get("subcategory") ?? "").trim();
    const { error } = await supabase.functions.invoke("manage-catalog-categories", { body: { action: "add_subcategory", category_key: selected.key, subcategory } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível adicionar a subcategoria.") });
    else {
      form.reset();
      await loadCategories();
      setFeedback({ type: "success", message: `${subcategory} foi adicionada à categoria ${selected.name}.` });
    }
    setBusy(false);
  }

  async function toggleCategory() {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-catalog-categories", { body: { action: "toggle_category", category_key: selected.key, is_active: !selected.isActive } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível alterar a visibilidade.") });
    else {
      await loadCategories();
      setFeedback({ type: "success", message: selected.isActive ? `${selected.name} foi ocultada da vitrine.` : `${selected.name} voltou a aparecer na vitrine.` });
    }
    setBusy(false);
  }

  async function moveCategory(direction: -1 | 1) {
    if (!selected) return;
    const index = categories.findIndex((category) => category.key === selected.key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    const { error } = await supabase.functions.invoke("manage-catalog-categories", { body: { action: "reorder_categories", category_key: selected.key, category_keys: reordered.map((category) => category.key) } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível alterar a ordem.") });
    else { setCategories(reordered); await loadCategories(); }
    setBusy(false);
  }

  async function moveSubcategory(subcategory: string, direction: -1 | 1) {
    if (!selected) return;
    const index = selected.subcategories.indexOf(subcategory);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selected.subcategories.length) return;
    const reordered = [...selected.subcategories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    const { error } = await supabase.functions.invoke("manage-catalog-categories", { body: { action: "reorder_subcategories", category_key: selected.key, subcategories: reordered } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível alterar a ordem.") });
    else await loadCategories();
    setBusy(false);
  }

  async function renameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const newName = String(new FormData(form).get("new_name") ?? "").trim();
    setBusy(true);
    setFeedback(null);
    const { data, error } = await supabase.functions.invoke<{ affected_products?: number }>("manage-catalog-categories", { body: { action: "rename_category", category_key: selected.key, new_name: newName } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível renomear a categoria.") });
    else {
      await loadCategories();
      setFeedback({ type: "success", message: `Categoria renomeada. ${data?.affected_products ?? 0} produto(s) vinculado(s) foram atualizados com segurança.` });
    }
    setBusy(false);
  }

  async function renameSubcategory(previousName: string) {
    if (!selected) return;
    const newName = subcategoryRenameValue.trim();
    if (!newName) return;
    setBusy(true);
    setFeedback(null);
    const { data, error } = await supabase.functions.invoke<{ affected_products?: number }>("manage-catalog-categories", { body: { action: "rename_subcategory", category_key: selected.key, subcategory: previousName, new_name: newName } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível renomear a subcategoria.") });
    else {
      setRenamingSubcategory(null);
      setSubcategoryRenameValue("");
      await loadCategories();
      setFeedback({ type: "success", message: `Subcategoria renomeada. ${data?.affected_products ?? 0} produto(s) vinculado(s) foram atualizados com segurança.` });
    }
    setBusy(false);
  }

  async function removeSubcategory(subcategory: string) {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-catalog-categories", { body: { action: "delete_subcategory", category_key: selected.key, subcategory } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível remover a subcategoria.") });
    else {
      await loadCategories();
      setFeedback({ type: "success", message: `${subcategory} foi removida. Nenhum produto foi alterado.` });
    }
    setBusy(false);
  }

  async function replaceImage() {
    if (!selected || !replacementImage) return;
    setBusy(true);
    setFeedback(null);
    const request = new FormData();
    request.set("action", "update_image");
    request.set("category_key", selected.key);
    request.set("image", replacementImage.file);
    const { error } = await supabase.functions.invoke("manage-catalog-categories", { body: request });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível atualizar a imagem.") });
    else {
      setReplacementImage(null);
      await loadCategories();
      setFeedback({ type: "success", message: `Imagem de ${selected.name} atualizada e arquivo anterior removido.` });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">CATEGORIAS</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Organizar o catálogo</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Crie categorias, acrescente subcategorias e cuide das imagens da vitrine sem editar o código.</p>
      </div>

      {feedback && <FeedbackMessage feedback={feedback} />}

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">NOVA CATEGORIA</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Adicionar à vitrine</h2>
        <form onSubmit={createCategory} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <FormField label="Nome" htmlFor="new-category-name"><input id="new-category-name" name="name" required maxLength={40} className="form-control" placeholder="Ex.: Perfumes" /></FormField>
            <FormField label="Texto de apoio" htmlFor="new-category-description"><input id="new-category-description" name="description" required maxLength={100} className="form-control" placeholder="Ex.: Fragrâncias para todos os momentos" /></FormField>
            <FormField label="Primeira subcategoria" htmlFor="new-category-subcategory"><input id="new-category-subcategory" name="subcategory" required maxLength={60} className="form-control" placeholder="Ex.: Perfumes femininos" /></FormField>
          </div>
          <div>
            <label htmlFor="new-category-image" className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[1.5rem] border border-dashed border-brand-border bg-brand-soft/40 text-center">
              {newCategoryPreview ? <Image src={newCategoryPreview} alt="Prévia da nova categoria" fill sizes="256px" unoptimized className="object-cover" /> : <span className="px-6 text-sm leading-6 text-muted">Escolher imagem da categoria</span>}
            </label>
            <input id="new-category-image" type="file" accept={PRODUCT_IMAGE_ACCEPT} className="sr-only" onChange={(event) => void prepareImage(event.target.files?.[0] ?? null, "new")} />
            {newCategoryImage && <p className="mt-2 text-xs font-bold text-emerald-700">{formatImageSize(newCategoryImage.originalSize)} → {formatImageSize(newCategoryImage.file.size)}</p>}
          </div>
          <button type="submit" disabled={busy} className="min-h-13 rounded-full bg-brand px-6 text-xs font-extrabold text-white disabled:opacity-50 lg:col-span-2 lg:w-fit">{busy ? "PROCESSANDO..." : "CRIAR CATEGORIA"}</button>
        </form>
      </section>

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">CATEGORIAS ATUAIS</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Subcategorias e imagens</h2>
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="form-control mt-5 max-w-xl" placeholder="Pesquisar categoria ou subcategoria" aria-label="Pesquisar categorias e subcategorias" />
        <div className="-mx-5 mt-6 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          {filteredCategories.map((category) => <button key={category.key} type="button" onClick={() => { setSelectedKey(category.key); setReplacementImage(null); setFeedback(null); }} className={`relative w-28 shrink-0 rounded-2xl border p-2 text-center ${selected?.key === category.key ? "border-brand bg-brand-soft text-brand" : "border-brand-border"} ${category.isActive ? "" : "opacity-55"}`}><span className="relative mx-auto block size-14 overflow-hidden rounded-full"><Image src={category.image} alt="" fill sizes="56px" className="object-cover" /></span><span className="mt-2 block text-[0.65rem] font-extrabold">{category.name}</span><span className="mt-1 block text-[0.55rem] text-muted">{category.productCount} produto(s)</span>{!category.isActive && <span className="absolute right-1 top-1 rounded-full bg-foreground px-2 py-1 text-[0.48rem] font-bold text-white">OCULTA</span>}</button>)}
          {filteredCategories.length === 0 && <p className="py-5 text-sm text-muted">Nenhuma categoria encontrada.</p>}
        </div>

        {loading ? <p className="mt-7 text-sm text-muted">Carregando categorias...</p> : selected && <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-serif text-3xl">{selected.name}</h3><p className="mt-2 text-sm text-muted">{selected.description}</p><p className="mt-2 text-xs font-bold text-brand">{selected.productCount} produto(s) nesta categoria</p></div><Link href={{ pathname: "/catalogo", query: { categoria: selected.name }, hash: "produtos" }} prefetch={false} target="_blank" className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand">VER NO CATÁLOGO ↗</Link></div>
            <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void moveCategory(-1)} disabled={busy || categories[0]?.key === selected.key} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold disabled:opacity-35">← MOVER</button><button type="button" onClick={() => void moveCategory(1)} disabled={busy || categories.at(-1)?.key === selected.key} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold disabled:opacity-35">MOVER →</button><button type="button" onClick={() => void toggleCategory()} disabled={busy} className={`rounded-full px-4 py-2 text-xs font-bold ${selected.isActive ? "border border-brand-border text-brand" : "bg-brand text-white"}`}>{selected.isActive ? "OCULTAR DA VITRINE" : "REATIVAR NA VITRINE"}</button></div>
            <form onSubmit={renameCategory} className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-soft/25 p-4 sm:flex-row"><input name="new_name" required maxLength={40} defaultValue={selected.name} key={selected.key} className="form-control flex-1" aria-label="Novo nome da categoria" /><button type="submit" disabled={busy} className="min-h-12 rounded-full border border-brand-border px-5 text-xs font-extrabold text-brand disabled:opacity-50">RENOMEAR</button></form>
            <form onSubmit={addSubcategory} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input name="subcategory" required maxLength={60} className="form-control flex-1" placeholder="Nova subcategoria" aria-label={`Nova subcategoria de ${selected.name}`} />
              <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-brand px-5 text-xs font-extrabold text-white disabled:opacity-50">ADICIONAR</button>
            </form>
            <ul className="mt-5 space-y-2">
              {selected.subcategories.map((subcategory, index) => <li key={subcategory} className="rounded-2xl border border-brand-border bg-brand-soft/25 px-3 py-3">{renamingSubcategory === subcategory ? <div className="flex flex-col gap-2 sm:flex-row"><input value={subcategoryRenameValue} onChange={(event) => setSubcategoryRenameValue(event.target.value)} maxLength={60} className="form-control flex-1" aria-label={`Novo nome para ${subcategory}`} /><button type="button" onClick={() => void renameSubcategory(subcategory)} disabled={busy} className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-white">SALVAR</button><button type="button" onClick={() => setRenamingSubcategory(null)} className="px-3 text-xs font-bold text-muted">CANCELAR</button></div> : <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 text-sm font-bold">{subcategory} <span className="ml-1 text-xs font-normal text-muted">({selected.subcategoryCounts[subcategory] ?? 0})</span></span><button type="button" onClick={() => void moveSubcategory(subcategory, -1)} disabled={busy || index === 0} aria-label={`Mover ${subcategory} para cima`} className="size-8 rounded-full border border-brand-border text-xs disabled:opacity-30">↑</button><button type="button" onClick={() => void moveSubcategory(subcategory, 1)} disabled={busy || index === selected.subcategories.length - 1} aria-label={`Mover ${subcategory} para baixo`} className="size-8 rounded-full border border-brand-border text-xs disabled:opacity-30">↓</button><button type="button" disabled={busy} onClick={() => { setRenamingSubcategory(subcategory); setSubcategoryRenameValue(subcategory); }} className="px-2 text-[0.62rem] font-extrabold text-brand disabled:opacity-40">RENOMEAR</button><button type="button" disabled={busy} onClick={() => void removeSubcategory(subcategory)} className="px-2 text-[0.62rem] font-extrabold text-red-600 disabled:opacity-40">REMOVER</button></div>}</li>)}
            </ul>
            <p className="mt-4 text-xs leading-5 text-muted">A remoção é bloqueada automaticamente quando há produtos cadastrados na subcategoria.</p>
          </div>
          <div>
            <label htmlFor="replacement-category-image" className="relative flex aspect-square cursor-pointer overflow-hidden rounded-[1.5rem] border border-dashed border-brand-border bg-brand-soft/40">
              <Image src={replacementPreview ?? selected.image} alt={`Imagem de ${selected.name}`} fill sizes="288px" unoptimized={Boolean(replacementPreview)} className="object-cover" />
              <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/90 px-3 py-2 text-center text-[0.62rem] font-extrabold text-brand">TROCAR IMAGEM</span>
            </label>
            <input id="replacement-category-image" type="file" accept={PRODUCT_IMAGE_ACCEPT} className="sr-only" onChange={(event) => void prepareImage(event.target.files?.[0] ?? null, "replacement")} />
            {replacementImage && <><p className="mt-2 text-xs font-bold text-emerald-700">{formatImageSize(replacementImage.originalSize)} → {formatImageSize(replacementImage.file.size)}</p><button type="button" onClick={replaceImage} disabled={busy} className="mt-3 min-h-12 w-full rounded-full bg-brand px-4 text-xs font-extrabold text-white disabled:opacity-50">SALVAR IMAGEM</button></>}
          </div>
        </div>}
      </section>

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">HISTÓRICO</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Alterações recentes</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Registro das últimas mudanças realizadas nas categorias, sem expor credenciais.</p>
        {history.length ? <ul className="mt-6 space-y-2">{history.map((item) => <li key={item.id} className="flex flex-col gap-1 rounded-2xl border border-brand-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-bold">{historyLabel(item.action)}</span><span className="text-xs text-muted">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(new Date(item.created_at))}</span></li>)}</ul> : <p className="mt-6 text-sm text-muted">Nenhuma alteração registrada ainda.</p>}
      </section>
    </div>
  );
}
