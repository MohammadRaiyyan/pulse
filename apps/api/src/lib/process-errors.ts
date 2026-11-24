import { logger } from "./logger.ts";

const FLUSH_TIMEOUT_MS = 1_000;

const exitAfterFlush = () => {
  setTimeout(() => process.exit(1), FLUSH_TIMEOUT_MS).unref();
  logger.flush(() => process.exit(1));
};

export const exitOnFatalErrors = (processName: string) => {
  process.on("unhandledRejection", (reason) => {
    logger.fatal(
      { err: reason, process: processName },
      "Unhandled promise rejection, exiting",
    );
    exitAfterFlush();
  });

  process.on("uncaughtException", (error, origin) => {
    logger.fatal(
      { err: error, origin, process: processName },
      "Uncaught exception, exiting",
    );
    exitAfterFlush();
  });
};
