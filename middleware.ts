import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddleware } from "@/lib/supabase-middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddleware(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - / (landing page)
     * - /v2, /beta, /pricing (marketing pages)
     * - /login, /auth/callback
     * - /api/* (API routes handle their own auth)
     * - /_next (Next.js internals)
     * - Static files (favicon, images, etc.)
     */
    "/((?!$|v2|beta|login|auth/callback|pricing|api/|_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
