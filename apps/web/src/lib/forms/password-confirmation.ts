import { z } from "zod";

export const confirmPasswordShape = {
  confirmPassword: z.string().min(1, "Confirm your password"),
};

export const passwordMismatchIssue = {
  message: "Passwords do not match",
  path: ["confirmPassword"],
};

type ConfirmableValues<TField extends string> = Record<TField, string> & {
  confirmPassword: string;
};

export const matchesConfirmation =
  <TField extends string>(passwordField: TField) =>
  (values: ConfirmableValues<TField>) =>
    values[passwordField] === values.confirmPassword;

export const withoutConfirmation = <
  TValues extends { confirmPassword: string },
>({
  confirmPassword: _confirmPassword,
  ...values
}: TValues) => values;
