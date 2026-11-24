import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.ts";
import { logger, serializeRequest } from "./lib/logger.ts";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.ts";
import { ingestRouter } from "./modules/webhooks/ingest.routes.ts";
import { apiRouter } from "./routes.ts";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      serializers: { req: serializeRequest },
    }),
  );

  app.use("/hooks", ingestRouter);

  app.use(cors({ origin: [env.APP_URL], credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
