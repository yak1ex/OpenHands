import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import WorkspaceFilePreview from "#/routes/workspace-file-preview";

const useWorkspaceFileContentMock = vi.fn();

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
  return render(<RouterProvider router={router} />);
}

describe("WorkspaceFilePreview", () => {
  it("keeps Canvas as the top-level document while loading the workspace file", async () => {
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

    renderPreview(
      "/conversations/conv-1/workspace-preview?path=reports%2Findex.html&version=7",
    );

    expect(useWorkspaceFileContentMock).toHaveBeenCalledWith(
      "reports/index.html",
    );
    expect(await screen.findByTitle("reports/index.html")).toHaveAttribute(
      "src",
      "https://agent.example.com/api/conversations/conv-1/workspace/reports/index.html?v=7",
    );
  });
});
