import AgentServerRuntimeService from "#/api/runtime-service/agent-server-runtime-service";
import type { WorkspaceFileContent } from "#/hooks/query/use-workspace-file-content";
import { getGitPath } from "#/utils/get-git-path";

interface FileConversation {
  conversation_url?: string | null;
  session_api_key?: string | null;
  selected_repository?: string | null;
  workspace?: { working_dir?: string | null } | null;
}

export function resolveWorkspaceFilePath(path: string, root: string): string {
  if (/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(path)) return path;
  const absoluteRoot = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(root)
    ? root
    : `/${root}`;
  return `${absoluteRoot.replace(/[\\/]$/, "")}/${path}`;
}

/** Read original bytes with header auth, independent of workspace cookies. */
export async function readWorkspaceFile(
  file: Pick<WorkspaceFileContent, "path" | "staticUrl" | "mimeType">,
  conversation: FileConversation | null | undefined,
): Promise<Blob> {
  // Cloud's text-only fallback already carries the content in a data URL.
  if (file.staticUrl.startsWith("data:")) {
    const response = await fetch(file.staticUrl);
    return response.blob();
  }
  if (!conversation) throw new Error("No active conversation");
  const path = resolveWorkspaceFilePath(
    file.path,
    getGitPath(
      conversation.selected_repository,
      conversation.workspace?.working_dir,
    ),
  );
  const bytes = await AgentServerRuntimeService.downloadFile(
    conversation.conversation_url,
    conversation.session_api_key,
    path,
  );
  return new Blob([bytes], { type: file.mimeType });
}
