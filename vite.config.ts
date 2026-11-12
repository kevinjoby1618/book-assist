// @lovable.dev/vite-tanstack-config already includes the TanStack Start, React, Tailwind,
// Nitro, path aliases, and React/TanStack deduplication plugins used by this application.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
