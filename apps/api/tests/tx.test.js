import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { query: vi.fn(), release: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { connect: vi.fn(async () => client) } }));

const { withTransaction } = await import("../src/db/tx.js");

const statements = () => client.query.mock.calls.map(([sql]) => sql);

describe("withTransaction", () => {
  beforeEach(() => {
    client.query.mockReset().mockResolvedValue({ rows: [] });
    client.release.mockReset();
  });

  it("sets vera.actor_id, runs fn, and commits", async () => {
    const result = await withTransaction("actor-1", async (c) => {
      await c.query("update x");
      return 42;
    });

    expect(result).toBe(42);
    expect(statements()).toEqual(["BEGIN", "select set_config('vera.actor_id', $1, true)", "update x", "COMMIT"]);
    expect(client.query.mock.calls[1][1]).toEqual(["actor-1"]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("skips set_config for a system job (null actor)", async () => {
    await withTransaction(null, async () => {});
    expect(statements()).toEqual(["BEGIN", "COMMIT"]);
  });

  it("rolls back, rethrows, and releases on error", async () => {
    await expect(
      withTransaction("actor-1", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(statements().at(-1)).toBe("ROLLBACK");
    expect(statements()).not.toContain("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
