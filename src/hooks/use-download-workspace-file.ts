import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { WorkspaceFileContent } from "#/hooks/query/use-workspace-file-content";
import { I18nKey } from "#/i18n/declaration";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { downloadBlob } from "#/utils/utils";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { readWorkspaceFile } from "#/utils/read-workspace-file";

/**
 * Save a Files tab file to the user's machine under its own file name.
 *
 * Local backends fetch the bytes through the authenticated file API,
 * so every kind (text, image, PDF, binary) downloads byte-for-byte. Cloud
 * backends only hand the file back as UTF-8 text through
 * `GET /api/v1/app-conversations/{id}/file` (the `data:` `staticUrl`), so the
 * blob is rebuilt from that text. Cloud binaries wait on OHE-3631; callers
 * should not offer the download for a Cloud file without decoded text.
 */
export function useDownloadWorkspaceFile() {
  const { t } = useTranslation("openhands");
  const { data: conversation } = useActiveConversation();

  return useMutation({
    mutationFn: async (file: WorkspaceFileContent) => {
      const blob = file.staticUrl.startsWith("data:")
        ? new Blob([file.text ?? ""], {
            type: `${file.mimeType};charset=utf-8`,
          })
        : await readWorkspaceFile(file, conversation);
      downloadBlob(blob, file.path.split("/").pop() || file.path);
    },
    // The toast below is the only one for a failed download; without this the
    // global MutationCache handler adds a second, raw error toast.
    meta: { disableToast: true },
    onError: () => displayErrorToast(t(I18nKey.FILES$DOWNLOAD_ERROR)),
  });
}
