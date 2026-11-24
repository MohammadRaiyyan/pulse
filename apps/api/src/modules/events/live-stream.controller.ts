import type { Request, Response } from "express";
import { readBearerToken } from "../../middleware/authenticate.ts";
import * as liveStreamService from "./live-stream.service.ts";

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export const stream = async (req: Request, res: Response) => {
  const subscriber = await liveStreamService.prepareLiveStream(
    readBearerToken(req),
  );

  res.status(200).set(STREAM_HEADERS);
  res.flushHeaders();
  req.socket.setNoDelay(true);
  req.socket.setTimeout(0);

  const close = liveStreamService.openLiveStream(subscriber, {
    write: (chunk) => {
      res.write(chunk);
    },
    end: () => res.end(),
    bufferedBytes: () => res.writableLength,
  });

  res.on("close", close);

  if (res.closed || req.socket.destroyed) {
    close();
  }
};
