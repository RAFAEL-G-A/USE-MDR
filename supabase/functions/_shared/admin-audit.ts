import type { AdminContext } from "./admin-auth.ts";
import { requestId } from "./admin-auth.ts";

export type AdminAuditAction =
  | "admin_verification_success"
  | "admin_verification_failure"
  | "create_product"
  | "update_product"
  | "delete_product"
  | "stock_change"
  | "create_sale"
  | "update_sale"
  | "delete_sale"
  | "financial_change"
  | "hero_change"
  | "category_change"
  | "image_change";

type AuditMetadataValue = boolean | number | string | null;

type AdminAuditEntry = {
  action: AdminAuditAction;
  resourceType: string;
  resourceId?: string | null;
  result: "success" | "failure";
  metadata?: Record<string, AuditMetadataValue>;
};

const SENSITIVE_METADATA_KEY = /password|otp|code|token|authorization|secret|service[_-]?role|pepper|credential/i;

function safeMetadata(metadata: AdminAuditEntry["metadata"]) {
  const entries = Object.entries(metadata ?? {})
    .filter(([key]) => !SENSITIVE_METADATA_KEY.test(key))
    .slice(0, 20)
    .map(([key, value]) => [
      key.slice(0, 80),
      typeof value === "string" ? value.slice(0, 300) : value,
    ]);
  return Object.fromEntries(entries);
}

export async function writeAdminAudit(
  request: Request,
  context: AdminContext,
  entry: AdminAuditEntry,
) {
  try {
    const { error } = await context.adminClient.from("admin_audit_logs").insert({
      user_id: context.user.id,
      session_id: context.sessionId.slice(0, 200),
      request_id: requestId(request),
      action: entry.action,
      resource_type: entry.resourceType.slice(0, 80),
      resource_id: entry.resourceId?.slice(0, 200) || null,
      result: entry.result,
      metadata: safeMetadata(entry.metadata),
    });
    if (error) throw error;
    return true;
  } catch {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      request_id: requestId(request),
      function: "admin-audit",
      status: "failed",
      error: "audit_insert_failed",
    }));
    return false;
  }
}
