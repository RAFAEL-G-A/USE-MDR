"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AnalyticsEvent = "session_started" | "whatsapp_checkout";
type AnalyticsDetails = {
  cartItemCount?: number;
  cartTotal?: number;
};

type AnalyticsSession = {
  id: string;
  expiresAt: number;
  visitTracked: boolean;
};

const VISITOR_KEY = "usemdr.analytics.visitor";
const SESSION_KEY = "usemdr.analytics.session";
const SESSION_DURATION_MS = 30 * 60 * 1000;

function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) =>
    (Number(character) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(character) / 4).toString(16),
  );
}

function readSession(): AnalyticsSession {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as AnalyticsSession | null;
    if (saved?.id && saved.expiresAt > now) {
      const refreshed = { ...saved, expiresAt: now + SESSION_DURATION_MS };
      localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
      return refreshed;
    }
  } catch {
    // Um navegador que bloqueia armazenamento recebe uma sessão temporária.
  }

  const created = { id: randomId(), expiresAt: now + SESSION_DURATION_MS, visitTracked: false };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(created)); } catch { /* armazenamento indisponível */ }
  return created;
}

function visitorId() {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved) return saved;
    const created = randomId();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

function markVisitTracked(session: AnalyticsSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, visitTracked: true }));
  } catch {
    // A métrica continua opcional quando o armazenamento é bloqueado.
  }
}

export async function trackStoreEvent(eventType: AnalyticsEvent, details: AnalyticsDetails = {}) {
  if (process.env.NODE_ENV !== "production") return;

  const session = readSession();
  if (eventType === "session_started" && session.visitTracked) return;

  try {
    const { error } = await createSupabaseBrowserClient().functions.invoke("track-store-event", {
      body: {
        event_type: eventType,
        visitor_id: visitorId(),
        session_id: session.id,
        page_path: window.location.pathname,
        cart_item_count: details.cartItemCount,
        cart_total: details.cartTotal,
      },
    });
    if (!error && eventType === "session_started") markVisitTracked(session);
  } catch {
    // Métricas nunca devem bloquear a navegação ou a compra.
  }
}

export function StoreAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    void trackStoreEvent("session_started");
  }, [pathname]);

  return null;
}
