import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminFinances } from "@/components/admin-finances";

export const metadata: Metadata = {
  title: "Finanças | Administração USE MDR",
  robots: { index: false, follow: false },
};

export default function AdminFinancesPage() {
  return <AdminAccessGate><AdminFinances /></AdminAccessGate>;
}
