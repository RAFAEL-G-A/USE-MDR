import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminEarnings } from "@/components/admin-earnings";

export const metadata: Metadata = {
  title: "Rendimentos | Administração USE MDR",
  robots: { index: false, follow: false },
};

export default function AdminEarningsPage() {
  return <AdminAccessGate><AdminEarnings /></AdminAccessGate>;
}
