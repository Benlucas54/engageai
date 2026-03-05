import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddleware } from "@/lib/supabase-middleware";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

export async function middleware(request: NextRequest) {
  // Handle CORS preflight for API routes
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    request.method === "OPTIONS"
  ) {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Add CORS headers to all API responses
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

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
     * - /_next (Next.js internals)
     * - Static files (favicon, images, etc.)
     */
    "/((?!$|v2|beta|login|auth/callback|pricing|_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
