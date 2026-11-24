import type { ChangeEvent } from "@pulse/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { startSession } from "@/features/auth/session";
import { refreshSession } from "@/lib/api/refresh-session";
import { type LiveStatus, runLiveStream } from "../api/live-stream";
import { createLiveInvalidator } from "../live-invalidation";
import { usePageActive } from "./use-page-active";

const HIDDEN_PAUSE_MS = 5 * 60_000;

export const useLiveUpdates = (): LiveStatus => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { id: userId } = useCurrentUser();
  const isPageActive = usePageActive(HIDDEN_PAUSE_MS);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!isPageActive) {
      return;
    }

    const controller = new AbortController();
    const invalidator = createLiveInvalidator(queryClient);

    const reloadOwnSession = async () => {
      const user = await refreshSession();
      await startSession({ queryClient, router }, user);
    };

    const onChange = (event: ChangeEvent) => {
      invalidator.add(event);

      if (event.type === "member.updated" && event.id === userId) {
        reloadOwnSession().catch(() => undefined);
      }
    };

    const onReady = () => {
      if (hasConnected.current) {
        invalidator.refreshAll();
      }

      hasConnected.current = true;
    };

    void runLiveStream(controller.signal, {
      onStatus: setStatus,
      onReady,
      onChange,
    });

    return () => {
      controller.abort();
      invalidator.dispose();
    };
  }, [isPageActive, queryClient, router, userId]);

  return isPageActive ? status : "paused";
};
