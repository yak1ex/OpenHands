import { RemoteWorkspace } from "@openhands/typescript-client/workspace/remote-workspace";
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
  ): Promise<WorkspaceFileList | null> {
    try {
      const response = await new RemoteWorkspace(
        getAgentServerClientOptions({ conversationUrl, sessionApiKey }),
      ).client.get<WorkspaceFileList>("/api/file/list", { params: { path } });
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
