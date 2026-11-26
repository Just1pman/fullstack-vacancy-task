import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";

const views = ["users-search", "user-form", "users-panel"];

const fragments = [
  {
    name: "icons",
    path: new URL("./src/icons/sprite.html", import.meta.url),
  },
  ...views.map((view) => ({
    name: view,
    path: new URL(`./src/views/${view}/${view}.html`, import.meta.url),
  })),
];

const fragmentPaths = new Set(
  fragments.map(({ path }) => normalizePath(fileURLToPath(path))),
);

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
      },
    },
  },
  plugins: [
    {
      name: "html-fragments",

      transformIndexHtml: {
        order: "pre",

        async handler(html) {
          for (const { name, path } of fragments) {
            const fragment = await readFile(path, "utf8");

            html = html.replace(
              `<!-- ${name} -->`,
              () => fragment,
            );
          }

          return html;
        },
      },

      hotUpdate({ file, type }) {
        if (type === "update" && this.environment.name === "client" && fragmentPaths.has(normalizePath(file))) {
          this.environment.hot.send({ type: "full-reload", path: "*" });
        }
      },
    },
  ],
});
