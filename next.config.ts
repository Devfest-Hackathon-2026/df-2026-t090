import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "*.cloudshell.dev",
    "3000-cs-64ecbbd7-f4a6-4701-8190-e6af0d766ec7.cs-asia-east1-duck.cloudshell.dev",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
