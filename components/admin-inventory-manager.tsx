"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AdminProductForm, FeedbackMessage, FormField } from "@/components/admin-product-form";
import { catalogCategories, catalogTaxonomy, type CatalogCategory } from "@/lib/catalog-taxonomy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
      else setProducts((payload?.products ?? []).map((item) => ({ id: String(item.id), name: String(item.name), price: Number(item.price), costPrice: Number(item.cost_price ?? 0), category: String(item.category), subcategory: String(item.subcategory ?? ""), imageUrl: String(item.image_url ?? ""), description: String(item.description ?? ""), stock: Number(item.stock), isLaunch: Boolean(item.is_launch) })));
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

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[0.18em] text-brand">INVENTÁRIO ATUAL</p><h2 className="mt-2 font-serif text-3xl sm:text-4xl">Editar produtos</h2></div><button type="button" onClick={refresh} className="text-xs font-bold text-brand">Atualizar lista</button></div>
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

      <AdminProductForm onCreated={refresh} />
    </div>
  );
}

function ProductEditor({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const initialCategory = catalogCategories.includes(product.category as CatalogCategory) ? product.category as CatalogCategory : "Lábios";
  const [category, setCategory] = useState<CatalogCategory>(initialCategory);
  const [subcategory, setSubcategory] = useState(() =>
    (catalogTaxonomy[initialCategory] as readonly string[]).includes(product.subcategory)
      ? product.subcategory
      : catalogTaxonomy[initialCategory][0],
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const preview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : product.imageUrl, [imageFile, product.imageUrl]);

  useEffect(() => () => {
    if (imageFile && preview) URL.revokeObjectURL(preview);
  }, [imageFile, preview]);

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
    if (imageFile) requestData.set("image", imageFile);
    const { error } = await supabase.functions.invoke("manage-product", { body: requestData });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível atualizar o produto.") });
    else { setFeedback({ type: "success", message: "Produto atualizado. A imagem anterior foi removida caso tenha sido substituída." }); onChanged(); }
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
        <div className="grid grid-cols-2 gap-3"><FormField label="Categoria" htmlFor={`edit-category-${product.id}`}><select id={`edit-category-${product.id}`} value={category} onChange={(event) => { const nextCategory = event.target.value as CatalogCategory; setCategory(nextCategory); setSubcategory(catalogTaxonomy[nextCategory][0]); }} className="form-control">{catalogCategories.map((item) => <option key={item}>{item}</option>)}</select></FormField><FormField label="Subcategoria" htmlFor={`edit-subcategory-${product.id}`}><select id={`edit-subcategory-${product.id}`} name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} className="form-control">{catalogTaxonomy[category].map((item) => <option key={item}>{item}</option>)}</select></FormField></div>
        <FormField label="Descrição" htmlFor={`edit-description-${product.id}`}><textarea id={`edit-description-${product.id}`} name="description" rows={4} maxLength={1000} defaultValue={product.description} className="form-control resize-y" /></FormField>
        <label className="flex items-center gap-3 text-sm font-bold"><input name="is_launch" type="checkbox" defaultChecked={product.isLaunch} className="size-5 accent-brand" /> Exibir em Lançamentos</label>
      </div>
      <div>
        <FormField label="Substituir imagem" htmlFor={`edit-image-${product.id}`}><label htmlFor={`edit-image-${product.id}`} className="relative flex aspect-square cursor-pointer overflow-hidden rounded-2xl border border-brand-border bg-white"><Image src={preview} alt={`Imagem de ${product.name}`} fill unoptimized={Boolean(imageFile)} className="object-cover" /></label><input id={`edit-image-${product.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /><p className="mt-2 text-xs text-muted">A foto anterior será apagada automaticamente após salvar a nova.</p></FormField>
      </div>
      <div className="sm:col-span-2">
        {feedback && <FeedbackMessage feedback={feedback} />}
        <div className="mt-4 flex flex-wrap gap-3"><button type="submit" disabled={saving || deleting} className="min-h-12 rounded-full bg-brand px-6 text-xs font-extrabold text-white disabled:opacity-60">{saving ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</button><button type="button" onClick={handleDelete} disabled={saving || deleting} className="min-h-12 rounded-full border border-red-200 px-6 text-xs font-extrabold text-red-600 disabled:opacity-60">{deleting ? "EXCLUINDO..." : confirmDelete ? "CONFIRMAR EXCLUSÃO" : "EXCLUIR PRODUTO"}</button></div>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-brand-border bg-white px-3 py-4 text-center shadow-sm"><strong className="block font-serif text-3xl text-brand">{value}</strong><span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-wide text-muted">{label}</span></div>;
}
