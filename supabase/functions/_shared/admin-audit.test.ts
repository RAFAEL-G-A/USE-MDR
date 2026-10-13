import { writeAdminAudit } from "./admin-audit.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("falha ao gravar auditoria nao interrompe a operacao administrativa", async () => {
  const context = {
    adminClient: {
      from: () => ({
        insert: async () => ({ error: new Error("database unavailable") }),
      }),
    },
    sessionId: "session-local",
    user: { id: "00000000-0000-0000-0000-000000000001" },
  };
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const result = await writeAdminAudit(
      new Request("http://localhost", { headers: { "x-request-id": "request-local" } }),
      context as never,
      {
        action: "create_product",
        resourceType: "product",
        result: "success",
      },
    );

    assert(result === false, "a falha de auditoria deve ser convertida em false");
  } finally {
    console.error = originalConsoleError;
  }
});

Deno.test("auditoria remove segredos e limita strings antes da insercao", async () => {
  let inserted: Record<string, unknown> | undefined;
  const context = {
    adminClient: {
      from: () => ({
        insert: async (payload: Record<string, unknown>) => {
          inserted = payload;
          return { error: null };
        },
      }),
    },
    sessionId: "session-local",
    user: { id: "00000000-0000-0000-0000-000000000001" },
  };

  const result = await writeAdminAudit(
    new Request("http://localhost"),
    context as never,
    {
      action: "create_product",
      resourceType: "product",
      result: "success",
      metadata: { token: "nao-pode-entrar", note: "x".repeat(400) },
    },
  );

  const metadata = inserted?.metadata as Record<string, unknown> | undefined;
  assert(result === true, "a insercao bem-sucedida deve retornar true");
  assert(metadata?.token === undefined, "token deve ser removido");
  assert((metadata?.note as string).length === 300, "strings devem ser limitadas");
});
