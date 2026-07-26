import { runtimeEnv } from "@/lib/runtime-env";
import { getRequestSession } from "@/lib/server-auth";

export async function GET(request: Request) {
  const session = await getRequestSession(request).catch(() => null);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invoiceUrl = runtimeEnv().TELEGRAM_PREMIUM_INVOICE_URL;
  if (!invoiceUrl) {
    return Response.json(
      {
        error:
          "Premium checkout is not configured. Add TELEGRAM_PREMIUM_INVOICE_URL.",
      },
      { status: 503 },
    );
  }
  return Response.json({ invoiceUrl });
}
