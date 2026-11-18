import { MAX_PAGE_SIZE, endpoints, resources } from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";

export const invitationResource = createResource(
  resources.invitations,
  "Invitation",
);

export const pendingInvitationsQuery = invitationResource.queries.list({
  status: "pending",
  page: 1,
  pageSize: MAX_PAGE_SIZE,
});

export const invitationPreviewQuery = (token: string) =>
  queryOptions({
    queryKey: [...invitationResource.keys.all, "preview", token],
    queryFn: () =>
      callEndpoint(endpoints.previewInvitation, { params: { token } }),
    retry: false,
  });
