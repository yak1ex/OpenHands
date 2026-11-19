import { RemoteWorkspace } from "@openhands/typescript-client/workspace/remote-workspace";
import type { WorkspaceFileDiscovery } from "#/utils/workspace-file-discovery";
import { getAgentServerClientOptions } from "./agent-server-client-options";
import { isSdkHttpStatusError } from "./agent-server-compatibility";

export interface WorkspaceFileList {
  files: string[];
  truncated: boolean;
}

export interface WorkspaceRepositories {
  repositories: { path: string }[];
  truncated: boolean;
}

// Use the released client's public transport until its next release includes
// the typed discovery methods added alongside these Agent Server endpoints.
export class WorkspaceBrowserService {
  static async listFiles(
    conversationUrl: string | null | undefined,
    sessionApiKey: string | null | undefined,
    path: string,
    options?: WorkspaceFileDiscovery,
  ): Promise<WorkspaceFileList | null> {
    const params: Record<string, unknown> = { path };
    if (options) {
      params.limit = options.maxFiles;
      params.use_default_excludes = false;
      params.exclude = options.excludedPatterns;
      params.include_symlinks = options.includeSymlinks;
    }
    try {
      const response = await new RemoteWorkspace(
        getAgentServerClientOptions({ conversationUrl, sessionApiKey }),
      ).client.get<WorkspaceFileList>("/api/file/list", { params });
      return response.data;
    } catch (error) {
      if (isSdkHttpStatusError(error, 404)) return null;
      throw error;
    }
  }

  static async repositories(
    conversationUrl: string | null | undefined,
    sessionApiKey: string | null | undefined,
    path: string,
  ): Promise<WorkspaceRepositories | null> {
    try {
      const response = await new RemoteWorkspace(
        getAgentServerClientOptions({ conversationUrl, sessionApiKey }),
      ).client.get<WorkspaceRepositories>("/api/git/repositories", {
        params: { path },
      });
      return response.data;
    } catch (error) {
      if (isSdkHttpStatusError(error, 404)) return null;
      throw error;
    }
  }
}
