import { describe, it, expect } from "vitest";
import { ChannelType } from "discord.js";

// Import the formatters — they are pure functions over discord.js objects
import { fmtChannel, fmtMessage, CHANNEL_TYPE_NAMES } from "../src/discord/formatters.js";

/* ── Mock factories ──────────────────────────────────────────── */

function mockChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "111",
    name: "general",
    type: ChannelType.GuildText,
    parent: null,
    ...overrides,
  } as any;
}

function mockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "222",
    content: "Hello world",
    createdAt: new Date("2025-01-15T12:00:00Z"),
    author: {
      id: "333",
      username: "alice",
      displayName: "Alice",
    },
    member: {
      displayName: "Alice (Server)",
    },
    attachments: new Map(),
    embeds: [],
    ...overrides,
  } as any;
}

/* ── Tests ────────────────────────────────────────────────────── */

describe("CHANNEL_TYPE_NAMES", () => {
  it("maps GuildText to 'text'", () => {
    expect(CHANNEL_TYPE_NAMES[ChannelType.GuildText]).toBe("text");
  });

  it("maps GuildVoice to 'voice'", () => {
    expect(CHANNEL_TYPE_NAMES[ChannelType.GuildVoice]).toBe("voice");
  });

  it("maps GuildForum to 'forum'", () => {
    expect(CHANNEL_TYPE_NAMES[ChannelType.GuildForum]).toBe("forum");
  });
});

describe("fmtChannel()", () => {
  it("formats a basic text channel", () => {
    const result = fmtChannel(mockChannel());
    expect(result).toEqual({
      id: "111",
      name: "general",
      type: "text",
    });
  });

  it("includes topic when present", () => {
    const result = fmtChannel(mockChannel({ topic: "Welcome!" }));
    expect(result.topic).toBe("Welcome!");
  });

  it("includes parent name when present", () => {
    const result = fmtChannel(
      mockChannel({ parent: { name: "Category" } })
    );
    expect(result.parent).toBe("Category");
  });

  it("omits topic when absent", () => {
    const result = fmtChannel(mockChannel());
    expect(result).not.toHaveProperty("topic");
  });

  it("handles unknown channel type gracefully", () => {
    const result = fmtChannel(mockChannel({ type: 999 }));
    expect(result.type).toBe("unknown(999)");
  });
});

describe("fmtMessage()", () => {
  it("formats a basic message", () => {
    const result = fmtMessage(mockMessage());
    expect(result.id).toBe("222");
    expect(result.author).toBe("Alice (Server)");
    expect(result.author_id).toBe("333");
    expect(result.content).toBe("Hello world");
    expect(result.timestamp).toBe("2025-01-15T12:00:00.000Z");
  });

  it("falls back to author displayName when no member", () => {
    const result = fmtMessage(mockMessage({ member: null }));
    expect(result.author).toBe("Alice");
  });

  it("includes attachments when present", () => {
    const attachments = new Map([
      [
        "a1",
        {
          name: "file.txt",
          url: "https://cdn.example.com/file.txt",
          size: 1024,
          contentType: "text/plain",
        },
      ],
    ]);
    const result = fmtMessage(mockMessage({ attachments }));
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments![0].name).toBe("file.txt");
    expect(result.attachments![0].size).toBe(1024);
  });

  it("omits attachments when empty", () => {
    const result = fmtMessage(mockMessage());
    expect(result).not.toHaveProperty("attachments");
  });

  it("includes embed count when present", () => {
    const result = fmtMessage(
      mockMessage({ embeds: [{ title: "E1" }, { title: "E2" }] })
    );
    expect(result.embeds).toBe(2);
  });

  it("omits embeds when empty", () => {
    const result = fmtMessage(mockMessage());
    expect(result).not.toHaveProperty("embeds");
  });
});
