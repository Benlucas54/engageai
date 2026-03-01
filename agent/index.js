import "dotenv/config";
import { supabase } from "./supabaseAdmin.js";
import { scrapeAll } from "./scraper.js";
import { generateRepliesForBatch, getVoiceWithDocuments } from "./reply.js";
import { startBot, notifyFlagged, notifySummary } from "./notifier.js";
import { postReply as postInstagramReply } from "./platforms/instagram.js";
import { postReply as postThreadsReply } from "./platforms/threads.js";

const ONCE = process.argv.includes("--once");
const MIN_INTERVAL = 55 * 60 * 1000; // 55 minutes
const MAX_INTERVAL = 75 * 60 * 1000; // 75 minutes
const CONCURRENT_GUARD_MS = 30 * 60 * 1000; // 30 minutes

function randomInterval() {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

async function isConcurrentRunning() {
  const cutoff = new Date(Date.now() - CONCURRENT_GUARD_MS).toISOString();
  const { data } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", cutoff)
    .limit(1);
  return data && data.length > 0;
}

async function postApprovedReplies() {
  // Find approved but unsent replies
  const { data: replies } = await supabase
    .from("replies")
    .select("*, comments(*)")
    .eq("approved", true)
    .is("sent_at", null);

  if (!replies || replies.length === 0) return 0;

  let sentCount = 0;

  for (const reply of replies) {
    const comment = reply.comments;
    if (!comment || !comment.post_url) continue;

    let success = false;

    try {
      if (comment.platform === "instagram") {
        success = await postInstagramReply(comment, reply.draft_text || reply.reply_text);
      } else if (comment.platform === "threads") {
        success = await postThreadsReply(comment, reply.draft_text || reply.reply_text);
      } else if (comment.platform === "x") {
        console.log(`Skipping X reply for comment ${comment.id} — posting disabled`);
        continue;
      }
    } catch (err) {
      console.error(`Error posting reply to ${comment.platform}:`, err.message);
    }

    if (success) {
      await supabase.from("replies").update({ sent_at: new Date().toISOString() }).eq("id", reply.id);
      await supabase.from("comments").update({ status: "replied" }).eq("id", comment.id);
      sentCount++;
    }
  }

  return sentCount;
}

async function runPipeline() {
  console.log(`\n--- Agent run starting at ${new Date().toISOString()} ---`);

  // Concurrent run guard
  if (await isConcurrentRunning()) {
    console.log("Another run is in progress, skipping");
    return;
  }

  // Create agent run record
  const { data: run } = await supabase
    .from("agent_runs")
    .insert({ status: "running" })
    .select()
    .single();

  const runId = run?.id;

  try {
    // 1. Scrape all platforms
    const newComments = await scrapeAll();
    const pendingComments = newComments.filter(c => c.status === "pending");
    const flaggedFromScrape = newComments.filter(c => c.status === "flagged");
    const hiddenCount = newComments.filter(c => c.status === "hidden").length;

    // 2. Generate replies for pending comments
    const { voice, docContext } = await getVoiceWithDocuments();
    let replyResults = [];
    if (pendingComments.length > 0 && voice) {
      replyResults = await generateRepliesForBatch(pendingComments, voice, docContext);
    }

    // 3. Post approved auto-replies
    const autoSent = await postApprovedReplies();

    // 4. Send Telegram notifications for flagged comments
    const allFlagged = [
      ...flaggedFromScrape,
      ...replyResults.filter(r => r.status === "flagged" || r.status === "flagged-retry"),
    ];

    for (const flagged of allFlagged) {
      const { data: comment } = await supabase
        .from("comments")
        .select("*, replies(*)")
        .eq("id", flagged.id)
        .single();

      if (comment) {
        const draftReply = comment.replies?.[0]?.draft_text || comment.replies?.[0]?.reply_text || "";
        await notifyFlagged(comment, draftReply);
      }
    }

    // 5. Summary notification
    const stats = {
      commentsFound: newComments.length,
      repliesSent: autoSent,
      flaggedCount: allFlagged.length,
      hiddenCount,
    };
    await notifySummary(stats);

    // 6. Update agent run
    if (runId) {
      await supabase.from("agent_runs").update({
        completed_at: new Date().toISOString(),
        comments_found: newComments.length,
        replies_sent: autoSent,
        flagged_count: allFlagged.length,
        platform: "all",
        status: "success",
      }).eq("id", runId);
    }

    console.log(`--- Run complete: ${newComments.length} found, ${autoSent} sent, ${allFlagged.length} flagged ---`);
  } catch (err) {
    console.error("Pipeline error:", err);
    if (runId) {
      await supabase.from("agent_runs").update({
        completed_at: new Date().toISOString(),
        status: "error",
        error_message: err.message,
      }).eq("id", runId);
    }
  }
}

// Entry point
async function main() {
  console.log("EngageAI Agent starting...");

  // Start Telegram bot (runs in background)
  startBot();

  if (ONCE) {
    await runPipeline();
    process.exit(0);
  }

  // Run immediately, then schedule with jitter
  await runPipeline();

  function scheduleNext() {
    const delay = randomInterval();
    console.log(`Next run in ${Math.round(delay / 60000)} minutes`);
    setTimeout(async () => {
      await runPipeline();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
