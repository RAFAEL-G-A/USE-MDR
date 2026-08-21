"use client";

import { useEffect, useMemo, useState } from "react";
import { catalogTaxonomy as fallbackTaxonomy } from "@/lib/catalog-taxonomy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CategoryRow = {
  name: string;
  sort_order: number;
  catalog_subcategories: Array<{ name: string; sort_order: number }> | null;
};

export function useCatalogTaxonomy() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [taxonomy, setTaxonomy] = useState<Record<string, readonly string[]>>(fallbackTaxonomy);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("catalog_categories")
      .select("name, sort_order, catalog_subcategories(name, sort_order)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("sort_order", { referencedTable: "catalog_subcategories", ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data?.length) return;
        const rows = data as CategoryRow[];
        setTaxonomy(Object.fromEntries(rows.map((row) => [
          row.name,
          [...(row.catalog_subcategories ?? [])]
            .sort((left, right) => left.sort_order - right.sort_order)
            .map((subcategory) => subcategory.name),
        ])));
      });
    return () => { cancelled = true; };
  }, [supabase]);

  return {
    categories: Object.keys(taxonomy),
    taxonomy,
  };
}
