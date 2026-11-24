import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
execFileSync(
  process.execPath,
  [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"],
  {
    cwd: new URL("../", import.meta.url),
    stdio: "inherit",
  }
);
await import("./copy-assets.mjs");
await import("../dist/server/index.js");
