import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), ".cookies", "instagram.json");
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
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;
  if (!username || !password) throw new Error("Instagram credentials not set in .env");

  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle" });
  await randomDelay(2000, 3000);

  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await randomDelay(500, 1000);
  await page.click('button[type="submit"]');

  await page.waitForURL("**/instagram.com/**", { timeout: 30_000 });
  await randomDelay(2000, 4000);

  // Handle "Save login info?" prompt
  const saveBtn = await page.$('button:has-text("Save Info"), button:has-text("Save info")');
  if (saveBtn) await saveBtn.click();
  await randomDelay(1000, 2000);

  // Handle notifications prompt
  const notNowBtn = await page.$('button:has-text("Not Now"), button:has-text("not now")');
  if (notNowBtn) await notNowBtn.click();
  await randomDelay(1000, 2000);
}

async function isLoggedIn(page) {
  await page.goto("https://www.instagram.com/", { waitUntil: "networkidle" });
  await randomDelay(2000, 3000);
  // Check if we're redirected to login
  return !page.url().includes("/accounts/login");
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

    const username = process.env.INSTAGRAM_USERNAME;
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle" });
    await randomDelay(3000, 5000);

    // Get recent post links (first 6)
    const postLinks = await page.$$eval('a[href*="/p/"]', links =>
      [...new Set(links.map(a => a.href))].slice(0, 6)
    );

    const comments = [];

    for (const postUrl of postLinks) {
      try {
        await page.goto(postUrl, { waitUntil: "networkidle" });
        await randomDelay(3000, 5000);

        // Get post caption for title
        const caption = await page.$eval(
          'h1, span[class*="caption"], div[class*="Caption"] span',
          el => el.textContent?.trim().slice(0, 50) || "Post"
        ).catch(() => "Post");

        // Load more comments if available
        const loadMoreBtn = await page.$('button:has-text("View all"), button:has-text("Load more")');
        if (loadMoreBtn) {
          await loadMoreBtn.click();
          await randomDelay(2000, 3000);
        }

        // Extract comments
        const postComments = await page.$$eval('ul ul li, div[class*="comment"]', elements =>
          elements.map(el => {
            const usernameEl = el.querySelector('a[href*="/"] span, a[class*="username"]');
            const textEl = el.querySelector('span:not([class*="username"]):not(:first-child)');
            const timeEl = el.querySelector('time');
            return {
              username: usernameEl?.textContent?.trim() || "",
              text: textEl?.textContent?.trim() || "",
              timestamp: timeEl?.getAttribute("datetime") || new Date().toISOString(),
            };
          }).filter(c => c.username && c.text)
        );

        for (const c of postComments) {
          comments.push({
            platform: "instagram",
            username: c.username,
            comment_text: c.text,
            post_title: caption,
            post_url: postUrl,
            comment_external_id: `ig:${c.username}:${c.text.slice(0, 30)}`,
            created_at: c.timestamp,
          });
        }
      } catch (err) {
        console.error(`Error scraping post ${postUrl}:`, err.message);
      }

      await randomDelay(3000, 5000);
    }

    await saveCookies(context);
    return comments;
  } finally {
    await browser.close();
  }
}

export async function postReply(commentData, replyText) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });

  try {
    await loadCookies(context);
    const page = await context.newPage();

    if (!(await isLoggedIn(page))) {
      await login(page);
      await saveCookies(context);
    }

    await page.goto(commentData.post_url, { waitUntil: "networkidle" });
    await randomDelay(3000, 5000);

    // Find the comment and click reply
    const commentElements = await page.$$('ul ul li, div[class*="comment"]');
    for (const el of commentElements) {
      const text = await el.textContent();
      if (text.includes(commentData.username) && text.includes(commentData.comment_text.slice(0, 20))) {
        const replyBtn = await el.$('button:has-text("Reply")');
        if (replyBtn) {
          await replyBtn.click();
          await randomDelay(1000, 2000);
          break;
        }
      }
    }

    // Type reply character by character
    const textarea = await page.$('textarea[aria-label*="comment" i], textarea[placeholder*="reply" i], textarea');
    if (textarea) {
      for (const char of replyText) {
        await textarea.type(char, { delay: 80 + Math.random() * 60 });
      }
      await randomDelay(500, 1000);

      // Submit
      const postBtn = await page.$('button:has-text("Post"), div[role="button"]:has-text("Post")');
      if (postBtn) await postBtn.click();
      await randomDelay(2000, 3000);
    }

    await saveCookies(context);
    return true;
  } catch (err) {
    console.error("Error posting Instagram reply:", err.message);
    return false;
  } finally {
    await browser.close();
  }
}
