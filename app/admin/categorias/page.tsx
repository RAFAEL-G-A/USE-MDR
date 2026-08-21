import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminCategoriesManager } from "@/components/admin-categories-manager";

export const metadata: Metadata = { title: "Categorias | Administração USE MDR", robots: { index: false, follow: false } };

export default function AdminCategoriesPage() {
  return <AdminAccessGate><AdminCategoriesManager /></AdminAccessGate>;
}
