import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { config } from "dotenv";

// Load env from root project's .env.local
const rootEnv = config({ path: resolve(__dirname, "../.env.local") }).parsed || {};

const SUPABASE_URL = rootEnv.NEXT_PUBLIC_SUPABASE_URL || rootEnv.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = rootEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || rootEnv.SUPABASE_ANON_KEY || "";
const API_URL = rootEnv.API_URL || "http://localhost:3000";

// Replaces `import ws from "ws"` with the native WebSocket
function wsShimPlugin(): Plugin {
  return {
    name: "ws-shim",
    resolveId(source) {
      if (source === "ws") return "\0ws-shim";
      return null;
    },
    load(id) {
      if (id === "\0ws-shim") return "export default WebSocket;";
      return null;
    },
  };
}

const sharedDefine = {
  "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
  "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(SUPABASE_ANON_KEY),
  "import.meta.env.VITE_API_URL": JSON.stringify(API_URL),
  "process.env": {},
  "process.version": JSON.stringify(""),
  "process.platform": JSON.stringify("browser"),
  "process.arch": JSON.stringify(""),
  "process.emit": "undefined",
};

// Two-pass build: service worker (single file) + everything else (ES modules)
export default defineConfig(({ mode }) => {
  const isServiceWorker = mode === "service-worker";

  if (isServiceWorker) {
    return {
      plugins: [wsShimPlugin()],
      define: sharedDefine,
      build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, "src/background/service-worker.ts"),
          name: "serviceWorker",
          formats: ["es"],
          fileName: () => "service-worker.js",
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  return {
    plugins: [react(), wsShimPlugin()],
    define: sharedDefine,
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "src/popup/index.html"),
          "content-instagram": resolve(__dirname, "src/content-scripts/instagram.ts"),
          "content-threads": resolve(__dirname, "src/content-scripts/threads.ts"),
          "content-x": resolve(__dirname, "src/content-scripts/x.ts"),
          "content-linkedin": resolve(__dirname, "src/content-scripts/linkedin.ts"),
          "content-tiktok": resolve(__dirname, "src/content-scripts/tiktok.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
});
