/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/favicon" }];
  },
  async redirects() {
    return [
      { source: "/login/", destination: "/login", permanent: false },
      { source: "/signup/", destination: "/signup", permanent: false },
    ];
  },
};

module.exports = nextConfig;
