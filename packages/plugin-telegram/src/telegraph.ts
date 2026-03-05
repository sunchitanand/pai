/**
 * Telegraph (telegra.ph) integration for publishing rich articles.
 * Articles open in Telegram's native Instant View — no browser needed.
 */

import type { Storage, Logger } from "@personal-ai/core";

const API_BASE = "https://api.telegra.ph";

interface TelegraphAccount {
  access_token: string;
  short_name: string;
  author_name: string;
}

interface TelegraphPage {
  path: string;
  url: string;
  title: string;
}

// Telegraph DOM node format
type TelegraphNode = string | {
  tag: string;
  attrs?: Record<string, string>;
  children?: TelegraphNode[];
};

// ── Account management ───────────────────────────────────────────────

/** Get or create a Telegraph account, cached in SQLite */
export async function getOrCreateAccount(storage: Storage, logger: Logger): Promise<TelegraphAccount | null> {
  // Check cache first
  try {
    const rows = storage.query<{ value: string }>(
      "SELECT value FROM kv_store WHERE key = 'telegraph_account'",
    );
    if (rows[0]?.value) {
      return JSON.parse(rows[0].value) as TelegraphAccount;
    }
  } catch {
    // Table may not exist yet — create it
    try {
      storage.run("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    } catch { /* ignore */ }
  }

  // Create new account
  try {
    const params = new URLSearchParams({
      short_name: "PersonalAI",
      author_name: "Personal AI",
    });
    const res = await fetch(`${API_BASE}/createAccount?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json() as { ok: boolean; result?: TelegraphAccount };
    if (!data.ok || !data.result?.access_token) {
      logger.warn("Telegraph createAccount failed", { data });
      return null;
    }

    const account = data.result;
    storage.run(
      "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('telegraph_account', ?)",
      [JSON.stringify(account)],
    );
    logger.info("Telegraph account created");
    return account;
  } catch (err) {
    logger.warn("Telegraph account creation failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ── Image upload ─────────────────────────────────────────────────────

/** Upload an image buffer to Telegraph, returns the src path */
export async function uploadImage(data: Buffer, filename: string, logger: Logger): Promise<string | null> {
  try {
    const formData = new FormData();
    const blob = new Blob([data], { type: "image/png" });
    formData.append("file", blob, filename);

    const res = await fetch("https://telegra.ph/upload", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });
    const result = await res.json() as Array<{ src?: string }>;
    if (result[0]?.src) {
      return `https://telegra.ph${result[0].src}`;
    }
    return null;
  } catch (err) {
    logger.warn("Telegraph image upload failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ── Page creation ────────────────────────────────────────────────────

/** Create a Telegraph page from markdown content */
export async function createPage(
  account: TelegraphAccount,
  title: string,
  markdown: string,
  images: Array<{ name: string; url: string }>,
  logger: Logger,
): Promise<TelegraphPage | null> {
  try {
    const content = markdownToNodes(markdown, images);

    // Telegraph content limit is 64KB
    const contentStr = JSON.stringify(content);
    if (contentStr.length > 60_000) {
      // Truncate content to fit
      const truncated = markdownToNodes(
        markdown.slice(0, Math.floor(markdown.length * (58_000 / contentStr.length))),
        images,
      );
      return await postPage(account, title, truncated, logger);
    }

    return await postPage(account, title, content, logger);
  } catch (err) {
    logger.warn("Telegraph page creation failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function postPage(
  account: TelegraphAccount,
  title: string,
  content: TelegraphNode[],
  logger: Logger,
): Promise<TelegraphPage | null> {
  const res = await fetch(`${API_BASE}/createPage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: account.access_token,
      title: title.slice(0, 256),
      author_name: account.author_name,
      content,
      return_content: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json() as { ok: boolean; result?: TelegraphPage; error?: string };
  if (!data.ok || !data.result) {
    logger.warn("Telegraph createPage failed", { error: data.error });
    return null;
  }

  return data.result;
}

// ── Markdown → Telegraph nodes ───────────────────────────────────────

/**
 * Convert markdown to Telegraph node format.
 * Supported Telegraph tags: a, aside, b, blockquote, br, code, em,
 * figcaption, figure, h3, h4, hr, i, img, li, ol, p, pre, s, strong, u, ul
 */
function markdownToNodes(md: string, images: Array<{ name: string; url: string }>): TelegraphNode[] {
  const nodes: TelegraphNode[] = [];

  // Strip jsonrender blocks
  const cleaned = md.replace(/```jsonrender\s*[\s\S]*?```/g, "");
  // Strip json blocks and replace with nothing (they're structured data)
  const stripped = cleaned.replace(/```json\s*[\s\S]*?```/g, "");
  const cleanLines = stripped.split("\n");

  let i = 0;
  while (i < cleanLines.length) {
    const line = cleanLines[i]!;

    // Code blocks
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < cleanLines.length && !cleanLines[i]!.startsWith("```")) {
        codeLines.push(cleanLines[i]!);
        i++;
      }
      i++; // skip closing ```
      const codeText = codeLines.join("\n");
      if (codeText.trim()) {
        nodes.push({ tag: "pre", children: [{ tag: "code", attrs: lang ? { class: `language-${lang}` } : undefined, children: [codeText] }] });
      }
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headers — Telegraph only has h3 and h4
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1]!.length;
      const text = headerMatch[2]!;
      const tag = level <= 3 ? "h3" : "h4";
      nodes.push({ tag, children: parseInline(text) });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      nodes.push({ tag: "hr" });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < cleanLines.length && cleanLines[i]!.startsWith("> ")) {
        quoteLines.push(cleanLines[i]!.slice(2));
        i++;
      }
      nodes.push({ tag: "blockquote", children: [{ tag: "p", children: parseInline(quoteLines.join("\n")) }] });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: TelegraphNode[] = [];
      while (i < cleanLines.length && /^[-*+]\s+/.test(cleanLines[i]!)) {
        items.push({ tag: "li", children: parseInline(cleanLines[i]!.replace(/^[-*+]\s+/, "")) });
        i++;
      }
      nodes.push({ tag: "ul", children: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: TelegraphNode[] = [];
      while (i < cleanLines.length && /^\d+\.\s+/.test(cleanLines[i]!)) {
        items.push({ tag: "li", children: parseInline(cleanLines[i]!.replace(/^\d+\.\s+/, "")) });
        i++;
      }
      nodes.push({ tag: "ol", children: items });
      continue;
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [line];
    i++;
    while (
      i < cleanLines.length &&
      cleanLines[i]!.trim() &&
      !cleanLines[i]!.startsWith("#") &&
      !cleanLines[i]!.startsWith("```") &&
      !cleanLines[i]!.startsWith("> ") &&
      !/^[-*+]\s+/.test(cleanLines[i]!) &&
      !/^\d+\.\s+/.test(cleanLines[i]!) &&
      !/^[-*_]{3,}\s*$/.test(cleanLines[i]!)
    ) {
      paraLines.push(cleanLines[i]!);
      i++;
    }
    nodes.push({ tag: "p", children: parseInline(paraLines.join(" ")) });
  }

  // Append images at the end as figures
  for (const img of images) {
    nodes.push({
      tag: "figure",
      children: [
        { tag: "img", attrs: { src: img.url } },
        { tag: "figcaption", children: [img.name] },
      ],
    });
  }

  return nodes.length > 0 ? nodes : [{ tag: "p", children: ["No content available."] }];
}

/** Parse inline markdown (bold, italic, code, links, strikethrough) */
function parseInline(text: string): TelegraphNode[] {
  const nodes: TelegraphNode[] = [];
  // Simple regex-based inline parser
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const m = match[0];
    if (m.startsWith("`")) {
      nodes.push({ tag: "code", children: [m.slice(1, -1)] });
    } else if (m.startsWith("**") || m.startsWith("__")) {
      nodes.push({ tag: "b", children: [m.slice(2, -2)] });
    } else if (m.startsWith("~~")) {
      nodes.push({ tag: "s", children: [m.slice(2, -2)] });
    } else if (m.startsWith("*") || m.startsWith("_")) {
      nodes.push({ tag: "i", children: [m.slice(1, -1)] });
    } else if (m.startsWith("[")) {
      const linkMatch = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const href = linkMatch[2]!;
        // Skip root-relative links (they don't work on Telegraph)
        if (href.startsWith("/")) {
          nodes.push(linkMatch[1]!);
        } else {
          nodes.push({ tag: "a", attrs: { href }, children: [linkMatch[1]!] });
        }
      }
    }

    lastIndex = match.index + m.length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
