import {
  type SseMessage,
  createSseParser,
  formatSseComment,
  formatSseMessage,
} from "@pulse/contracts";
import { describe, expect, it } from "vitest";

const collect = () => {
  const messages: SseMessage[] = [];
  const parse = createSseParser((message) => messages.push(message));
  return { messages, parse };
};

describe("SSE parser", () => {
  it("parses messages written by the formatter", () => {
    const { messages, parse } = collect();

    parse(formatSseMessage("change", { type: "monitor.updated", id: "a" }));
    parse(formatSseComment("heartbeat"));
    parse(formatSseMessage("ready", {}));

    expect(messages).toEqual([
      {
        event: "change",
        data: '{"type":"monitor.updated","id":"a"}',
        id: undefined,
      },
      { event: "ready", data: "{}", id: undefined },
    ]);
  });

  it("joins messages split across chunks at any position", () => {
    const text = "event: change\ndata: one\n\ndata: two\n\n";

    for (let cut = 1; cut < text.length; cut += 1) {
      const { messages, parse } = collect();
      parse(text.slice(0, cut));
      parse(text.slice(cut));

      expect(messages.map((message) => message.data)).toEqual(["one", "two"]);
    }
  });

  it("handles CRLF and CR line endings, including a CRLF split across chunks", () => {
    const { messages, parse } = collect();

    parse("data: first\r");
    parse("\n\r\n");
    parse("data: second\r\r");
    parse("data: third\n\n");

    expect(messages.map((message) => message.data)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("joins multi-line data, defaults the event name and keeps the id", () => {
    const { messages, parse } = collect();

    parse("id: 7\ndata: line one\ndata:line two\n\n");

    expect(messages).toEqual([
      { event: "message", data: "line one\nline two", id: "7" },
    ]);
  });

  it("ignores comments, retry fields and blocks without data", () => {
    const { messages, parse } = collect();

    parse(": hello\nretry: 3000\n\nevent: ping\n\n");

    expect(messages).toEqual([]);
  });
});
