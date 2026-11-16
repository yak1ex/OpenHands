import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import WorkspaceFilePreview from "#/routes/workspace-file-preview";

const useWorkspaceFileContentMock = vi.fn();
const downloadFileMock = vi.fn();
const createObjectURLMock = vi.fn(
  (_blob: Blob) => "blob:http://localhost/preview",
);
const revokeObjectURLMock = vi.fn();
vi.mock("#/api/runtime-service/agent-server-runtime-service", () => ({
  default: { downloadFile: (...args: unknown[]) => downloadFileMock(...args) },
}));
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      id: "conv-1",
      conversation_url: "http://remote.example/api/conversations/conv-1",
      session_api_key: "test-key",
      workspace: { working_dir: "/project" },
    },
  }),
}));

vi.mock("#/hooks/query/use-workspace-file-content", () => ({
  useWorkspaceFileContent: (path: string | null) =>
    useWorkspaceFileContentMock(path),
}));

function renderPreview(url: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/conversations/:conversationId/workspace-preview",
        element: <WorkspaceFilePreview />,
      },
    ],
    { initialEntries: [url] },
  );
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("WorkspaceFilePreview", () => {
  beforeEach(() => {
    useWorkspaceFileContentMock.mockReturnValue({
      data: {
        path: "reports/index.html",
        kind: "text",
        text: "<!doctype html><body>report</body>",
        staticUrl:
          "https://agent.example.com/api/conversations/conv-1/workspace/reports/index.html",
        mimeType: "text/html",
      },
      isLoading: false,
      isError: false,
    });
    downloadFileMock.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = createObjectURLMock;
        static revokeObjectURL = revokeObjectURLMock;
      },
    );
    downloadFileMock.mockResolvedValue(
      new TextEncoder().encode("<body>report</body>").buffer,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps Canvas as the top-level document while loading the workspace file", async () => {
    const view = renderPreview(
      "/conversations/conv-1/workspace-preview?path=reports%2Findex.html&version=7",
    );

    expect(useWorkspaceFileContentMock).toHaveBeenCalledWith(
      "reports/index.html",
    );
    expect(await screen.findByTitle("reports/index.html")).toHaveAttribute(
      "src",
      "blob:http://localhost/preview",
    );
    expect(downloadFileMock).toHaveBeenCalledWith(
      "http://remote.example/api/conversations/conv-1",
      "test-key",
      "/project/reports/index.html",
    );
    const html = await createObjectURLMock.mock.calls[0][0].text();
    expect(html).toContain(
      '<base href="https://agent.example.com/api/conversations/conv-1/workspace/reports/index.html">',
    );
    expect(await screen.findByTitle("reports/index.html")).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );
    // Focusing an existing report must preserve its document and script state.
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(downloadFileMock).toHaveBeenCalledOnce();
    view.unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledWith(
      "blob:http://localhost/preview",
    );
  });
  it("shows a read failure instead of a blank frame", async () => {
    downloadFileMock.mockRejectedValue(new Error("File read denied"));
    renderPreview(
      "/conversations/conv-1/workspace-preview?path=reports%2Findex.html",
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("File read denied"),
    );
    expect(
      screen.queryByTestId("workspace-file-preview-frame"),
    ).not.toBeInTheDocument();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });
  it("previews Cloud HTML from its existing data URL", async () => {
    const file = {
      path: "index.html",
      kind: "text",
      text: "<body>cloud</body>",
      staticUrl: "data:text/html;base64,PGJvZHk+Y2xvdWQ8L2JvZHk+",
      mimeType: "text/html",
    };
    useWorkspaceFileContentMock.mockReturnValue({
      data: file,
      isLoading: false,
      isError: false,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      blob: async () => new Blob([file.text], { type: file.mimeType }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPreview("/conversations/conv-1/workspace-preview?path=index.html");
    expect(await screen.findByTitle("index.html")).toHaveAttribute(
      "src",
      "blob:http://localhost/preview",
    );
    expect(fetchMock).toHaveBeenCalledWith(file.staticUrl);
    expect(downloadFileMock).not.toHaveBeenCalled();
  });
  it("keeps a disabled content query in its loading state during startup", () => {
    useWorkspaceFileContentMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: false,
      isError: false,
    });
    renderPreview(
      "/conversations/conv-1/workspace-preview?path=reports%2Findex.html",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("workspace-file-preview-frame"),
    ).not.toBeInTheDocument();
    expect(downloadFileMock).not.toHaveBeenCalled();
  });
});
