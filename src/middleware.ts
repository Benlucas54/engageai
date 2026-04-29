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
    // Auth-gated dashboard surface. Marketing pages (/, /v2, /beta, /privacy,
    // /terms, /cookies, /acceptable-use, /pricing, /login) and /api stay
    // public; the API routes do their own per-request auth.
    "/dashboard/:path*",
    "/inbox/:path*",
    "/feed/:path*",
    "/outbound/:path*",
    "/customers/:path*",
    "/automations/:path*",
    "/voice/:path*",
    "/settings/:path*",
    "/usage/:path*",
    "/users/:path*",
    "/setup/:path*",
    "/api/:path*",
  ],
};
