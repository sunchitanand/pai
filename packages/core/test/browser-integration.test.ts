/**
 * Integration test: spins up a real HTTP server that mimics the Pinchtab API,
 * then exercises the browser client functions against it.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import {
  resolveBrowserUrl,
  browserHealth,
  browserNavigate,
  browserSnapshot,
  browserAction,
  browserText,
  browserScreenshot,
} from "../src/browser.js";

let server: Server;
let baseUrl: string;

function mockLogger() {
  return { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost`);

    // Health
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    // Navigate
    if (req.method === "POST" && url.pathname === "/navigate") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ url: parsed.url, title: "Mock Page — " + parsed.url }));
      });
      return;
    }

    // Snapshot
    if (req.method === "GET" && url.pathname === "/snapshot") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end('[1] <button>Submit</button>\n[2] <input type="text" name="q" />\n[3] <a href="/about">About</a>');
      return;
    }

    // Action
    if (req.method === "POST" && url.pathname === "/action") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: `${parsed.kind} on ${parsed.ref || "page"}` }));
      });
      return;
    }

    // Text
    if (req.method === "GET" && url.pathname === "/text") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Welcome to the mock page.\n\nThis is paragraph one.\nThis is paragraph two.");
      return;
    }

    // Screenshot
    if (req.method === "GET" && url.pathname === "/screenshot") {
      // Return a tiny fake PNG header
      const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(fakePng);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()!;
      baseUrl = typeof addr === "string" ? addr : `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("browser integration (mock server)", () => {
  it("health returns ok:true against live server", async () => {
    const result = await browserHealth(baseUrl);
    expect(result).toEqual({ ok: true });
  });

  it("navigate sends POST and returns title+url", async () => {
    const result = await browserNavigate("https://example.com", {}, mockLogger(), baseUrl);
    expect(result.url).toBe("https://example.com");
    expect(result.title).toContain("Mock Page");
  });

  it("snapshot returns interactive elements text", async () => {
    const result = await browserSnapshot(mockLogger(), baseUrl);
    expect(result).toContain("[1]");
    expect(result).toContain("<button>");
    expect(result).toContain("<input");
  });

  it("action sends POST with kind and ref", async () => {
    const result = await browserAction({ kind: "click", ref: "[1]" }, mockLogger(), baseUrl);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("click");
    expect(result.message).toContain("[1]");
  });

  it("action type sends text", async () => {
    const result = await browserAction({ kind: "type", ref: "[2]", text: "hello" }, mockLogger(), baseUrl);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("type");
  });

  it("text returns page content", async () => {
    const result = await browserText(mockLogger(), baseUrl);
    expect(result).toContain("Welcome to the mock page");
    expect(result).toContain("paragraph one");
  });

  it("screenshot returns a buffer with PNG-like data", async () => {
    const result = await browserScreenshot(undefined, mockLogger(), baseUrl);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Check PNG magic bytes
    expect(result[0]).toBe(0x89);
    expect(result[1]).toBe(0x50); // P
    expect(result[2]).toBe(0x4e); // N
    expect(result[3]).toBe(0x47); // G
  });

  it("health returns ok:false for bad URL", async () => {
    const result = await browserHealth("http://127.0.0.1:1");
    expect(result).toEqual({ ok: false });
  });

  it("navigate throws for unreachable server", async () => {
    await expect(
      browserNavigate("https://example.com", {}, mockLogger(), "http://127.0.0.1:1"),
    ).rejects.toThrow("Cannot reach browser");
  });

  it("resolveBrowserUrl returns configUrl when provided", () => {
    expect(resolveBrowserUrl(baseUrl)).toBe(baseUrl);
  });
});
