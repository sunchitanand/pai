import { InputFile, InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import type { Storage, Logger } from "@personal-ai/core";
import { getArtifact, listArtifacts } from "@personal-ai/core";
import { markdownToTelegramHTML, splitMessage, escapeHTML, formatTelegramResponse } from "./formatter.js";
import { getOrCreateAccount, uploadImage, createPage } from "./telegraph.js";

function findChatIdForBriefing(storage: Storage, briefingId: string): number | null {
  let jobId: string | null = null;
  let table: string | null = null;

  if (briefingId.startsWith("research-")) {
    jobId = briefingId.slice("research-".length);
    table = "research_jobs";
  } else if (briefingId.startsWith("swarm-")) {
    jobId = briefingId.slice("swarm-".length);
    table = "swarm_jobs";
  }
  if (!jobId || !table) return null;

  try {
    const jobRow = storage.query<{ thread_id: string | null }>(
      `SELECT thread_id FROM ${table} WHERE id = ?`,
      [jobId],
    );
    const threadId = jobRow[0]?.thread_id;
    if (!threadId) return null;
    const chatRow = storage.query<{ chat_id: number }>(
      "SELECT chat_id FROM telegram_threads WHERE thread_id = ?",
      [threadId],
    );
    return chatRow[0]?.chat_id ?? null;
  } catch {
    return null;
  }
}

async function sendToTelegramChat(bot: Bot, chatId: number, html: string, logger: Logger): Promise<void> {
  const parts = splitMessage(html);
  try {
    for (const part of parts) {
      await bot.api.sendMessage(chatId, part, { parse_mode: "HTML" });
    }
  } catch (err) {
    logger.warn("Failed to send Telegram message", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Create a short preview (first ~500 chars) */
function makePreview(report: string, maxLen = 500): string {
  if (report.length <= maxLen) return report;
  const cutIdx = report.lastIndexOf("\n", maxLen);
  const sliced = cutIdx > maxLen * 0.3 ? report.slice(0, cutIdx) : report.slice(0, maxLen);
  return sliced.trimEnd();
}

async function checkAndPushResearch(storage: Storage, bot: Bot, logger: Logger): Promise<void> {
  try {
    const rows = storage.query<{ id: string; sections: string }>(
      "SELECT id, sections FROM briefings WHERE type = 'research' AND status = 'ready' AND telegram_sent_at IS NULL ORDER BY generated_at DESC LIMIT 5",
    );
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.sections) as { goal?: string; report?: string };
        if (!parsed.report) continue;
        const title = parsed.goal ?? "Report";
        const isSwarm = row.id.startsWith("swarm-");
        const emoji = isSwarm ? "\uD83D\uDC1D" : "\uD83D\uDD2C";
        const label = isSwarm ? "Swarm Report" : "Research Complete";
        const formattedReport = formatTelegramResponse(parsed.report);
        // Send to the originating Telegram chat, not all chats
        const chatId = findChatIdForBriefing(storage, row.id);
        if (chatId) {
          // Collect image artifacts for embedding in Telegraph
          const jobId = row.id.startsWith("research-") ? row.id.slice("research-".length)
            : row.id.startsWith("swarm-") ? row.id.slice("swarm-".length)
            : null;
          const telegraphImages: Array<{ name: string; url: string }> = [];
          if (jobId) {
            try {
              const artifacts = listArtifacts(storage, jobId);
              for (const meta of artifacts) {
                if (meta.mimeType.startsWith("image/")) {
                  const artifact = getArtifact(storage, meta.id);
                  if (artifact) {
                    const imgUrl = await uploadImage(artifact.data, meta.name, logger);
                    if (imgUrl) {
                      telegraphImages.push({ name: meta.name, url: imgUrl });
                    }
                  }
                }
              }
            } catch (err) {
              logger.warn("Failed to upload artifacts to Telegraph", { jobId, error: err instanceof Error ? err.message : String(err) });
            }
          }

          // Try to publish as Telegraph article (Instant View)
          let telegraphUrl: string | null = null;
          try {
            const account = await getOrCreateAccount(storage, logger);
            if (account) {
              const page = await createPage(account, title, parsed.report, telegraphImages, logger);
              if (page) {
                telegraphUrl = page.url;
              }
            }
          } catch (err) {
            logger.warn("Telegraph publish failed, falling back to text", { error: err instanceof Error ? err.message : String(err) });
          }

          // Send message with preview + Telegraph button (or fallback to text-only)
          const preview = makePreview(formattedReport);
          if (telegraphUrl) {
            const previewHtml = `${emoji} <b>${label}: ${escapeHTML(title)}</b>\n\n${markdownToTelegramHTML(preview)}`;
            const keyboard = new InlineKeyboard()
              .url("Read Full Report", telegraphUrl);
            const parts = splitMessage(previewHtml);
            try {
              // First part gets the keyboard button
              await bot.api.sendMessage(chatId, parts[0]!, { parse_mode: "HTML", reply_markup: keyboard });
              for (let pi = 1; pi < parts.length; pi++) {
                await bot.api.sendMessage(chatId, parts[pi]!, { parse_mode: "HTML" });
              }
            } catch {
              // Fallback: send without keyboard
              await sendToTelegramChat(bot, chatId, previewHtml, logger);
            }
            logger.info("Research report published to Telegraph", { briefingId: row.id, url: telegraphUrl });
          } else {
            // Fallback: send full report as text messages
            const fullHtml = `${emoji} <b>${label}: ${escapeHTML(title)}</b>\n\n${markdownToTelegramHTML(formattedReport)}`;
            await sendToTelegramChat(bot, chatId, fullHtml, logger);
            // Send image artifacts as documents if Telegraph upload failed
            if (jobId && telegraphImages.length === 0) {
              try {
                const artifacts = listArtifacts(storage, jobId);
                for (const meta of artifacts) {
                  if (meta.mimeType.startsWith("image/")) {
                    const artifact = getArtifact(storage, meta.id);
                    if (artifact) {
                      await bot.api.sendDocument(chatId, new InputFile(artifact.data, meta.name), {
                        caption: meta.name,
                      });
                    }
                  }
                }
              } catch (err) {
                logger.warn("Failed to send artifact documents", { jobId, error: err instanceof Error ? err.message : String(err) });
              }
            }
          }

          storage.run("UPDATE briefings SET telegram_sent_at = datetime('now') WHERE id = ?", [row.id]);
          logger.info("Research report pushed to Telegram", { briefingId: row.id, chatId });
        } else {
          // Mark as sent even without a chat, to avoid re-checking
          storage.run("UPDATE briefings SET telegram_sent_at = datetime('now') WHERE id = ?", [row.id]);
          logger.info("Research report ready (no originating Telegram chat)", { briefingId: row.id });
        }
      } catch { /* skip malformed entries */ }
    }
  } catch { /* ignore query errors during startup */ }
}

const DEFAULT_PUSH_INTERVAL_MS = 60 * 1000;

/**
 * Start a polling loop that checks for completed research reports
 * and pushes them to the originating Telegram chat.
 */
export function startResearchPushLoop(
  storage: Storage,
  bot: Bot,
  logger: Logger,
  intervalMs?: number,
): { stop(): void } {
  const ms = intervalMs ?? DEFAULT_PUSH_INTERVAL_MS;
  const timer = setInterval(() => {
    checkAndPushResearch(storage, bot, logger).catch(() => {});
  }, ms);
  return {
    stop() { clearInterval(timer); },
  };
}
