import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1'],
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
