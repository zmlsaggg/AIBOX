import { defineConfig } from "vite";

// Electron loads the production build through file:// rather than an HTTP origin.
// Relative asset URLs are required so renderer scripts and styles resolve inside the packaged EXE.
// This also remains compatible with Capacitor's local Android web server.
export default defineConfig({
  base: "./",
});
