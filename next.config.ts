import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "pdf-parse", "mammoth", "docx"],
};

export default nextConfig;
