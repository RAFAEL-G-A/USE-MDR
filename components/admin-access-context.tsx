"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type AdminSection =
  | "inventory"
  | "acquisitions"
  | "categories"
  | "sales"
  | "highlights"
  | "finances"
  | "analytics"
  | "users";

export type AdminRole = "owner" | "manager" | "operator";

export type AdminAccessProfile = {
  displayName: string;
  role: AdminRole;
  sections: AdminSection[];
};

type AdminAccessContextValue = {
  profile: AdminAccessProfile | null;
  setProfile: (profile: AdminAccessProfile | null) => void;
};

const AdminAccessContext = createContext<AdminAccessContextValue | null>(null);

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AdminAccessProfile | null>(null);
  const value = useMemo(() => ({ profile, setProfile }), [profile]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const value = useContext(AdminAccessContext);
  if (!value) throw new Error("useAdminAccess deve ser usado dentro de AdminAccessProvider.");
  return value;
}

export const ADMIN_SECTION_ROUTES: Record<AdminSection, string> = {
  sales: "/admin/vendas",
  inventory: "/admin/estoque",
  acquisitions: "/admin/aquisicoes",
  categories: "/admin/categorias",
  highlights: "/admin/destaques",
  analytics: "/admin/metricas",
  finances: "/admin/financas",
  users: "/admin/usuarios",
};
