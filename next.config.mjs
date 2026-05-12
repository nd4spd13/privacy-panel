/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native modules out of the webpack bundle
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent any client-side script from calling external AI APIs
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.privacypanel.org", // Next.js requires inline scripts in dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              // connect-src: only allow same-origin plus analytics — blocks fetch to api.anthropic.com etc.
              "connect-src 'self' https://analytics.privacypanel.org",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Prevent browser from caching API responses with sensitive data
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
      {
        // Allow embedding SVG labels (they're public disclosure, not sensitive)
        source: "/api/v1/company/:slug/label",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
