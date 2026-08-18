import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.2";
import { dueFinancialPeriods, type FinancialPeriod as Period, type ReportType } from "../_shared/financial-periods.ts";

type Metrics = Record<string, unknown> & {
  gross_revenue?: number; received_revenue?: number; cost_of_goods?: number; gross_profit?: number;
  expenses?: number; net_profit?: number; orders?: number; average_ticket?: number;
  payments?: Record<string, { amount?: number; sales?: number }>;
  top_selling_products?: Array<{ product_name?: string; quantity?: number; revenue?: number }>;
  previous_metrics?: Metrics;
  sale_corrections?: Array<{ sale_date?: string; previous_total?: number; corrected_total?: number; difference?: number; reason?: string; corrected_at?: string }>;
};

function money(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character] ?? character));
}

function reportLabel(type: ReportType) {
  return type === "daily" ? "diário" : type === "weekly" ? "semanal" : "mensal";
}

function comparison(current: unknown, previous: unknown) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (!previousValue) return currentValue ? "+100,0%" : "0,0%";
  const percent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1).replace(".", ",")}%`;
}

function buildEmail(type: ReportType, start: string, end: string, metrics: Metrics) {
  const payments = metrics.payments ?? {};
  const card = Number(payments.card?.amount ?? 0);
  const products = metrics.top_selling_products ?? [];
  const previous = metrics.previous_metrics ?? {};
  const corrections = metrics.sale_corrections ?? [];
  const range = start === end
    ? new Date(`${start}T12:00:00`).toLocaleDateString("pt-BR")
    : `${new Date(`${start}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${end}T12:00:00`).toLocaleDateString("pt-BR")}`;
  const rows = [
    ["Faturamento", money(metrics.gross_revenue)], ["Vendas", String(Number(metrics.orders) || 0)],
    ["Dinheiro", money(payments.cash?.amount)], ["Pix", money(payments.pix?.amount)], ["Cartões", money(card)],
    ["Custos", money(metrics.cost_of_goods)], ["Despesas", money(metrics.expenses)],
    ["Lucro bruto", money(metrics.gross_profit)], ["Lucro líquido", money(metrics.net_profit)],
    ["Ticket médio", money(metrics.average_ticket)],
  ];
  const productHtml = products.length
    ? products.map((product, index) => `<tr><td style="padding:10px 0;border-bottom:1px solid #ffd7e5">${index + 1}. ${escapeHtml(product.product_name)}</td><td style="padding:10px 0;border-bottom:1px solid #ffd7e5;text-align:right;font-weight:700">${Number(product.quantity) || 0} un.</td></tr>`).join("")
    : `<tr><td style="padding:12px 0;color:#75686d">Nenhum produto vendido no período.</td></tr>`;
  const correctionRows = corrections.map((correction) => {
    const saleDate = correction.sale_date ? new Date(`${correction.sale_date}T12:00:00`).toLocaleDateString("pt-BR") : "data não informada";
    const time = correction.corrected_at ? new Date(correction.corrected_at).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" }) : "--:--";
    return `<div style="padding:12px 0;border-bottom:1px solid #fde68a"><strong>Venda de ${escapeHtml(saleDate)}:</strong> ${money(correction.previous_total)} corrigida às ${escapeHtml(time)} para <strong>${money(correction.corrected_total)}</strong><div style="margin-top:4px;color:#75686d;font-size:12px">${escapeHtml(correction.reason)}</div></div>`;
  }).join("");
  const correctionHtml = corrections.length ? `<div style="margin:24px 0;padding:16px;border:1px solid #fde68a;border-radius:18px;background:#fffbeb"><div style="font-size:12px;font-weight:700;color:#92400e">CORREÇÕES DE VENDAS</div>${correctionRows}</div>` : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fff9fb;font-family:Arial,sans-serif;color:#2b2326"><div style="max-width:640px;margin:0 auto;padding:24px 14px"><div style="background:#ffeaf1;border:1px solid #ffd7e5;border-radius:28px 28px 0 0;padding:28px;text-align:center"><div style="font-family:Georgia,serif;font-size:34px;font-weight:700;color:#e91e63">USE MDR</div><div style="margin-top:7px;font-size:11px;font-weight:700;letter-spacing:3px;color:#d91e62">RELATÓRIO ${reportLabel(type).toUpperCase()}</div></div><div style="background:#fff;border:1px solid #ffd7e5;border-top:0;border-radius:0 0 28px 28px;padding:26px"><p style="margin:0;color:#75686d;font-size:13px">Período comercial</p><h1 style="margin:7px 0 24px;font-family:Georgia,serif;font-size:26px">${range}</h1><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:11px 0;border-bottom:1px solid #ffeaf1;color:#75686d">${label}</td><td style="padding:11px 0;border-bottom:1px solid #ffeaf1;text-align:right;font-weight:700">${value}</td></tr>`).join("")}</table><div style="margin:24px 0;padding:16px;border-radius:18px;background:#ffeaf1"><div style="font-size:12px;font-weight:700;color:#d91e62">COMPARAÇÃO COM O PERÍODO ANTERIOR</div><div style="margin-top:8px;font-size:22px;font-weight:700">Faturamento ${comparison(metrics.gross_revenue, previous.gross_revenue)}</div><div style="margin-top:5px;color:#75686d;font-size:13px">Lucro líquido ${comparison(metrics.net_profit, previous.net_profit)}</div></div>${correctionHtml}<h2 style="font-family:Georgia,serif;font-size:22px">Produtos em destaque</h2><table style="width:100%;border-collapse:collapse">${productHtml}</table><p style="margin:26px 0 0;color:#75686d;font-size:11px;line-height:1.6">Fechamento gerado automaticamente no horário de Pernambuco. Este e-mail contém informações administrativas confidenciais.</p></div></div></body></html>`;
  const correctionText = corrections.map((correction) => `Venda de ${correction.sale_date}: ${money(correction.previous_total)} corrigida para ${money(correction.corrected_total)} (${correction.reason ?? "sem motivo"})`).join("\n");
  const text = `USE MDR — Relatório ${reportLabel(type)}\n${range}\nFaturamento: ${money(metrics.gross_revenue)}\nVendas: ${Number(metrics.orders) || 0}\nDinheiro: ${money(payments.cash?.amount)}\nPix: ${money(payments.pix?.amount)}\nCartões: ${money(card)}\nCustos: ${money(metrics.cost_of_goods)}\nDespesas: ${money(metrics.expenses)}\nLucro bruto: ${money(metrics.gross_profit)}\nLucro líquido: ${money(metrics.net_profit)}\nTicket médio: ${money(metrics.average_ticket)}${correctionText ? `\n\nCORREÇÕES DE VENDAS\n${correctionText}` : ""}`;
  return { html, text, range };
}

async function sendEmail(input: { apiKey: string; from: string; to: string; subject: string; html: string; text: string; idempotencyKey: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ from: input.from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
  });
  if (!response.ok) throw new Error(`O provedor de e-mail respondeu com status ${response.status}.`);
}

async function processPeriod(client: SupabaseClient, period: Period, settings: Record<string, unknown>, email: { apiKey: string; from: string; to: string }) {
  const enabled = settings[`${period.type}_enabled`] === true;
  if (!enabled) return { type: period.type, status: "disabled" };
  const jobKey = `${period.type}:${period.start}:${period.end}`;
  const { data: existing } = await client.from("financial_job_runs").select("id, status, attempts, started_at").eq("job_key", jobKey).maybeSingle();
  if (existing?.status === "completed") return { type: period.type, status: "already_completed" };
  if (existing?.status === "processing" && Date.now() - new Date(existing.started_at).getTime() < 15 * 60_000) return { type: period.type, status: "already_processing" };

  let jobId = existing?.id as string | undefined;
  if (jobId) {
    const { error } = await client.from("financial_job_runs").update({ status: "processing", attempts: Number(existing.attempts) + 1, started_at: new Date().toISOString(), completed_at: null, error_message: null, updated_at: new Date().toISOString() }).eq("id", jobId);
    if (error) throw error;
  } else {
    const { data, error } = await client.from("financial_job_runs").insert({ job_key: jobKey, job_type: period.type, period_start: period.start, period_end: period.end }).select("id").single();
    if (error) {
      if (error.code === "23505") return { type: period.type, status: "claimed_by_another_run" };
      throw error;
    }
    jobId = data.id;
  }

  try {
    const { data: closureData, error: closureError } = await client.rpc("create_financial_closure", { p_period_type: period.type, p_period_start: period.start, p_period_end: period.end, p_generated_by: null });
    if (closureError) throw closureError;
    const closure = Array.isArray(closureData) ? closureData[0] : closureData;
    const metrics = closure.metrics as Metrics;
    const content = buildEmail(period.type, period.start, period.end, metrics);
    await sendEmail({ ...email, subject: `USE MDR — Fechamento ${reportLabel(period.type)} (${content.range})`, html: content.html, text: content.text, idempotencyKey: `use-mdr-${jobKey}` });
    await Promise.all([
      client.from("financial_closures").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", closure.id),
      client.from("financial_job_runs").update({ status: "completed", closure_id: closure.id, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId),
    ]);
    return { type: period.type, status: "sent", closure_id: closure.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no relatório financeiro.";
    await client.from("financial_job_runs").update({ status: "failed", error_message: message.slice(0, 1000), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { "Content-Type": "application/json" } });
  const expectedSecret = Deno.env.get("FINANCIAL_CRON_SECRET");
  const suppliedSecret = request.headers.get("x-cron-secret");
  if (!expectedSecret || expectedSecret.length < 32 || suppliedSecret !== expectedSecret) return new Response(JSON.stringify({ error: "Acesso não autorizado." }), { status: 401, headers: { "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM");
    if (!supabaseUrl || !serviceRoleKey || !apiKey || !from) throw new Error("A rotina financeira não foi configurada.");
    const client = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: settings, error } = await client.from("financial_report_settings").select("recipient_email, daily_enabled, weekly_enabled, monthly_enabled").eq("id", 1).single();
    if (error) throw error;
    if (!settings.recipient_email) return new Response(JSON.stringify({ ok: true, status: "recipient_not_configured" }), { headers: { "Content-Type": "application/json" } });
    const results = [];
    for (const period of dueFinancialPeriods()) results.push(await processPeriod(client, period, settings, { apiKey, from, to: settings.recipient_email }));
    return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar os relatórios.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
