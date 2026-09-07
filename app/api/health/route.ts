const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      status: "ok",
      version: APP_VERSION,
      services: { app: "ok" },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
