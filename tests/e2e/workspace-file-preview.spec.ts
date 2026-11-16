import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import svgr from "vite-plugin-svgr";
import { expect, test } from "@playwright/test";

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("../../", import.meta.url)),
    resolve: {
      alias: { "#": fileURLToPath(new URL("../../src", import.meta.url)) },
    },
    define: { __EXTENSIONS_SKILLS_DIR__: JSON.stringify("") },
    plugins: [
      svgr(),
      {
        name: "workspace-preview-fixture",
        configureServer(devServer) {
          devServer.middlewares.use(async (request, response, next) => {
            if (!request.url?.startsWith("/conversations/")) return next();
            response.setHeader("Content-Type", "text/html");
            response.end(
              await devServer.transformIndexHtml(
                request.url,
                '<!doctype html><div id="root"></div><script type="module" src="/tests/e2e/support/workspace-preview-fixture.tsx"></script>',
              ),
            );
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => server?.close());

for (const remote of [false, true]) {
  test(`new-window HTML renders scripts and reloads with ${remote ? "remote" : "local"} backend`, async ({
    page,
  }) => {
    const host = remote ? "https://backend.example.test" : origin;
    const requests: string[] = [];
    await page.route("**/fixture/conversation", (route) =>
      route.fulfill({
        json: [
          {
            id: "conv-1",
            title: "Preview",
            execution_status: "idle",
            created_at: "2026-01-01T00:00:00Z",
            conversation_url: `${host}/api/conversations/conv-1`,
            session_api_key: "test-key",
            workspace: { working_dir: "/project" },
          },
        ],
      }),
    );
    await page.route("**/fixture/file?*", async (route) => {
      requests.push(route.request().headers()["x-session-api-key"]);
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><body><script>
        let isolated = false;
        try { void parent.document.body; } catch { isolated = true; }
        let storageIsolated = false;
        try { void localStorage.length; } catch { storageIsolated = true; }
        document.body.textContent = isolated && storageIsolated ? 'Interactive report, isolated' : 'Canvas origin exposed';
      </script></body>`,
      });
    });
    await page.goto(
      `${origin}/conversations/conv-1/workspace-preview?path=report.html&host=${encodeURIComponent(host)}`,
    );
    const frame = page.frameLocator(
      '[data-testid="workspace-file-preview-frame"]',
    );
    await expect(frame.locator("body")).toHaveText(
      "Interactive report, isolated",
    );
    await page.reload();
    await expect(frame.locator("body")).toHaveText(
      "Interactive report, isolated",
    );
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests.every((key) => key === "test-key")).toBe(true);
  });
}
