import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getUserFromRequest } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const platform = req.nextUrl.searchParams.get("platform");

  let query = supabase
    .from("outbound_posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { platform, post_url, post_author, post_caption, source } = body;

  if (!platform || !post_url) {
    return NextResponse.json(
      { error: "Missing platform or post_url" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("outbound_posts")
    .upsert(
      {
        user_id: userId,
        platform,
        post_url,
        post_author: post_author || null,
        post_caption: post_caption || null,
        source: source || "manual",
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,post_url" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, post_url, ...updates } = body;

  if (!id && !post_url) {
    return NextResponse.json({ error: "Missing id or post_url" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (updates.status !== undefined) allowed.status = updates.status;
  if (updates.generated_comment !== undefined) allowed.generated_comment = updates.generated_comment;
  if (updates.generated_at !== undefined) allowed.generated_at = updates.generated_at;
  if (updates.post_caption !== undefined) allowed.post_caption = updates.post_caption;
  allowed.updated_at = new Date().toISOString();

  const supabase = createServerClient();

  let query = supabase
    .from("outbound_posts")
    .update(allowed as never)
    .eq("user_id", userId);

  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.eq("post_url", post_url);
  }

  const { data, error } = await query
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from("outbound_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
