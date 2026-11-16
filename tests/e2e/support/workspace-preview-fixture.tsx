import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RemoteWorkspace } from "@openhands/typescript-client/workspace/remote-workspace";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import AgentServerRuntimeService from "#/api/runtime-service/agent-server-runtime-service";
import {
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import { ActiveBackendProvider } from "#/contexts/active-backend-context";
import WorkspaceFilePreview from "#/routes/workspace-file-preview";

// Only the services are replaced. The route, queries, navigation, StrictMode,
// blob URL lifecycle and browser iframe all execute their production code.
const host =
  new URLSearchParams(location.search).get("host") || location.origin;
setRegisteredBackends([
  {
    id: "preview-test",
    name: "Preview test",
    kind: "local",
    host,
    apiKey: "test-key",
  },
]);
setActiveSelection({ backendId: "preview-test", orgId: null });
AgentServerConversationService.batchGetAppConversations = async () => {
  const response = await fetch("/fixture/conversation");
  return response.json();
};
RemoteWorkspace.prototype.startWorkspaceSession = async () =>
  `${host}/api/conversations/conv-1/workspace/`;
AgentServerRuntimeService.downloadFile = async (_url, key, path) => {
  const response = await fetch(
    `${host}/fixture/file?path=${encodeURIComponent(path)}`,
    {
      headers: { "X-Session-API-Key": key || "" },
    },
  );
  if (!response.ok) throw new Error("File read denied");
  return response.arrayBuffer();
};
const router = createBrowserRouter([
  {
    path: "/conversations/:conversationId/workspace-preview",
    element: <WorkspaceFilePreview />,
  },
]);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ActiveBackendProvider>
        <RouterProvider router={router} />
      </ActiveBackendProvider>
    </QueryClientProvider>
  </StrictMode>,
);
