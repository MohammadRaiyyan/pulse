import {
  applyIncidentTransition,
  canTransitionIncident,
  endpoints,
  incidentTransitionSchema,
  matchesIncidentStatusFilter,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { findById } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { parseParam } from "../lib/request";
import { errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import { now } from "../lib/time";

const LABEL = "Incident";

const transitionIncident = route(
  endpoints.transitionIncident,
  ({ params, respond, user }) => {
    const incident = findById(db.incidents, params, LABEL);
    const transition = parseParam(
      params,
      "transition",
      incidentTransitionSchema,
    );

    if (!canTransitionIncident(incident, transition)) {
      return errorResponse(
        "CONFLICT",
        `Cannot ${transition} an incident that is ${incident.status}`,
      );
    }

    const updated = applyIncidentTransition(incident, transition, now(), {
      id: user.id,
      name: user.name,
    });
    db.incidents.set(updated.id, updated);

    return respond(updated);
  },
);

export const incidentHandlers = [
  ...crudHandlers(resources.incidents, {
    label: LABEL,
    store: db.incidents,
    sortKey: (incident) => incident.startedAt,
    matches: (incident, query) =>
      matchesIncidentStatusFilter(incident.status, query.status),
  }),
  transitionIncident,
];
