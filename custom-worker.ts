// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` exists only after the Cloudflare build.
import { default as handler } from "./.open-next/worker.js";

type UseMdrWorkerEnv = CloudflareEnv & {
  FINANCIAL_CRON_SECRET: string;
};

const OPTIMIZED_IMAGE_PATH = "/_next/image";
const OPTIMIZED_IMAGE_CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";
const OPTIMIZED_IMAGE_CACHE_NAME = "usemdr-optimized-images-v1";
const OPTIMIZED_IMAGE_QUERY_PARAMETERS = ["url", "w", "q"] as const;

function hasCanonicalOptimizedImageQuery(url: URL) {
  const keys = [...url.searchParams.keys()];
  return keys.length === OPTIMIZED_IMAGE_QUERY_PARAMETERS.length
    && OPTIMIZED_IMAGE_QUERY_PARAMETERS.every((parameter) => url.searchParams.getAll(parameter).length === 1);
}

function optimizedImageCacheKey(request: Request) {
  const requestUrl = new URL(request.url);
  const cacheUrl = new URL(OPTIMIZED_IMAGE_PATH, requestUrl.origin);
  for (const parameter of OPTIMIZED_IMAGE_QUERY_PARAMETERS) {
    cacheUrl.searchParams.set(parameter, requestUrl.searchParams.get(parameter) ?? "");
  }
  const acceptsWebp = request.headers.get("Accept")?.includes("image/webp") ?? false;
  cacheUrl.searchParams.set("__usemdr_format", acceptsWebp ? "webp" : "source");
  return new Request(cacheUrl, { method: "GET" });
}

async function fetchWithOptimizedImageCache(request: Request, env: UseMdrWorkerEnv, context: ExecutionContext) {
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.pathname !== OPTIMIZED_IMAGE_PATH) {
    return handler.fetch(request, env, context);
  }
  if (!hasCanonicalOptimizedImageQuery(requestUrl)) {
    return new Response("Invalid image request.", { status: 400 });
  }

  const imageCache = await caches.open(OPTIMIZED_IMAGE_CACHE_NAME);
  const cacheKey = optimizedImageCacheKey(request);
  const cachedResponse = await imageCache.match(cacheKey);
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, cachedResponse);
    response.headers.set("X-UseMdr-Image-Cache", "HIT");
    return response;
  }

  const response = await handler.fetch(request, env, context);
  if (!response.ok || !response.body) return response;

  const cacheableResponse = new Response(response.body, response);
  cacheableResponse.headers.set("Cache-Control", OPTIMIZED_IMAGE_CACHE_CONTROL);
  context.waitUntil(imageCache.put(cacheKey, cacheableResponse.clone()));
  cacheableResponse.headers.set("X-UseMdr-Image-Cache", "MISS");
  return cacheableResponse;
}

export default {
  fetch: fetchWithOptimizedImageCache,

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
