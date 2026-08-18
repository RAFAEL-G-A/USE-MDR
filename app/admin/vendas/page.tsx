import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminSales } from "@/components/admin-sales";

export const metadata: Metadata = {
  title: "Vendas | Administração USE MDR",
  robots: { index: false, follow: false },
};

export default function AdminSalesPage() {
  return <AdminAccessGate><AdminSales /></AdminAccessGate>;
}
