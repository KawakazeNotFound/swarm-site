import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localBlog } from "./plugins/LocalBlog.js";

export default defineConfig({
  base: "./",
  plugins: [react(), localBlog()],
});
