import {
  applyIncidentTransition,
  canTransitionIncident,
  endpoints,
  incidentTransitionSchema,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { findById, matchesStatus } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { parseParam } from "../lib/request";
import { errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import { now } from "../lib/time";

const LABEL = "Incident";

const transitionIncident = route(
  endpoints.transitionIncident,
  ({ params, respond }) => {
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

    const updated = applyIncidentTransition(incident, transition, now());
    db.incidents.set(updated.id, updated);

    return respond(updated);
  },
);

export const incidentHandlers = [
  ...crudHandlers(resources.incidents, {
    label: LABEL,
    store: db.incidents,
    sortKey: (incident) => incident.startedAt,
    matches: matchesStatus,
  }),
  transitionIncident,
];
