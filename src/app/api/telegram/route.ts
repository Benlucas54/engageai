import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Webhook receiver for Telegram bot updates
  // Process incoming messages/commands from Telegram
  console.log("Telegram webhook received:", JSON.stringify(body));

  return NextResponse.json({ ok: true });
}
