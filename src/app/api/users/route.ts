import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getUserFromRequest } from "@/lib/subscription";

const ADMIN_USER_ID = "9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0";

async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const userId = await getUserFromRequest(req);
  if (userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/users — list all users
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supabase = createServerClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.user_metadata?.display_name || null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));

  return NextResponse.json({ users });
}

// POST /api/users — create a new user
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { email, password, display_name } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: display_name ? { display_name } : undefined,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      display_name: data.user.user_metadata?.display_name || null,
      created_at: data.user.created_at,
    },
  });
}

// DELETE /api/users — delete a user
export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  if (userId === ADMIN_USER_ID) {
    return NextResponse.json({ error: "Cannot delete admin user" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
