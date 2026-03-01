import { supabase } from "./supabaseAdmin.js";
import { scrapeComments as scrapeInstagram } from "./platforms/instagram.js";
import { scrapeComments as scrapeThreads } from "./platforms/threads.js";
import { scrapeComments as scrapeX } from "./platforms/x.js";

const SPAM_KEYWORDS = [
  "follow4follow", "f4f", "follow me", "check out my page", "free followers",
  "dm for collab", "gain followers", "follow back", "followback", "s4s",
  "shoutout for shoutout", "like for like", "l4l", "check my profile",
  "click the link", "earn money", "make money fast", "crypto airdrop",
];

function isSpam(text) {
  const lower = text.toLowerCase();
  return SPAM_KEYWORDS.some(kw => lower.includes(kw));
}

async function deduplicateComments(comments) {
  // Check against last 7 days of existing comments
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("comments")
    .select("platform, username, comment_text")
    .gte("synced_at", sevenDaysAgo);

  const existingKeys = new Set(
    (existing || []).map(c => `${c.platform}:${c.username}:${c.comment_text}`)
  );

  return comments.filter(c =>
    !existingKeys.has(`${c.platform}:${c.username}:${c.comment_text}`)
  );
}

export async function scrapeAll() {
  const allComments = [];
  const allScrapers = [
    { name: "instagram", fn: scrapeInstagram },
    { name: "threads",   fn: scrapeThreads },
    { name: "x",         fn: scrapeX },
    // LinkedIn scraper not yet implemented — entry here so it's
    // recognized as a valid platform; will be skipped if fn is null.
    { name: "linkedin",  fn: null },
  ];

  // Only scrape enabled platforms (fall back to all if no rows exist)
  const { data: linkedAccounts } = await supabase
    .from("linked_accounts")
    .select("platform, enabled");

  const scrapers = linkedAccounts && linkedAccounts.length > 0
    ? allScrapers.filter(s => linkedAccounts.some(a => a.platform === s.name && a.enabled))
    : allScrapers;

  for (const { name, fn } of scrapers) {
    if (!fn) continue;
    try {
      console.log(`Scraping ${name}...`);
      const comments = await fn();
      console.log(`Found ${comments.length} comments on ${name}`);
      allComments.push(...comments);
    } catch (err) {
      console.error(`Error scraping ${name}:`, err.message);
    }
  }

  // Deduplicate
  const newComments = await deduplicateComments(allComments);
  console.log(`${newComments.length} new comments after deduplication`);

  // Insert with spam detection
  const inserted = [];
  for (const comment of newComments) {
    const status = isSpam(comment.comment_text)
      ? "hidden"
      : comment.forceFlag
        ? "flagged"
        : "pending";

    const { forceFlag, ...commentData } = comment;
    const { data, error } = await supabase
      .from("comments")
      .insert({ ...commentData, status })
      .select()
      .single();

    if (data) inserted.push(data);
    if (error) console.error(`Error inserting comment:`, error.message);
  }

  return inserted;
}
