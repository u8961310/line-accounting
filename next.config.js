/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "pdf-parse"],
};

module.exports = nextConfig;
