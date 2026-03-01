import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), ".cookies", "threads.json");
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
  // Threads uses Instagram login
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;
  if (!username || !password) throw new Error("Instagram credentials not set in .env (used for Threads login)");

  await page.goto("https://www.threads.net/login", { waitUntil: "networkidle" });
  await randomDelay(2000, 3000);

  // Threads may redirect to Instagram login
  if (page.url().includes("instagram.com")) {
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await randomDelay(500, 1000);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/{threads,instagram}.{net,com}/**", { timeout: 30_000 });
  } else {
    // Direct Threads login
    const usernameInput = await page.$('input[type="text"], input[name="username"]');
    const passwordInput = await page.$('input[type="password"]');
    if (usernameInput && passwordInput) {
      await usernameInput.fill(username);
      await passwordInput.fill(password);
      await randomDelay(500, 1000);
      const loginBtn = await page.$('button[type="submit"], div[role="button"]:has-text("Log in")');
      if (loginBtn) await loginBtn.click();
      await randomDelay(3000, 5000);
    }
  }

  await randomDelay(2000, 4000);

  // Handle notifications prompt
  const notNowBtn = await page.$('button:has-text("Not Now"), button:has-text("not now")');
  if (notNowBtn) await notNowBtn.click();
  await randomDelay(1000, 2000);
}

async function isLoggedIn(page) {
  await page.goto("https://www.threads.net/", { waitUntil: "networkidle" });
  await randomDelay(2000, 3000);
  return !page.url().includes("/login");
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
    await page.goto(`https://www.threads.net/@${username}`, { waitUntil: "networkidle" });
    await randomDelay(3000, 5000);

    // Get recent thread post links (first 6)
    const postLinks = await page.$$eval('a[href*="/post/"]', links =>
      [...new Set(links.map(a => a.href))].slice(0, 6)
    );

    const comments = [];

    for (const postUrl of postLinks) {
      try {
        await page.goto(postUrl, { waitUntil: "networkidle" });
        await randomDelay(3000, 5000);

        // Get the original post text as title
        const postText = await page.$eval(
          'div[data-pressable-container="true"] span, div[class*="text"] span',
          el => el.textContent?.trim().slice(0, 50) || "Thread"
        ).catch(() => "Thread");

        // Extract replies/comments (threads shows them below the main post)
        const postComments = await page.$$eval(
          'div[data-pressable-container="true"]',
          (elements) => {
            // Skip the first element (the original post)
            return elements.slice(1).map(el => {
              const usernameEl = el.querySelector('a[href*="/@"] span, span[class*="username"]');
              const textEl = el.querySelector('div[class*="text"] span, span[dir="auto"]');
              const timeEl = el.querySelector('time');
              return {
                username: usernameEl?.textContent?.trim().replace("@", "") || "",
                text: textEl?.textContent?.trim() || "",
                timestamp: timeEl?.getAttribute("datetime") || new Date().toISOString(),
              };
            }).filter(c => c.username && c.text);
          }
        );

        for (const c of postComments) {
          comments.push({
            platform: "threads",
            username: c.username,
            comment_text: c.text,
            post_title: postText,
            post_url: postUrl,
            comment_external_id: `th:${c.username}:${c.text.slice(0, 30)}`,
            created_at: c.timestamp,
          });
        }
      } catch (err) {
        console.error(`Error scraping Threads post ${postUrl}:`, err.message);
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

    // Find the reply input area
    const replyArea = await page.$('div[contenteditable="true"], textarea[placeholder*="Reply"], div[role="textbox"]');
    if (replyArea) {
      await replyArea.click();
      await randomDelay(500, 1000);

      // Type character by character
      for (const char of replyText) {
        await replyArea.type(char, { delay: 80 + Math.random() * 60 });
      }
      await randomDelay(500, 1000);

      // Submit
      const postBtn = await page.$('div[role="button"]:has-text("Post"), button:has-text("Post"), button:has-text("Reply")');
      if (postBtn) await postBtn.click();
      await randomDelay(2000, 3000);
    }

    await saveCookies(context);
    return true;
  } catch (err) {
    console.error("Error posting Threads reply:", err.message);
    return false;
  } finally {
    await browser.close();
  }
}
