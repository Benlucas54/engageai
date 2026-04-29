import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PRESET_TAGS = [
  {
    key: "purchase_intent",
    label: "Purchase Intent",
    description: "Expressing interest in buying, pricing, services, or wanting to work together",
    color_bg: "#ecfdf5",
    color_text: "#065f46",
    color_border: "#a7f3d0",
    sort_order: 0,
  },
  {
    key: "complaint",
    label: "Complaint",
    description: "Negative feedback, frustration, criticism, or reporting an issue",
    color_bg: "#fef2f2",
    color_text: "#991b1b",
    color_border: "#fecaca",
    sort_order: 1,
  },
  {
    key: "question",
    label: "Question",
    description: "Asking a question, seeking information or advice",
    color_bg: "#eff6ff",
    color_text: "#1e40af",
    color_border: "#bfdbfe",
    sort_order: 2,
  },
  {
    key: "compliment",
    label: "Compliment",
    description: "Praise, appreciation, positive feedback, or encouragement",
    color_bg: "#fffbeb",
    color_text: "#92400e",
    color_border: "#fde68a",
    sort_order: 3,
  },
  {
    key: "other",
    label: "Other",
    description: "Anything that doesn't clearly fit the above categories",
    color_bg: "#f4f4f5",
    color_text: "#3f3f46",
    color_border: "#d4d4d8",
    sort_order: 4,
  },
];

async function seedPresets(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const rows = PRESET_TAGS.map((t) => ({
    ...t,
    user_id: userId,
    is_preset: true,
    enabled: true,
  }));
  const { data, error } = await supabase
    .from("smart_tags")
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("smart_tags")
      .select("*")
      .eq("user_id", auth.userId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      const seeded = await seedPresets(supabase, auth.userId);
      return NextResponse.json(seeded);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[smart-tags] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch smart tags" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { key, label, description, color_bg, color_text, color_border } = body;

    if (!label) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }

    const tagKey = key || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("smart_tags")
      .select("sort_order")
      .eq("user_id", auth.userId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from("smart_tags")
      .insert({
        user_id: auth.userId,
        key: tagKey,
        label,
        description: description || "",
        color_bg,
        color_text,
        color_border,
        is_preset: false,
        enabled: true,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[smart-tags] POST error:", err);
    return NextResponse.json({ error: "Failed to create smart tag" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const supabase = createServerClient();

    if (body.reorder) {
      const updates = body.reorder as { id: string; sort_order: number }[];
      for (const u of updates) {
        await supabase
          .from("smart_tags")
          .update({ sort_order: u.sort_order })
          .eq("id", u.id)
          .eq("user_id", auth.userId);
      }
      return NextResponse.json({ success: true });
    }

    const { id, ...fields } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const allowed = ["label", "description", "color_bg", "color_text", "color_border", "enabled", "sort_order"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (fields[k] !== undefined) update[k] = fields[k];
    }

    const { data, error } = await supabase
      .from("smart_tags")
      .update(update)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[smart-tags] PUT error:", err);
    return NextResponse.json({ error: "Failed to update smart tag" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: tag } = await supabase
      .from("smart_tags")
      .select("is_preset, key, user_id")
      .eq("id", id)
      .single();

    if (!tag || tag.user_id !== auth.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (tag.is_preset) {
      const { data, error } = await supabase
        .from("smart_tags")
        .update({ enabled: false })
        .eq("id", id)
        .eq("user_id", auth.userId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    // Null out smart_tag on this user's comments only
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", auth.userId);
    const profileIds = (profileRows ?? []).map((p) => p.id as string);
    if (profileIds.length > 0) {
      await supabase
        .from("comments")
        .update({ smart_tag: null })
        .eq("smart_tag", tag.key)
        .in("profile_id", profileIds);
    }

    const { error } = await supabase
      .from("smart_tags")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[smart-tags] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete smart tag" }, { status: 500 });
  }
}
