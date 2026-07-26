import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const outputPath = resolve(process.argv[2] ?? "wrangler.jsonc");
const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const databaseId = required("CLOUDFLARE_D1_DATABASE_ID");
const workerName =
  process.env.CLOUDFLARE_WORKER_NAME?.trim() || "planirov";
const databaseName =
  process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "planirov";

const config = {
  $schema: "node_modules/wrangler/config-schema.json",
  name: workerName,
  account_id: accountId,
  compatibility_date: "2026-07-26",
  compatibility_flags: ["nodejs_compat"],
  main: "dist/server/index.js",
  assets: {
    directory: "dist/client",
    binding: "ASSETS",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: databaseId,
      migrations_dir: "drizzle",
    },
  ],
  observability: {
    enabled: true,
  },
};

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, {
  mode: 0o600,
});

console.log(`Created deploy configuration: ${outputPath}`);
