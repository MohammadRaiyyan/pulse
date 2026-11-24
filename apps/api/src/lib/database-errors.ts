import { AppError, badRequest, conflict } from "./errors.ts";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type PostgresError = {
  code: string;
  constraint_name?: string;
};

const isPostgresError = (value: unknown): value is PostgresError =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  typeof value.code === "string";

const readPostgresError = (error: unknown) => {
  if (isPostgresError(error)) {
    return error;
  }

  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? error.cause
      : undefined;

  return isPostgresError(cause) ? cause : undefined;
};

const unknownAlertChannel = () =>
  badRequest("Some fields are invalid", {
    alertChannelIds: ["Unknown alert channel"],
  });

const unknownService = () =>
  badRequest("Some fields are invalid", {
    serviceId: ["Unknown service"],
  });

const errorsByConstraint: Record<string, () => AppError> = {
  users_email_unique: () =>
    conflict("Email already in use", {
      email: ["An account with this email already exists"],
    }),
  users_single_owner: () => conflict("This workspace already has an owner"),
  invitations_one_pending_per_email: () =>
    conflict("Already invited", {
      email: ["An invitation is already pending for this email"],
    }),
  linked_accounts_provider_account_unique: () =>
    conflict("This account is already connected to another user"),
  monitor_alert_channels_channel_id_alert_channels_id_fk: unknownAlertChannel,
  webhook_alert_channels_channel_id_alert_channels_id_fk: unknownAlertChannel,
  monitors_service_id_services_id_fk: unknownService,
  webhooks_service_id_services_id_fk: unknownService,
  services_name_unique: () =>
    conflict("Service name already in use", {
      name: ["A service with this name already exists"],
    }),
};

export const isUniqueViolation = (error: unknown) =>
  readPostgresError(error)?.code === UNIQUE_VIOLATION;

export const toDatabaseAppError = (error: unknown) => {
  const postgresError = readPostgresError(error);

  if (!postgresError) {
    return undefined;
  }

  const knownError = postgresError.constraint_name
    ? errorsByConstraint[postgresError.constraint_name]
    : undefined;

  if (knownError) {
    return knownError();
  }

  if (postgresError.code === UNIQUE_VIOLATION) {
    return conflict("This record already exists");
  }

  if (postgresError.code === FOREIGN_KEY_VIOLATION) {
    return badRequest("A related record does not exist");
  }

  return undefined;
};
