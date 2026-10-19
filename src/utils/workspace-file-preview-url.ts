import { buildAgentCanvasPath } from "#/utils/base-path";

export const WORKSPACE_PREVIEW_PATH_PARAM = "path";
export const WORKSPACE_PREVIEW_VERSION_PARAM = "version";

/**
 * Build a same-origin Canvas URL for opening a workspace file in a new tab.
 * Keeping Canvas as the top-level document preserves the partition key of the
 * workspace-session cookie used by the embedded agent-server file URL.
 */
export function buildWorkspaceFilePreviewUrl(
  conversationId: string,
  path: string,
  version: number,
): string {
  const params = new URLSearchParams({
    [WORKSPACE_PREVIEW_PATH_PARAM]: path,
    [WORKSPACE_PREVIEW_VERSION_PARAM]: String(version),
  });
  return buildAgentCanvasPath(
    `/conversations/${encodeURIComponent(conversationId)}/workspace-preview?${params.toString()}`,
  );
}
