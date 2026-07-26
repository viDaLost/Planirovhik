import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const secretNames = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_IDS",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_PREMIUM_INVOICE_URL",
  "CRON_SECRET",
];

const secrets = Object.fromEntries(
  secretNames.flatMap((name) => {
    const value = process.env[name]?.trim();
    return value ? [[name, value]] : [];
  }),
);

const outputPath = resolve(
  process.argv[2] ?? ".wrangler/planirov-secrets.json",
);
await writeFile(outputPath, `${JSON.stringify(secrets)}\n`, { mode: 0o600 });

// The workflow reads only this numeric count. Secret values are never logged.
process.stdout.write(String(Object.keys(secrets).length));
