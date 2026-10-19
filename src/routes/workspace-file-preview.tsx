import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { I18nKey } from "#/i18n/declaration";
import { useWorkspaceFileContent } from "#/hooks/query/use-workspace-file-content";
import { withWorkspaceCacheBuster } from "#/stores/use-workspace-mutation-counter";
import {
  WORKSPACE_PREVIEW_PATH_PARAM,
  WORKSPACE_PREVIEW_VERSION_PARAM,
} from "#/utils/workspace-file-preview-url";
import { ReactRouterNavigationProvider } from "#/routes/react-router-navigation-provider";

function WorkspaceFilePreviewContent() {
  const { t } = useTranslation("openhands");
  const [searchParams] = useSearchParams();
  const path = searchParams.get(WORKSPACE_PREVIEW_PATH_PARAM)?.trim() || null;
  const rawVersion = Number(
    searchParams.get(WORKSPACE_PREVIEW_VERSION_PARAM) ?? 0,
  );
  const version =
    Number.isSafeInteger(rawVersion) && rawVersion >= 0 ? rawVersion : 0;
  const query = useWorkspaceFileContent(path);

  if (query.isLoading) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-canvas-base text-sm text-muted">
        {t(I18nKey.FILES$LOADING_FILES)}
      </main>
    );
  }

  if (!path || query.isError || !query.data) {
    return (
      <main
        role="alert"
        className="flex h-screen w-full items-center justify-center bg-canvas-base text-sm text-muted"
      >
        {(query.error as Error | undefined)?.message ??
          t(I18nKey.FILES$LOAD_ERROR)}
      </main>
    );
  }

  return (
    <iframe
      title={path}
      src={withWorkspaceCacheBuster(query.data.staticUrl, version)}
      data-testid="workspace-file-preview-frame"
      className="block h-screen w-full border-0 bg-white"
    />
  );
}

export default function WorkspaceFilePreview() {
  return (
    <ReactRouterNavigationProvider>
      <WorkspaceFilePreviewContent />
    </ReactRouterNavigationProvider>
  );
}
