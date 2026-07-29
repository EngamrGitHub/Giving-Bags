import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

const withPwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // نخزن shell الصفحات المهمة عشان تفتح حتى من غير نت (البيانات نفسها بتتخزن في IndexedDB)
  fallbacks: {
    document: "/offline.html",
  },
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/api\/.*$/,
      handler: "NetworkOnly",
      options: {
        cacheName: "api-network-only",
      },
    },
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

export default withPwaConfig(nextConfig);
