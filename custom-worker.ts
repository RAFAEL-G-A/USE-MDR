// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` exists only after the Cloudflare build.
import { default as handler } from "./.open-next/worker.js";

type UseMdrWorkerEnv = CloudflareEnv & {
  FINANCIAL_CRON_SECRET: string;
};

export default {
  fetch: handler.fetch,

  async scheduled(_event, env, context) {
    const reportRequest = fetch(`${env.SUPABASE_URL}/functions/v1/run-financial-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": env.FINANCIAL_CRON_SECRET },
      body: JSON.stringify({ source: "cloudflare-cron" }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Financial report job failed with status ${response.status}.`);
    });
    context.waitUntil(reportRequest);
  },
} satisfies ExportedHandler<UseMdrWorkerEnv>;
