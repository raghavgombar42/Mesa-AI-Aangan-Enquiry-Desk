import { NextResponse, type NextRequest } from "next/server";
import { passwordEnabled, SESSION_COOKIE, sessionToken } from "./lib/auth";

export function proxy(request: NextRequest) {
  if (!passwordEnabled()) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value === sessionToken()) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

// Webhooks and agent tools carry their own secrets (Vaani HMAC signature, Telegram secret token, bearer tokens).
export const config = {
  matcher: ["/((?!login|api/login|api/vaani|api/telegram|api/calls|api/tools|_next/static|_next/image|favicon.ico).*)"],
};
