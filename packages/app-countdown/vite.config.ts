import { resolve } from "path";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import { createViteConfig } from "../../scripts/create-vite-config";

const configFn = defineConfig(options => {
  const config = createViteConfig({ entry: resolve("./src/index.tsx") })(options) as UserConfig;
  config.plugins = [];
  Object.assign(config, {
    esbuild: {
      jsxFactory: "h",
      jsxFragment: "Fragment",
    },
  });
  return config;
});

export default configFn;
