import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceBrowserService } from "#/api/workspace-browser-service";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("WorkspaceBrowserService", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("forwards file discovery options as query parameters to /api/file/list", async () => {
    const fileListUrls: URL[] = [];
    const responses = [
      { files: ["bin/file.txt"], truncated: false },
      { files: [".git/HEAD", "bin/file.txt"], truncated: false },
    ];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      if (url.pathname.endsWith("/file/list")) {
        fileListUrls.push(url);
        return jsonResponse(responses[fileListUrls.length - 1]);
      }
      return jsonResponse({ detail: "Not Found" }, 404);
    }) as typeof fetch;

    await expect(
      WorkspaceBrowserService.listFiles(
        "http://localhost:18000",
        "secret-key",
        "C:\\work",
        {
          excludedPatterns: ["*/bin", "obj"],
          maxFiles: 0,
          includeSymlinks: true,
        },
      ),
    ).resolves.toEqual({ files: ["bin/file.txt"], truncated: false });

    await expect(
      WorkspaceBrowserService.listFiles(
        "http://localhost:18000",
        "secret-key",
        "C:\\work",
        {
          excludedPatterns: [],
          maxFiles: 2000,
          includeSymlinks: false,
        },
      ),
    ).resolves.toEqual({
      files: [".git/HEAD", "bin/file.txt"],
      truncated: false,
    });

    expect(fileListUrls).toHaveLength(2);
    const [first, second] = fileListUrls;
    expect(first.pathname).toBe("/api/file/list");
    expect(first.searchParams.get("path")).toBe("C:\\work");
    expect(first.searchParams.get("limit")).toBe("0");
    expect(first.searchParams.get("use_default_excludes")).toBe("false");
    expect(first.searchParams.getAll("exclude")).toEqual(["*/bin", "obj"]);
    expect(first.searchParams.get("include_symlinks")).toBe("true");

    expect(second.searchParams.get("limit")).toBe("2000");
    expect(second.searchParams.get("use_default_excludes")).toBe("false");
    expect(second.searchParams.getAll("exclude")).toEqual([]);
    expect(second.searchParams.get("include_symlinks")).toBe("false");
  });

  it("returns null on 404 so older servers fall back to shell discovery", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ detail: "Not Found" }, 404),
    ) as typeof fetch;

    await expect(
      WorkspaceBrowserService.listFiles(
        "http://localhost:18000",
        "secret-key",
        "/workspace",
      ),
    ).resolves.toBeNull();
  });
});
