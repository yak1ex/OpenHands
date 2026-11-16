import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { I18nKey } from "#/i18n/declaration";
import { useWorkspaceFileContent } from "#/hooks/query/use-workspace-file-content";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { readWorkspaceFile } from "#/utils/read-workspace-file";
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
  const { data: conversation } = useActiveConversation();
  const { path: filePath, staticUrl, mimeType } = query.data ?? {};
  const fileConversation = {
    conversation_url: conversation?.conversation_url,
    session_api_key: conversation?.session_api_key,
    selected_repository: conversation?.selected_repository,
    workspace: { working_dir: conversation?.workspace?.working_dir },
  };
  const preview = useQuery({
    queryKey: [
      "workspace-file-preview",
      conversation?.id,
      fileConversation,
      filePath,
      staticUrl,
      mimeType,
      version,
    ],
    enabled: !!query.data && !!conversation,
    queryFn: async () => {
      const blob = await readWorkspaceFile(
        { path: filePath!, staticUrl: staticUrl!, mimeType: mimeType! },
        fileConversation,
      );
      if (mimeType !== "text/html" || staticUrl!.startsWith("data:"))
        return blob;
      // Blob documents have no directory. Retain the workspace base so
      // relative links and assets still resolve to the original location.
      const document = new DOMParser().parseFromString(
        await blob.text(),
        "text/html",
      );
      const existingBase = document.querySelector("base[href]");
      const base = existingBase ?? document.createElement("base");
      base.setAttribute(
        "href",
        new URL(existingBase?.getAttribute("href") ?? "", staticUrl!).href,
      );
      if (!existingBase) document.head.prepend(base);
      return new Blob(["<!doctype html>", document.documentElement.outerHTML], {
        type: mimeType,
      });
    },
    retry: false,
    meta: { disableToast: true },
  });
  const [source, setSource] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!preview.data) return undefined;
    const url = URL.createObjectURL(preview.data);
    setSource({ blob: preview.data, url });
    return () => URL.revokeObjectURL(url);
  }, [preview.data]);

  if (
    query.isLoading ||
    (query.data &&
      !preview.isError &&
      (!preview.data || source?.blob !== preview.data))
  ) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-canvas-base text-sm text-muted">
        {t(I18nKey.FILES$LOADING_FILES)}
      </main>
    );
  }

  if (!path || query.isError || preview.isError || !query.data || !source) {
    return (
      <main
        role="alert"
        className="flex h-screen w-full items-center justify-center bg-canvas-base text-sm text-muted"
      >
        {(query.error ?? preview.error)?.message ?? t(I18nKey.FILES$LOAD_ERROR)}
      </main>
    );
  }

  return (
    <iframe
      title={path}
      src={source.url}
      sandbox={query.data.kind === "pdf" ? undefined : "allow-same-origin"}
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
