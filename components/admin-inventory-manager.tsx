"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AdminProductForm, FeedbackMessage, FormField } from "@/components/admin-product-form";
import { compressProductImage, formatImageSize, MAX_PRODUCT_IMAGES, PRODUCT_IMAGE_ACCEPT, type CompressedProductImage } from "@/lib/image-compression";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useCatalogTaxonomy } from "@/lib/use-catalog-taxonomy";

type GalleryImage = { id: string; imageUrl: string; storagePath: string; sortOrder: number };

type Product = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  category: string;
  subcategory: string;
  imageUrl: string;
  description: string;
  stock: number;
  isLaunch: boolean;
  images: GalleryImage[];
};

type Feedback = { type: "success" | "error"; message: string } | null;

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminInventoryManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.functions.invoke("manage-product", { body: { action: "list" } }).then(({ data, error }) => {
      if (cancelled) return;
      const payload = data as { products?: Array<Record<string, unknown>> } | null;
      if (error) setProducts([]);
      else setProducts((payload?.products ?? []).map((item) => ({
        id: String(item.id),
        name: String(item.name),
        price: Number(item.price),
        costPrice: Number(item.cost_price ?? 0),
        category: String(item.category),
        subcategory: String(item.subcategory ?? ""),
        imageUrl: String(item.image_url ?? ""),
        description: String(item.description ?? ""),
        stock: Number(item.stock),
        isLaunch: Boolean(item.is_launch),
        images: Array.isArray(item.images) ? item.images.map((image) => {
          const galleryImage = image as Record<string, unknown>;
          return { id: String(galleryImage.id), imageUrl: String(galleryImage.image_url), storagePath: String(galleryImage.storage_path), sortOrder: Number(galleryImage.sort_order) };
        }) : [],
      })));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey, supabase]);

  const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const outOfStock = products.filter((product) => product.stock === 0).length;

  function refresh() {
    setLoading(true);
    setRefreshKey((current) => current + 1);
    setEditingId(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">GERENCIAR ESTOQUE</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Produtos e quantidades</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Edite todas as informações. Ao substituir ou excluir uma foto, o arquivo antigo também é removido do Storage.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Produtos" value={products.length} />
        <SummaryCard label="Unidades" value={totalUnits} />
        <SummaryCard label="Sem estoque" value={outOfStock} />
      </div>

      <AdminProductForm onCreated={refresh} />

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[0.18em] text-brand">INVENTÁRIO ATUAL</p><h2 className="mt-2 font-serif text-3xl sm:text-4xl">Editar produtos</h2></div><button type="button" onClick={refresh} className="px-2 py-2 text-xs font-bold text-brand">Atualizar lista</button></div>
        {loading ? <p className="mt-6 text-sm text-muted">Carregando estoque...</p> : products.length === 0 ? <p className="mt-6 text-sm text-muted">Nenhum produto cadastrado.</p> : (
          <div className="mt-6 space-y-3">
            {products.map((product) => (
              <div key={product.id} className="overflow-hidden rounded-2xl border border-brand-border/80">
                <div className="flex items-center gap-4 p-3 sm:p-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-brand-soft">{product.imageUrl && <Image src={product.imageUrl} alt={product.name} fill sizes="64px" className="object-cover" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{product.name}</p><p className="mt-1 text-xs text-muted">Venda R$ {product.price.toFixed(2).replace(".", ",")} · Custo R$ {product.costPrice.toFixed(2).replace(".", ",")} · {product.stock} un.</p></div>
                  <button type="button" onClick={() => setEditingId(editingId === product.id ? null : product.id)} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand">{editingId === product.id ? "Fechar" : "Editar"}</button>
                </div>
                {editingId === product.id && <ProductEditor key={product.id} product={product} onChanged={refresh} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductEditor({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { categories: catalogCategories, taxonomy: catalogTaxonomy } = useCatalogTaxonomy();
  const initialCategory = product.category || catalogCategories[0] || "Lábios";
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(product.subcategory);
  const [primaryImage, setPrimaryImage] = useState<CompressedProductImage | null>(null);
  const [newGalleryImages, setNewGalleryImages] = useState<CompressedProductImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [processingImages, setProcessingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const preview = useMemo(() => primaryImage ? URL.createObjectURL(primaryImage.file) : product.imageUrl, [primaryImage, product.imageUrl]);
  const newGalleryPreviews = useMemo(() => newGalleryImages.map((item) => URL.createObjectURL(item.file)), [newGalleryImages]);

  useEffect(() => () => {
    if (primaryImage && preview) URL.revokeObjectURL(preview);
  }, [primaryImage, preview]);
  useEffect(() => () => {
    newGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [newGalleryPreviews]);

  async function preparePrimaryImage(file: File | null) {
    if (!file) return;
    setProcessingImages(true);
    setFeedback(null);
    try {
      setPrimaryImage(await compressProductImage(file));
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível preparar a imagem." });
    } finally {
      setProcessingImages(false);
    }
  }

  async function prepareAdditionalImages(files: FileList | null) {
    if (!files?.length) return;
    const retainedCount = product.images.length - removedImageIds.length;
    const available = MAX_PRODUCT_IMAGES - 1 - retainedCount - newGalleryImages.length;
    if (files.length > available) {
      setFeedback({ type: "error", message: `Você pode adicionar mais ${available} ${available === 1 ? "imagem" : "imagens"}.` });
      return;
    }
    setProcessingImages(true);
    setFeedback(null);
    try {
      const compressed: CompressedProductImage[] = [];
      for (const file of Array.from(files)) compressed.push(await compressProductImage(file));
      setNewGalleryImages((current) => [...current, ...compressed]);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível preparar as imagens." });
    } finally {
      setProcessingImages(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    const requestData = new FormData();
    requestData.set("action", "update");
    requestData.set("id", product.id);
    requestData.set("name", String(formData.get("name") ?? "").trim());
    requestData.set("price", String(Number(String(formData.get("price") ?? "").replace(/\./g, "").replace(",", "."))));
    requestData.set("cost_price", String(Number(String(formData.get("cost_price") ?? "").replace(/\./g, "").replace(",", "."))));
    requestData.set("stock", String(formData.get("stock") ?? ""));
    requestData.set("category", category);
    requestData.set("subcategory", subcategory);
    requestData.set("description", String(formData.get("description") ?? "").trim());
    requestData.set("is_launch", String(formData.get("is_launch") === "on"));
    if (primaryImage) requestData.set("image", primaryImage.file);
    newGalleryImages.forEach((item) => requestData.append("images", item.file));
    requestData.set("remove_image_ids", JSON.stringify(removedImageIds));
    const { error } = await supabase.functions.invoke("manage-product", { body: requestData });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível atualizar o produto.") });
    else { setFeedback({ type: "success", message: "Produto e galeria atualizados. As imagens removidas foram apagadas do Storage." }); onChanged(); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    const requestData = new FormData();
    requestData.set("action", "delete");
    requestData.set("id", product.id);
    const { error } = await supabase.functions.invoke("manage-product", { body: requestData });
    if (error) { setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível excluir o produto.") }); setDeleting(false); }
    else onChanged();
  }

  return (
    <form onSubmit={handleUpdate} className="grid gap-5 border-t border-brand-border/70 bg-brand-soft/20 p-4 sm:grid-cols-2 sm:p-6">
      <div className="space-y-4">
        <FormField label="Nome" htmlFor={`edit-name-${product.id}`}><input id={`edit-name-${product.id}`} name="name" required defaultValue={product.name} maxLength={120} className="form-control" /></FormField>
        <div className="grid grid-cols-3 gap-3"><FormField label="Venda" htmlFor={`edit-price-${product.id}`}><input id={`edit-price-${product.id}`} name="price" required inputMode="decimal" defaultValue={product.price.toFixed(2).replace(".", ",")} className="form-control" /></FormField><FormField label="Custo" htmlFor={`edit-cost-${product.id}`}><input id={`edit-cost-${product.id}`} name="cost_price" required inputMode="decimal" defaultValue={product.costPrice.toFixed(2).replace(".", ",")} className="form-control" /></FormField><FormField label="Estoque" htmlFor={`edit-stock-${product.id}`}><input id={`edit-stock-${product.id}`} name="stock" type="number" required min={0} step={1} defaultValue={product.stock} className="form-control" /></FormField></div>
        <div className="grid grid-cols-2 gap-3"><FormField label="Categoria" htmlFor={`edit-category-${product.id}`}><select id={`edit-category-${product.id}`} value={category} onChange={(event) => { const nextCategory = event.target.value; setCategory(nextCategory); setSubcategory(catalogTaxonomy[nextCategory]?.[0] ?? ""); }} className="form-control">{catalogCategories.map((item) => <option key={item}>{item}</option>)}</select></FormField><FormField label="Subcategoria" htmlFor={`edit-subcategory-${product.id}`}><select id={`edit-subcategory-${product.id}`} name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} className="form-control">{(catalogTaxonomy[category] ?? []).map((item) => <option key={item}>{item}</option>)}</select></FormField></div>
        <FormField label="Descrição" htmlFor={`edit-description-${product.id}`}><textarea id={`edit-description-${product.id}`} name="description" rows={4} maxLength={1000} defaultValue={product.description} className="form-control resize-y" /></FormField>
        <label className="flex items-center gap-3 text-sm font-bold"><input name="is_launch" type="checkbox" defaultChecked={product.isLaunch} className="size-5 accent-brand" /> Exibir em Lançamentos</label>
      </div>
      <div>
        <FormField label="Substituir imagem principal" htmlFor={`edit-image-${product.id}`}><label htmlFor={`edit-image-${product.id}`} className="relative flex aspect-square cursor-pointer overflow-hidden rounded-2xl border border-brand-border bg-white"><Image src={preview} alt={`Imagem de ${product.name}`} fill unoptimized={Boolean(primaryImage)} className="object-cover" /></label><input id={`edit-image-${product.id}`} type="file" accept={PRODUCT_IMAGE_ACCEPT} className="sr-only" onChange={(event) => void preparePrimaryImage(event.target.files?.[0] ?? null)} /><p className="mt-2 text-xs text-muted">Aceita fotos do iPhone (HEIC/HEIF), JPEG, PNG e WebP. A nova foto será comprimida em WebP e a anterior será apagada após salvar.</p>{primaryImage && <p className="mt-1 text-xs font-bold text-emerald-700">{formatImageSize(primaryImage.originalSize)} → {formatImageSize(primaryImage.file.size)}</p>}</FormField>
        <div className="mt-5 border-t border-brand-border/70 pt-5">
          <div className="flex items-center justify-between"><p className="text-xs font-extrabold uppercase tracking-[0.1em]">Galeria do produto</p><span className="text-xs text-muted">{product.images.length - removedImageIds.length + newGalleryImages.length}/3</span></div>
          {(product.images.length > 0 || newGalleryImages.length > 0) && <div className="mt-3 grid grid-cols-3 gap-2">
            {product.images.map((image, index) => {
              const removed = removedImageIds.includes(image.id);
              return <div key={image.id} className={`relative aspect-square overflow-hidden rounded-xl border border-brand-border ${removed ? "opacity-35" : ""}`}><Image src={image.imageUrl} alt={`Imagem adicional ${index + 1} de ${product.name}`} fill sizes="120px" className="object-cover" /><button type="button" onClick={() => setRemovedImageIds((current) => current.includes(image.id) ? current.filter((id) => id !== image.id) : [...current, image.id])} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-[0.6rem] font-bold text-brand shadow">{removed ? "DESFAZER" : "REMOVER"}</button></div>;
            })}
            {newGalleryImages.map((item, index) => <div key={`${item.file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-brand-border"><Image src={newGalleryPreviews[index]} alt={`Nova imagem adicional ${index + 1}`} fill unoptimized className="object-cover" /><button type="button" onClick={() => setNewGalleryImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-white/90 font-bold text-brand shadow">×</button></div>)}
          </div>}
          {product.images.length - removedImageIds.length + newGalleryImages.length < MAX_PRODUCT_IMAGES - 1 && <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand-border bg-white px-4 text-center text-xs font-bold text-brand">Adicionar fotos<input type="file" multiple accept={PRODUCT_IMAGE_ACCEPT} className="sr-only" onChange={(event) => { void prepareAdditionalImages(event.target.files); event.currentTarget.value = ""; }} /></label>}
          <p className="mt-2 text-xs leading-5 text-muted">Até três fotos extras, exibidas apenas na página individual.</p>
        </div>
      </div>
      <div className="sm:col-span-2">
        {feedback && <FeedbackMessage feedback={feedback} />}
        <div className="mt-4 flex flex-wrap gap-3"><button type="submit" disabled={saving || deleting || processingImages} className="min-h-12 rounded-full bg-brand px-6 text-xs font-extrabold text-white disabled:opacity-60">{processingImages ? "OTIMIZANDO IMAGENS..." : saving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</button><button type="button" onClick={handleDelete} disabled={saving || deleting || processingImages} className="min-h-12 rounded-full border border-red-200 px-6 text-xs font-extrabold text-red-600 disabled:opacity-60">{deleting ? "EXCLUINDO..." : confirmDelete ? "CONFIRMAR EXCLUSÃO" : "EXCLUIR PRODUTO"}</button></div>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-brand-border bg-white px-3 py-4 text-center shadow-sm"><strong className="block font-serif text-3xl text-brand">{value}</strong><span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-wide text-muted">{label}</span></div>;
}
