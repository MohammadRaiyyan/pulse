import { paginationQuerySchema, updateMemberSchema } from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateId, validateQuery } from "../../lib/validate.ts";
import { currentUser } from "../../middleware/authenticate.ts";
import * as memberService from "./member.service.ts";

const LABEL = "Member";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(paginationQuerySchema, req.query);
  res.json(await memberService.getMembers(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await memberService.getMember(id));
};

export const update = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const input = validate(updateMemberSchema, req.body);
  res.json(await memberService.changeMemberRole(currentUser(req), id, input));
};

export const remove = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await memberService.removeMember(currentUser(req), id);
  res.status(204).end();
};
