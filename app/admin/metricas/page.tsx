import type { Metadata } from "next";
import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminAnalytics } from "@/components/admin-analytics";

export const metadata: Metadata = {
  title: "Métricas | Administração USE MDR",
  robots: { index: false, follow: false },
};

export default function AdminAnalyticsPage() {
  return <AdminAccessGate><AdminAnalytics /></AdminAccessGate>;
}
