import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminUsers } from "@/components/admin-users";

export const metadata: Metadata = { title: "Usuários | Administração USE MDR", robots: { index: false, follow: false } };

export default function UsersPage() {
  return <AdminAccessGate section="users"><AdminUsers /></AdminAccessGate>;
}
