import { useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { useTranslation } from "react-i18next";
import { WorkspaceBrowserService } from "#/api/workspace-browser-service";
import {
  getSnapshot,
  subscribeActiveBackend,
} from "#/api/backend-registry/active-store";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useRuntimeIsReady } from "#/hooks/use-runtime-is-ready";
import { getGitPath } from "#/utils/get-git-path";
import {
  GitRepositoryContext,
  GIT_REPOSITORIES_QUERY_KEY,
} from "#/context/git-repository-context";
import { useAutoRefreshFilesOnEdit } from "#/hooks/use-auto-refresh-files-on-edit";
import { I18nKey } from "#/i18n/declaration";

const useRepositorySelection = create<{
  selected: Record<string, string>;
  select: (scope: string, path: string) => void;
}>((set) => ({
  selected: {},
  select: (scope, path) =>
    set((state) => ({ selected: { ...state.selected, [scope]: path } })),
}));

export function RepositoryBrowser({ children }: { children: ReactNode }) {
  useAutoRefreshFilesOnEdit();
  const { t } = useTranslation("openhands");
  const { data: conversation } = useActiveConversation();
  const ready = useRuntimeIsReady();
  const snapshot = useSyncExternalStore(
    subscribeActiveBackend,
    getSnapshot,
    getSnapshot,
  );
  const root = getGitPath(
    conversation?.selected_repository,
    conversation?.workspace?.working_dir,
  );
  const url = conversation?.conversation_url;
  const key = conversation?.session_api_key;
  const scope = JSON.stringify([
    snapshot.active.backend.id,
    conversation?.id,
    root,
  ]);
  const selected = useRepositorySelection((state) => state.selected[scope]);
  const select = useRepositorySelection((state) => state.select);
  const query = useQuery({
    queryKey: [GIT_REPOSITORIES_QUERY_KEY, scope, url, key, root],
    queryFn: () => WorkspaceBrowserService.repositories(url, key, root),
    enabled:
      ready &&
      !!conversation?.id &&
      (snapshot.active.backend.kind !== "cloud" || !!url),
    retry: false,
    staleTime: 30000,
    meta: { disableToast: true },
  });
  const repositories = query.data?.repositories ?? [];
  const path =
    repositories.find((repo) => repo.path === selected)?.path ??
    repositories[0]?.path;
  const absolute =
    path === undefined
      ? undefined
      : path === "."
        ? root
        : `${root.replace(/[\\/]$/, "")}/${path}`;

  return (
    <div className="h-full min-h-0 flex flex-col">
      {repositories.length > 0 && (
        <label className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm">
          {t(I18nKey.DIFF_VIEWER$REPOSITORY)}
          <select
            className="min-w-0 flex-1 bg-base"
            value={path}
            onChange={(event) => select(scope, event.target.value)}
          >
            {repositories.map((repo) => (
              <option key={repo.path} value={repo.path}>
                {repo.path === "." ? root : repo.path}
              </option>
            ))}
          </select>
        </label>
      )}
      {query.data?.truncated && (
        <p role="status" className="px-3 text-sm">
          {t(I18nKey.FILES$LIST_TRUNCATED)}
        </p>
      )}
      {query.isError && (
        <p role="alert" className="px-3 text-sm">
          {t(I18nKey.FILES$LOAD_FAILED)}
        </p>
      )}
      {query.isLoading ? (
        <p role="status">{t(I18nKey.DIFF_VIEWER$LOADING)}</p>
      ) : (
        <GitRepositoryContext.Provider
          key={`${scope}:${path ?? ""}`}
          value={absolute}
        >
          <div className="flex-1 min-h-0">{children}</div>
        </GitRepositoryContext.Provider>
      )}
    </div>
  );
}
