"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  catalogCategories,
  catalogTaxonomy,
  type CatalogCategory,
} from "@/lib/catalog-taxonomy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Feedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

function normalizePrice(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

export function AdminProductForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const formRef = useRef<HTMLFormElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<CatalogCategory>("Lábios");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setCheckingSession(false);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthenticating(true);
    setFeedback(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setFeedback({
        type: "error",
        message: "Não foi possível entrar. Confira o e-mail e a senha.",
      });
    }

    setAuthenticating(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!imageFile) {
      setFeedback({ type: "error", message: "Selecione uma imagem do produto." });
      return;
    }

    if (!imageFile.type.startsWith("image/")) {
      setFeedback({ type: "error", message: "O arquivo selecionado não é uma imagem." });
      return;
    }

    if (imageFile.size > MAX_IMAGE_SIZE) {
      setFeedback({ type: "error", message: "A imagem deve ter no máximo 5 MB." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const price = normalizePrice(String(formData.get("price") ?? ""));
    const subcategory = String(formData.get("subcategory") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const stock = Number(formData.get("stock"));

    if (!name || !Number.isFinite(price) || price <= 0) {
      setFeedback({ type: "error", message: "Informe um nome e um preço válido." });
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setFeedback({ type: "error", message: "Informe um estoque inteiro igual ou maior que zero." });
      return;
    }

    setSaving(true);
    const imagePath = `catalog/${crypto.randomUUID()}.${fileExtension(imageFile)}`;
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(imagePath, imageFile, {
        cacheControl: "31536000",
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadError) {
      setFeedback({
        type: "error",
        message: `Não foi possível enviar a imagem: ${uploadError.message}`,
      });
      setSaving(false);
      return;
    }

    const { data: publicImage } = supabase.storage
      .from("products")
      .getPublicUrl(imagePath);

    const { error: insertError } = await supabase.from("products").insert({
      name,
      price,
      category,
      subcategory,
      image_url: publicImage.publicUrl,
      description: description || null,
      stock,
    });

    if (insertError) {
      await supabase.storage.from("products").remove([imagePath]);
      setFeedback({
        type: "error",
        message: `A imagem foi enviada, mas o produto não foi salvo: ${insertError.message}`,
      });
      setSaving(false);
      return;
    }

    formRef.current?.reset();
    setCategory("Lábios");
    setImageFile(null);
    setFeedback({
      type: "success",
      message: `${name} foi adicionado ao catálogo com sucesso.`,
    });
    setSaving(false);
  }

  if (checkingSession) {
    return (
      <div className="rounded-[2rem] border border-brand-border bg-white p-8 text-center shadow-soft">
        <p className="text-sm text-muted">Verificando acesso administrativo...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="max-w-xl rounded-[2rem] border border-brand-border bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">ACESSO RESTRITO</p>
        <h2 className="mt-2 font-serif text-3xl">Entrar como administradora</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Use a conta administrativa criada no Supabase Auth. Este acesso não é exibido às clientes.
        </p>

        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <FormField label="E-mail" htmlFor="admin-email">
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="form-control"
              placeholder="voce@exemplo.com"
            />
          </FormField>
          <FormField label="Senha" htmlFor="admin-password">
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="form-control"
              placeholder="Sua senha administrativa"
            />
          </FormField>
          {feedback && <FeedbackMessage feedback={feedback} />}
          <button
            type="submit"
            disabled={authenticating}
            className="min-h-13 w-full rounded-full bg-brand px-6 text-sm font-extrabold text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60"
          >
            {authenticating ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-brand-border/70 pb-5">
        <div>
          <p className="text-xs font-bold text-brand">Acesso autorizado</p>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand hover:bg-brand-soft"
        >
          Sair
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <FormField label="Nome do produto" htmlFor="product-name">
            <input id="product-name" name="name" required maxLength={120} className="form-control" placeholder="Ex.: Gloss Crystal Shine" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Preço" htmlFor="product-price">
              <input id="product-price" name="price" required inputMode="decimal" className="form-control" placeholder="29,90" />
            </FormField>
            <FormField label="Estoque" htmlFor="product-stock">
              <input id="product-stock" name="stock" type="number" required min={0} step={1} defaultValue={1} className="form-control" />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Categoria" htmlFor="product-category">
              <select
                id="product-category"
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value as CatalogCategory)}
                className="form-control"
              >
                {catalogCategories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
            <FormField label="Subcategoria" htmlFor="product-subcategory">
              <select id="product-subcategory" name="subcategory" className="form-control">
                {catalogTaxonomy[category].map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Descrição" htmlFor="product-description">
            <textarea id="product-description" name="description" rows={5} maxLength={1000} className="form-control resize-y" placeholder="Descreva os benefícios, acabamento, conteúdo e diferenciais do produto." />
          </FormField>
        </div>

        <div>
          <FormField label="Imagem do produto" htmlFor="product-image">
            <label htmlFor="product-image" className="relative mt-2 flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-brand-border bg-brand-soft/50 text-center transition-colors hover:bg-brand-soft">
              {imagePreview ? (
                <Image src={imagePreview} alt="Prévia da imagem selecionada" fill unoptimized className="object-cover" />
              ) : (
                <span className="max-w-48 px-6 text-sm leading-6 text-muted">
                  Toque para escolher uma foto em formato JPG, PNG ou WebP.
                </span>
              )}
            </label>
            <input
              id="product-image"
              name="image"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
            <p className="mt-2 text-xs text-muted">Máximo de 5 MB. Prefira uma imagem quadrada.</p>
          </FormField>
        </div>

        <div className="lg:col-span-2">
          {feedback && <FeedbackMessage feedback={feedback} />}
          <button
            type="submit"
            disabled={saving}
            className="mt-5 min-h-14 w-full rounded-full bg-brand px-7 text-sm font-extrabold text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {saving ? "SALVANDO PRODUTO..." : "ADICIONAR AO CATÁLOGO"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-extrabold uppercase tracking-[0.1em] text-foreground">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function FeedbackMessage({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return (
    <p
      role={feedback.type === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm ${
        feedback.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {feedback.message}
    </p>
  );
}
