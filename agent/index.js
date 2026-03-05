import "dotenv/config";
import { supabase } from "./supabaseAdmin.js";
import { scrapeAll } from "./scraper.js";
import { generateRepliesForBatch, getVoiceWithDocuments, checkAgentAccess } from "./reply.js";

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

async function runPipeline() {
  console.log(`\n--- Sync run starting at ${new Date().toISOString()} ---`);

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
    // 0. Check agent feature access
    const access = await checkAgentAccess();
    if (!access.allowed) {
      console.log(`Agent skipped: ${access.reason}`);
      if (runId) {
        await supabase.from("agent_runs").update({
          completed_at: new Date().toISOString(),
          status: "skipped",
          error_message: access.reason,
        }).eq("id", runId);
      }
      return;
    }

    // 1. Scrape all platforms
    const newComments = await scrapeAll();
    const pendingComments = newComments.filter(c => c.status === "pending");
    const hiddenCount = newComments.filter(c => c.status === "hidden").length;

    // 2. Generate draft suggestions for pending comments
    const { voice, docContext } = await getVoiceWithDocuments();
    let replyResults = [];
    if (pendingComments.length > 0 && voice) {
      replyResults = await generateRepliesForBatch(pendingComments, voice, docContext, access.subscription);
    }

    const suggestionsGenerated = replyResults.filter(r => r.status === "flagged" || r.status === "flagged-retry").length;

    // 3. Update agent run
    if (runId) {
      await supabase.from("agent_runs").update({
        completed_at: new Date().toISOString(),
        comments_found: newComments.length,
        replies_sent: 0,
        flagged_count: suggestionsGenerated,
        platform: "all",
        status: "success",
      }).eq("id", runId);
    }

    console.log(`--- Run complete: ${newComments.length} found, ${suggestionsGenerated} suggestions generated ---`);
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
  console.log("EngageAI Sync starting...");

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
