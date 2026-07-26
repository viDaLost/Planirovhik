import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import {
  clearSessionCookie,
  getRequestSession,
} from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return Response.json({ user: null }, { status: 401 });
    }
    return Response.json(
      {
        user: {
          id: session.userId,
          displayName: session.displayName,
          username: session.username,
          plan: session.plan,
          planExpiresAt: session.planExpiresAt,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ user: null }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request).catch(() => null);
  if (session) {
    await getDb().delete(sessions).where(eq(sessions.id, session.sessionId));
  }
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": clearSessionCookie(request.url) },
  });
}
