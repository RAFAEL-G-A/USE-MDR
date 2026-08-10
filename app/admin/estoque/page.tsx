import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminInventoryManager } from "@/components/admin-inventory-manager";

export const metadata: Metadata = { title: "Gerenciar estoque | Administração USE MDR", robots: { index: false, follow: false } };

export default function AdminInventoryPage() {
  return <AdminAccessGate><AdminInventoryManager /></AdminAccessGate>;
}
