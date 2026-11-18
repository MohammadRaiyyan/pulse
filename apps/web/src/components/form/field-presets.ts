import { PASSWORD_MIN_LENGTH } from "@pulse/contracts";
import type { TextFieldProps } from "./text-field";

type FieldPreset = Partial<TextFieldProps>;

export const emailField = {
  label: "Email",
  type: "email",
  autoComplete: "email",
} satisfies FieldPreset;

export const signInEmailField = {
  ...emailField,
  placeholder: "you@company.com",
} satisfies FieldPreset;

export const fullNameField = {
  label: "Full name",
  autoComplete: "name",
} satisfies FieldPreset;

export const currentPasswordField = {
  type: "password",
  autoComplete: "current-password",
} satisfies FieldPreset;

export const newPasswordField = {
  type: "password",
  autoComplete: "new-password",
  description: `At least ${PASSWORD_MIN_LENGTH} characters.`,
} satisfies FieldPreset;

export const confirmPasswordField = {
  type: "password",
  autoComplete: "new-password",
} satisfies FieldPreset;
