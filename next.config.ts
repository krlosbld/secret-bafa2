import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // force Next à considérer CE dossier comme root
    root: path.resolve(__dirname),
  },
};

export default nextConfig;