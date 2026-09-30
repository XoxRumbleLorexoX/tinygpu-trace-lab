import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/tinygpu-trace-lab/",
  optimizeDeps: { include: ["vcd-parser"] },
  resolve: {
    alias: {
      "@tinygpu-trace-lab/simulator": new URL(
        "../simulator/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  build: {
    sourcemap: true,
  },
});
