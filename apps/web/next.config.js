/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@worldnest/shared", "@worldnest/ui"],
};

module.exports = nextConfig;
