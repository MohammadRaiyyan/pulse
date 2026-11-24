import type { UpdateStatusPageSettingsInput } from "@pulse/contracts";
import { and, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  STATUS_PAGE_SETTINGS_ID,
  incidents,
  statusPageSettings,
} from "../../models/index.ts";

const PUBLIC_INCIDENT_LIMIT = 100;

const settingsColumns = {
  isEnabled: statusPageSettings.isEnabled,
  title: statusPageSettings.title,
  description: statusPageSettings.description,
};

export const findStatusPageSettings = async () => {
  const [settings] = await db
    .select(settingsColumns)
    .from(statusPageSettings)
    .where(eq(statusPageSettings.id, STATUS_PAGE_SETTINGS_ID));
  return settings;
};

export const saveStatusPageSettings = async (
  changes: UpdateStatusPageSettingsInput,
) => {
  const [settings] = await db
    .insert(statusPageSettings)
    .values({ id: STATUS_PAGE_SETTINGS_ID, ...changes })
    .onConflictDoUpdate({
      target: statusPageSettings.id,
      set: { ...changes, updatedAt: new Date() },
    })
    .returning(settingsColumns);

  if (!settings) {
    throw new Error("Failed to save status page settings");
  }

  return settings;
};

export const listPublicIncidentsForSources = async (
  sourceIds: string[],
  resolvedSince: Date,
) => {
  if (sourceIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: incidents.id,
      sourceId: incidents.sourceId,
      severity: incidents.severity,
      status: incidents.status,
      startedAt: incidents.startedAt,
      resolvedAt: incidents.resolvedAt,
    })
    .from(incidents)
    .where(
      and(
        inArray(incidents.sourceId, sourceIds),
        or(
          ne(incidents.status, "resolved"),
          gte(incidents.resolvedAt, resolvedSince),
        ),
      ),
    )
    .orderBy(desc(incidents.startedAt))
    .limit(PUBLIC_INCIDENT_LIMIT);
};
