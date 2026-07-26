import { env } from "cloudflare:workers";

type RuntimeEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_IDS?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_PREMIUM_INVOICE_URL?: string;
  CRON_SECRET?: string;
};

export function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}
