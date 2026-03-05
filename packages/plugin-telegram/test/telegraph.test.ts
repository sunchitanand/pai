import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the Telegraph integration including the internal markdown-to-nodes
// conversion by inspecting the body sent to the Telegraph API via fetch mocks.

const mockLogger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as any;
const testAccount = { access_token: "tok", short_name: "PAI", author_name: "PAI" };

function mockFetchForPage() {
  let sentBody = "";
  vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opts?: { body?: string }) => {
    if (opts?.body) sentBody = opts.body;
    return Promise.resolve({
      json: () => Promise.resolve({ ok: true, result: { path: "p", url: "https://telegra.ph/p", title: "t" } }),
    });
  }));
  return () => sentBody;
}

describe("telegraph", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Account management ───────────────────────────────────────────

  it("getOrCreateAccount returns cached account", async () => {
    const mockStorage = {
      query: vi.fn().mockReturnValue([{ value: JSON.stringify(testAccount) }]),
      run: vi.fn(),
    };

    const { getOrCreateAccount } = await import("../src/telegraph.js");
    const account = await getOrCreateAccount(mockStorage as any, mockLogger);

    expect(account).toEqual(testAccount);
    expect(mockStorage.query).toHaveBeenCalledWith(
      "SELECT value FROM kv_store WHERE key = 'telegraph_account'",
    );
  });

  it("getOrCreateAccount creates new account when not cached", async () => {
    const mockStorage = {
      query: vi.fn().mockReturnValue([]),
      run: vi.fn(),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        result: { access_token: "new-token", short_name: "PersonalAI", author_name: "Personal AI" },
      }),
    }));

    const { getOrCreateAccount } = await import("../src/telegraph.js");
    const account = await getOrCreateAccount(mockStorage as any, mockLogger);

    expect(account?.access_token).toBe("new-token");
    expect(mockStorage.run).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('telegraph_account', ?)",
      expect.any(Array),
    );

    vi.unstubAllGlobals();
  });

  it("getOrCreateAccount creates kv_store table if missing", async () => {
    const mockStorage = {
      query: vi.fn().mockImplementation(() => { throw new Error("no such table"); }),
      run: vi.fn(),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        result: { access_token: "t", short_name: "P", author_name: "P" },
      }),
    }));

    const { getOrCreateAccount } = await import("../src/telegraph.js");
    const account = await getOrCreateAccount(mockStorage as any, mockLogger);

    expect(account?.access_token).toBe("t");
    // Should have tried to create the table
    expect(mockStorage.run).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );

    vi.unstubAllGlobals();
  });

  it("getOrCreateAccount returns null on API failure", async () => {
    const mockStorage = {
      query: vi.fn().mockReturnValue([]),
      run: vi.fn(),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: false, error: "bad request" }),
    }));

    const { getOrCreateAccount } = await import("../src/telegraph.js");
    const account = await getOrCreateAccount(mockStorage as any, mockLogger);

    expect(account).toBeNull();
    vi.unstubAllGlobals();
  });

  // ── Image upload ─────────────────────────────────────────────────

  it("uploadImage returns URL on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ src: "/file/abc123.png" }]),
    }));

    const { uploadImage } = await import("../src/telegraph.js");
    const url = await uploadImage(Buffer.from("fake"), "test.png", mockLogger);
    expect(url).toBe("https://telegra.ph/file/abc123.png");
    vi.unstubAllGlobals();
  });

  it("uploadImage returns null on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const { uploadImage } = await import("../src/telegraph.js");
    const url = await uploadImage(Buffer.from("fake"), "test.png", mockLogger);
    expect(url).toBeNull();
    vi.unstubAllGlobals();
  });

  it("uploadImage returns null when no src in response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{}]),
    }));

    const { uploadImage } = await import("../src/telegraph.js");
    const url = await uploadImage(Buffer.from("fake"), "test.png", mockLogger);
    expect(url).toBeNull();
    vi.unstubAllGlobals();
  });

  // ── Page creation with markdown conversion ───────────────────────

  it("createPage converts headings to h3/h4", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "# H1\n## H2\n### H3\n#### H4", [], mockLogger);

    const body = getBody();
    // H1-H3 become h3, H4+ become h4
    expect(body).toContain('"tag":"h3"');
    expect(body).toContain('"tag":"h4"');
    vi.unstubAllGlobals();
  });

  it("createPage converts lists", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "- Item 1\n- Item 2\n\n1. First\n2. Second", [], mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"ul"');
    expect(body).toContain('"tag":"ol"');
    expect(body).toContain('"tag":"li"');
    expect(body).toContain("Item 1");
    expect(body).toContain("First");
    vi.unstubAllGlobals();
  });

  it("createPage converts blockquotes", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "> This is a quote\n> Continued", [], mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"blockquote"');
    expect(body).toContain("This is a quote");
    vi.unstubAllGlobals();
  });

  it("createPage converts code blocks", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "```python\nprint('hello')\n```", [], mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"pre"');
    expect(body).toContain('"tag":"code"');
    expect(body).toContain("print('hello')");
    vi.unstubAllGlobals();
  });

  it("createPage converts horizontal rules", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "Text above\n\n---\n\nText below", [], mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"hr"');
    vi.unstubAllGlobals();
  });

  it("createPage converts inline formatting", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "This is **bold** and *italic* and `code` and ~~struck~~ and [link](https://example.com)", [], mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"b"');
    expect(body).toContain('"tag":"i"');
    expect(body).toContain('"tag":"code"');
    expect(body).toContain('"tag":"s"');
    expect(body).toContain('"tag":"a"');
    expect(body).toContain("https://example.com");
    vi.unstubAllGlobals();
  });

  it("createPage strips root-relative links", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "See [report](/api/artifacts/abc123)", [], mockLogger);

    const body = getBody();
    // Should contain the text but not the root-relative href
    expect(body).toContain("report");
    expect(body).not.toContain("/api/artifacts");
    vi.unstubAllGlobals();
  });

  it("createPage strips json and jsonrender blocks", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    const md = "# Report\n\nSummary text\n\n```json\n{\"ticker\":\"NVDA\"}\n```\n\n```jsonrender\n{\"root\":\"Section\"}\n```\n\nConclusion";
    await createPage(testAccount, "Report", md, [], mockLogger);

    const body = getBody();
    expect(body).not.toContain("ticker");
    expect(body).not.toContain("jsonrender");
    expect(body).toContain("Summary text");
    expect(body).toContain("Conclusion");
    vi.unstubAllGlobals();
  });

  it("createPage embeds images as figures", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    const images = [{ name: "chart.png", url: "https://telegra.ph/file/abc.png" }];
    await createPage(testAccount, "Test", "Some text", images, mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"figure"');
    expect(body).toContain('"tag":"img"');
    expect(body).toContain('"tag":"figcaption"');
    expect(body).toContain("chart.png");
    vi.unstubAllGlobals();
  });

  it("createPage returns null on API failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: false, error: "CONTENT_TOO_BIG" }),
    }));

    const { createPage } = await import("../src/telegraph.js");
    const page = await createPage(testAccount, "Test", "content", [], mockLogger);
    expect(page).toBeNull();
    vi.unstubAllGlobals();
  });

  it("createPage returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const { createPage } = await import("../src/telegraph.js");
    const page = await createPage(testAccount, "Test", "content", [], mockLogger);
    expect(page).toBeNull();
    vi.unstubAllGlobals();
  });

  it("createPage handles empty content", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "", [], mockLogger);

    const body = getBody();
    expect(body).toContain("No content available");
    vi.unstubAllGlobals();
  });

  it("createPage handles paragraphs spanning multiple lines", async () => {
    const getBody = mockFetchForPage();

    const { createPage } = await import("../src/telegraph.js");
    await createPage(testAccount, "Test", "Line one\nLine two\nLine three\n\nNew paragraph", [], mockLogger);

    const body = getBody();
    expect(body).toContain('"tag":"p"');
    expect(body).toContain("Line one Line two Line three");
    expect(body).toContain("New paragraph");
    vi.unstubAllGlobals();
  });
});
