import { describe, it, expect } from "vitest";
import { ok, err } from "../src/mcp/response.js";

describe("ok()", () => {
  it("wraps data in a success payload", () => {
    const result = ok({ id: "123", name: "general" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.details).toEqual({ id: "123", name: "general" });
  });

  it("handles string data", () => {
    const result = ok("hello");
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.details).toBe("hello");
  });

  it("handles array data", () => {
    const result = ok([1, 2, 3]);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.details).toEqual([1, 2, 3]);
  });

  it("handles null data", () => {
    const result = ok(null);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.details).toBeNull();
  });

  it("does not set isError", () => {
    const result = ok("data");
    expect(result).not.toHaveProperty("isError");
  });
});

describe("err()", () => {
  it("wraps message in an error payload", () => {
    const result = err("Something failed");
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);

    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Something failed");
  });

  it("includes error code when provided", () => {
    const result = err("Not found", "NOT_FOUND");
    const payload = JSON.parse(result.content[0].text);
    expect(payload.code).toBe("NOT_FOUND");
  });

  it("includes retry_after_ms when provided", () => {
    const result = err("Rate limited", "RATE_LIMITED", 5000);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.code).toBe("RATE_LIMITED");
    expect(payload.retry_after_ms).toBe(5000);
  });

  it("omits code and retry_after_ms when not provided", () => {
    const result = err("Generic error");
    const payload = JSON.parse(result.content[0].text);
    expect(payload).not.toHaveProperty("code");
    expect(payload).not.toHaveProperty("retry_after_ms");
  });
});
