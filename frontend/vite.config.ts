import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("codemirror")) {
            return "codemirror-vendor";
          }

          if (id.includes("@bytemd") || id.includes("bytemd")) {
            return "bytemd-vendor";
          }

          if (id.includes("react-markdown") || id.includes("remark") || id.includes("rehype") || id.includes("micromark") || id.includes("mdast") || id.includes("unist") || id.includes("hast")) {
            return "markdown-vendor";
          }
        },
      },
    },
  },
});
