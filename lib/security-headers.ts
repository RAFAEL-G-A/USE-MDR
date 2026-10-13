type SecurityHeaderOptions = {
  isDevelopment: boolean;
  isProduction: boolean;
};

export function createSecurityHeaders({ isDevelopment, isProduction }: SecurityHeaderOptions) {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com https://*.cloudflareinsights.com",
    "media-src 'self' https://*.supabase.co",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ...(isProduction
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}
