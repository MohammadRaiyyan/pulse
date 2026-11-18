import { z } from "zod";

export const idSchema = z.uuid();

export const timestampSchema = z.iso.datetime();

export const nameSchema = z.string().trim().min(1, "Name is required").max(100);

export const tokenSchema = z.string().min(1);

export const relativePathSchema = z.string().startsWith("/");

export const nonNegativeIntSchema = z.int().min(0);

export const percentSchema = z.number().min(0).max(100);

export const requiredStringSchema = (message: string) =>
  z.string().min(1, message);

export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  error: "Enter a valid http(s) URL",
});

export const boundedIntSchema = ({ min, max }: { min: number; max: number }) =>
  z.int().min(min).max(max);
