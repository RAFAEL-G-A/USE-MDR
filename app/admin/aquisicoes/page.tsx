import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminAcquisitions } from "@/components/admin-acquisitions";

export const metadata: Metadata = { title: "Aquisições | Administração USE MDR", robots: { index: false, follow: false } };

export default function AcquisitionsPage() {
  return <AdminAccessGate section="acquisitions"><AdminAcquisitions /></AdminAccessGate>;
}
