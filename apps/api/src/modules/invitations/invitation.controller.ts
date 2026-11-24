import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationListQuerySchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateId, validateQuery } from "../../lib/validate.ts";
import { currentUser } from "../../middleware/authenticate.ts";
import { setRefreshCookie } from "../../security/refresh-cookie.ts";
import * as invitationService from "./invitation.service.ts";

const LABEL = "Invitation";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(invitationListQuerySchema, req.query);
  res.json(await invitationService.getInvitations(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await invitationService.getInvitation(id));
};

export const create = async (req: Request, res: Response) => {
  const input = validate(createInvitationSchema, req.body);
  res
    .status(201)
    .json(await invitationService.createInvitation(currentUser(req), input));
};

export const revoke = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await invitationService.revokeInvitation(id);
  res.status(204).end();
};

export const preview = async (req: Request, res: Response) => {
  res.json(await invitationService.previewInvitation(String(req.params.token)));
};

export const accept = async (req: Request, res: Response) => {
  const input = validate(acceptInvitationSchema, req.body);
  const session = await invitationService.acceptInvitationWithToken(input);

  setRefreshCookie(res, session.refreshToken);
  res
    .status(201)
    .json({ accessToken: session.accessToken, user: session.user });
};
