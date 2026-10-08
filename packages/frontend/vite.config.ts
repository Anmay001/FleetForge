import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fleetforge/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});