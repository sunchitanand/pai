import { describe, it, expect } from "vitest";
import { specToStaticHtml } from "../src/spec-to-html.js";

function spec(root: string, elements: Record<string, unknown>) {
  return { root, elements };
}

describe("specToStaticHtml", () => {
  it("returns null for non-object input", () => {
    expect(specToStaticHtml(null)).toBeNull();
    expect(specToStaticHtml("string")).toBeNull();
    expect(specToStaticHtml(42)).toBeNull();
    expect(specToStaticHtml(undefined)).toBeNull();
  });

  it("returns null for missing root or elements", () => {
    expect(specToStaticHtml({ elements: {} })).toBeNull();
    expect(specToStaticHtml({ root: "x" })).toBeNull();
    expect(specToStaticHtml({ root: 123, elements: {} })).toBeNull();
  });

  it("returns empty string for missing root element", () => {
    expect(specToStaticHtml(spec("missing", {}))).toBe("");
  });

  it("renders Section with title", () => {
    const html = specToStaticHtml(spec("s", {
      s: { type: "Section", props: { title: "Hello" }, children: [] },
    }));
    expect(html).toContain("Hello");
    expect(html).toContain("<h3");
  });

  it("renders Section with subtitle", () => {
    const html = specToStaticHtml(spec("s", {
      s: { type: "Section", props: { title: "T", subtitle: "Sub" }, children: [] },
    }));
    expect(html).toContain("Sub");
  });

  it("renders MetricCard", () => {
    const html = specToStaticHtml(spec("m", {
      m: { type: "MetricCard", props: { label: "Revenue", value: "$1M", trend: "up", description: "YoY" } },
    }));
    expect(html).toContain("Revenue");
    expect(html).toContain("$1M");
    expect(html).toContain("&#x2191;"); // up arrow
    expect(html).toContain("YoY");
  });

  it("renders MetricCard with down/neutral trends", () => {
    const down = specToStaticHtml(spec("m", {
      m: { type: "MetricCard", props: { label: "L", value: "V", trend: "down" } },
    }));
    expect(down).toContain("&#x2193;");

    const neutral = specToStaticHtml(spec("m", {
      m: { type: "MetricCard", props: { label: "L", value: "V", trend: "neutral" } },
    }));
    expect(neutral).toContain("&#x2212;");
  });

  it("renders MetricCard with unit", () => {
    const html = specToStaticHtml(spec("m", {
      m: { type: "MetricCard", props: { label: "L", value: "42", unit: "ms" } },
    }));
    expect(html).toContain("ms");
  });

  it("renders Grid with columns", () => {
    const html = specToStaticHtml(spec("g", {
      g: { type: "Grid", props: { columns: 2, gap: "sm" }, children: [] },
    }));
    expect(html).toContain("grid-template-columns:repeat(2,1fr)");
    expect(html).toContain("12px"); // sm gap
  });

  it("renders Stack", () => {
    const html = specToStaticHtml(spec("s", {
      s: { type: "Stack", props: { direction: "horizontal", gap: "lg", wrap: true }, children: [] },
    }));
    expect(html).toContain("flex-direction:row");
    expect(html).toContain("32px"); // lg gap
    expect(html).toContain("flex-wrap:wrap");
  });

  it("renders DataTable", () => {
    const html = specToStaticHtml(spec("t", {
      t: {
        type: "DataTable",
        props: {
          columns: [{ key: "name", label: "Name" }, { key: "val", label: "Value", align: "right" }],
          rows: [{ name: "Alpha", val: "100" }, { name: "Beta", val: "200" }],
        },
      },
    }));
    expect(html).toContain("<table");
    expect(html).toContain("Name");
    expect(html).toContain("Alpha");
    expect(html).toContain("200");
    expect(html).toContain("text-align:right");
  });

  it("renders DataTable with string columns", () => {
    const html = specToStaticHtml(spec("t", {
      t: { type: "DataTable", props: { columns: ["a", "b"], rows: [{ a: "1", b: "2" }] } },
    }));
    expect(html).toContain("<th");
    expect(html).toContain("1");
  });

  it("renders Badge variants", () => {
    for (const variant of ["success", "warning", "danger", "info", "neutral"]) {
      const html = specToStaticHtml(spec("b", {
        b: { type: "Badge", props: { text: "Tag", variant } },
      }));
      expect(html).toContain("Tag");
    }
  });

  it("renders Badge with unknown variant as neutral", () => {
    const html = specToStaticHtml(spec("b", {
      b: { type: "Badge", props: { text: "X", variant: "unknown" } },
    }));
    expect(html).toContain("#f3f4f6"); // neutral bg
  });

  it("renders ProgressBar", () => {
    const html = specToStaticHtml(spec("p", {
      p: { type: "ProgressBar", props: { value: 60, max: 100, label: "Progress", variant: "success" } },
    }));
    expect(html).toContain("60%");
    expect(html).toContain("Progress");
    expect(html).toContain("#22c55e"); // success color
  });

  it("renders Heading levels", () => {
    const h1 = specToStaticHtml(spec("h", { h: { type: "Heading", props: { text: "H1", level: "1" } } }));
    expect(h1).toContain("<h2");
    const h3 = specToStaticHtml(spec("h", { h: { type: "Heading", props: { text: "H3", level: "3" } } }));
    expect(h3).toContain("<h4");
  });

  it("renders Text variants", () => {
    const body = specToStaticHtml(spec("t", { t: { type: "Text", props: { content: "Hello", variant: "body" } } }));
    expect(body).toContain("Hello");
    const caption = specToStaticHtml(spec("t", { t: { type: "Text", props: { content: "C", variant: "caption" } } }));
    expect(caption).toContain("0.8em");
  });

  it("renders Markdown", () => {
    const html = specToStaticHtml(spec("m", { m: { type: "Markdown", props: { content: "**bold**" } } }));
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders BulletList with icons", () => {
    const html = specToStaticHtml(spec("l", {
      l: { type: "BulletList", props: { items: ["Item 1", "Item 2"], icon: "check", variant: "success" } },
    }));
    expect(html).toContain("Item 1");
    expect(html).toContain("Item 2");
    expect(html).toContain("\u2713"); // check mark
  });

  it("renders BulletList warning icon", () => {
    const html = specToStaticHtml(spec("l", {
      l: { type: "BulletList", props: { items: ["Warn"], icon: "warning" } },
    }));
    expect(html).toContain("\u26A0");
  });

  it("renders LinkButton", () => {
    const html = specToStaticHtml(spec("l", {
      l: { type: "LinkButton", props: { text: "Click", url: "https://example.com" } },
    }));
    expect(html).toContain("Click");
    expect(html).toContain("https://example.com");
    expect(html).toContain("<a ");
  });

  it("renders SourceList", () => {
    const html = specToStaticHtml(spec("s", {
      s: { type: "SourceList", props: { sources: [{ title: "Src", url: "https://x.com" }] } },
    }));
    expect(html).toContain("[1]");
    expect(html).toContain("Src");
    expect(html).toContain("https://x.com");
  });

  it("renders ChartImage", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "ChartImage", props: { src: "/api/artifacts/abc", alt: "Chart", caption: "Fig 1" } },
    }));
    expect(html).toContain("/api/artifacts/abc");
    expect(html).toContain("Chart");
    expect(html).toContain("Fig 1");
  });

  it("uses resolveImageSrc option for ChartImage", () => {
    const html = specToStaticHtml(
      spec("c", { c: { type: "ChartImage", props: { src: "/api/artifacts/xyz" } } }),
      { resolveImageSrc: (src) => src.replace("/api/artifacts/xyz", "data:image/png;base64,AAA") },
    );
    expect(html).toContain("data:image/png;base64,AAA");
  });

  it("renders LineChart with valid data", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "LineChart", props: { labels: ["A", "B", "C"], values: [10, 20, 15], title: "Trend" } },
    }));
    expect(html).toContain("<svg");
    expect(html).toContain("Trend");
    expect(html).toContain("A");
  });

  it("renders LineChart empty state for missing data", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "LineChart", props: { labels: [], values: [] } },
    }));
    expect(html).toContain("unavailable");
  });

  it("renders LineChart with area", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "LineChart", props: { labels: ["A", "B"], values: [10, 20], showArea: true } },
    }));
    expect(html).toContain("opacity=\"0.12\"");
  });

  it("renders BarChart", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "BarChart", props: { data: [{ label: "X", value: 50 }, { label: "Y", value: 30 }], title: "Bars" } },
    }));
    expect(html).toContain("<svg");
    expect(html).toContain("Bars");
    expect(html).toContain("<rect");
  });

  it("renders BarChart empty state", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "BarChart", props: { data: [] } },
    }));
    expect(html).toContain("unavailable");
  });

  it("renders DonutChart", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "DonutChart", props: { data: [{ label: "A", value: 60 }, { label: "B", value: 40 }], title: "Donut", centerLabel: "Sum" } },
    }));
    expect(html).toContain("<svg");
    expect(html).toContain("Donut");
    expect(html).toContain("Sum");
    expect(html).toContain("60%");
  });

  it("renders DonutChart empty state", () => {
    const html = specToStaticHtml(spec("c", {
      c: { type: "DonutChart", props: { data: [] } },
    }));
    expect(html).toContain("unavailable");
  });

  it("renders FlightOption", () => {
    const html = specToStaticHtml(spec("f", {
      f: {
        type: "FlightOption",
        props: {
          airline: "AirTest", flightNo: "AT123", departure: "DEL", arrival: "SFO",
          duration: "16h", stops: 1, price: "1200", currency: "USD", score: 85,
          scoreReason: "Good value", baggage: "2x23kg", refundable: true, bookingUrl: "https://book.test",
        },
      },
    }));
    expect(html).toContain("AirTest");
    expect(html).toContain("AT123");
    expect(html).toContain("1 stop");
    expect(html).toContain("1200 USD");
    expect(html).toContain("85/100");
    expect(html).toContain("Good value");
    expect(html).toContain("2x23kg");
    expect(html).toContain("Refundable");
    expect(html).toContain("Book");
    expect(html).toContain("#f0fdf4"); // good score bg
  });

  it("renders FlightOption nonstop low score", () => {
    const html = specToStaticHtml(spec("f", {
      f: { type: "FlightOption", props: { airline: "X", departure: "A", arrival: "B", duration: "2h", stops: 0, price: "99", score: 50 } },
    }));
    expect(html).toContain("Nonstop");
    expect(html).toContain("#fafafa"); // low score bg
  });

  it("renders nested children", () => {
    const html = specToStaticHtml(spec("root", {
      root: { type: "Section", props: { title: "Outer" }, children: ["inner"] },
      inner: { type: "Text", props: { content: "Nested" } },
    }));
    expect(html).toContain("Outer");
    expect(html).toContain("Nested");
  });

  it("renders unknown type by rendering children", () => {
    const html = specToStaticHtml(spec("root", {
      root: { type: "UnknownWidget", props: {}, children: ["child"] },
      child: { type: "Text", props: { content: "Fallback" } },
    }));
    expect(html).toContain("Fallback");
  });

  it("escapes HTML in content", () => {
    const html = specToStaticHtml(spec("t", {
      t: { type: "Text", props: { content: '<script>alert("xss")</script>' } },
    }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
