import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const serverPort = Number(process.env.PORT ?? 3000);

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/@codemirror") ||
            id.includes("node_modules/@uiw/react-codemirror") ||
            id.includes("node_modules/@lezer")
          ) {
            return "codemirror";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${serverPort}`,
    },
  },
});
