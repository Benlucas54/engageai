import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), ".cookies", "x.json");
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function randomDelay(min = 3000, max = 5000) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function ensureCookiesDir() {
  const dir = path.dirname(COOKIES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loadCookies(context) {
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf-8"));
    await context.addCookies(cookies);
    return true;
  }
  return false;
}

async function saveCookies(context) {
  await ensureCookiesDir();
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
}

async function login(page) {
  const username = process.env.X_USERNAME;
  const password = process.env.X_PASSWORD;
  if (!username || !password) throw new Error("X credentials not set in .env");

  await page.goto("https://x.com/i/flow/login", { waitUntil: "networkidle" });
  await randomDelay(2000, 3000);

  // Enter username
  const usernameInput = await page.$('input[autocomplete="username"], input[name="text"]');
  if (usernameInput) {
    await usernameInput.fill(username);
    await randomDelay(500, 1000);
    const nextBtn = await page.$('div[role="button"]:has-text("Next"), button:has-text("Next")');
    if (nextBtn) await nextBtn.click();
    await randomDelay(2000, 3000);
  }

  // Enter password
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    await passwordInput.fill(password);
    await randomDelay(500, 1000);
    const loginBtn = await page.$('div[role="button"]:has-text("Log in"), button:has-text("Log in")');
    if (loginBtn) await loginBtn.click();
    await randomDelay(3000, 5000);
  }
}

async function isLoggedIn(page) {
  await page.goto("https://x.com/home", { waitUntil: "networkidle" });
  await randomDelay(2000, 3000);
  return !page.url().includes("/login") && !page.url().includes("/flow");
}

export async function scrapeComments() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });

  try {
    const hasCookies = await loadCookies(context);
    const page = await context.newPage();

    if (!hasCookies || !(await isLoggedIn(page))) {
      await login(page);
      await saveCookies(context);
    }

    // Navigate to notifications/mentions
    await page.goto("https://x.com/notifications/mentions", { waitUntil: "networkidle" });
    await randomDelay(3000, 5000);

    // Scroll to load more
    await page.evaluate(() => window.scrollBy(0, 1000));
    await randomDelay(2000, 3000);

    // Extract mention tweets/replies
    const comments = await page.$$eval(
      'article[data-testid="tweet"]',
      (tweets) => {
        return tweets.slice(0, 20).map(tweet => {
          const usernameEl = tweet.querySelector('div[data-testid="User-Name"] a[href*="/"]');
          const textEl = tweet.querySelector('div[data-testid="tweetText"]');
          const timeEl = tweet.querySelector('time');
          const linkEl = tweet.querySelector('a[href*="/status/"]');

          return {
            username: usernameEl?.textContent?.replace("@", "").trim() || "",
            text: textEl?.textContent?.trim() || "",
            timestamp: timeEl?.getAttribute("datetime") || new Date().toISOString(),
            postUrl: linkEl?.href || "",
          };
        }).filter(c => c.username && c.text);
      }
    );

    await saveCookies(context);

    // All X comments are flagged — monitor only
    return comments.map(c => ({
      platform: "x",
      username: c.username,
      comment_text: c.text,
      post_title: c.text.slice(0, 50),
      post_url: c.postUrl,
      comment_external_id: `x:${c.username}:${[...c.text].slice(0, 30).join("")}`,
      created_at: c.timestamp,
      forceFlag: true, // Signal to scraper.js that this should always be flagged
    }));
  } finally {
    await browser.close();
  }
}

export async function postReply() {
  throw new Error("X posting is disabled — monitor only mode");
}
