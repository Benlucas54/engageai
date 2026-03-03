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
     * - /login
     * - /auth/callback
     * - /api/telegram (webhook must remain public)
     * - /_next (Next.js internals)
     * - Static files (favicon, images, etc.)
     */
    "/((?!$|v2|login|auth/callback|api/telegram|api/generate-reply|api/tag-comments|api/summarize-profiles|api/enhance-voice|_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
