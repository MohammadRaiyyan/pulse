import { LIVE_EVENTS_PATH } from "@pulse/contracts";
import { Router } from "express";
import * as liveStreamController from "./live-stream.controller.ts";

export const liveStreamRouter = Router();

liveStreamRouter.get(LIVE_EVENTS_PATH, liveStreamController.stream);
