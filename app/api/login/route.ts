import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const ok = !!process.env.DASHBOARD_PASSWORD && form.get("password") === process.env.DASHBOARD_PASSWORD;
  const res = NextResponse.redirect(new URL(ok ? "/" : "/login?error=1", request.url), 303);
  if (ok) {
    res.cookies.set(SESSION_COOKIE, sessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
