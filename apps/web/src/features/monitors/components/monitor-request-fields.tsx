import {
  type CreateMonitorInput,
  type MonitorHeaderInput,
  REQUEST_LIMITS,
  methodAllowsBody,
} from "@pulse/contracts";
import { Badge } from "@pulse/ui/components/badge";
import { Button } from "@pulse/ui/components/button";
import {
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@pulse/ui/components/field";
import { Input } from "@pulse/ui/components/input";
import { Switch } from "@pulse/ui/components/switch";
import { cn } from "@pulse/ui/lib/utils";
import { useStore } from "@tanstack/react-form";
import { ChevronRightIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ChangeEvent, useId, useState } from "react";
import { useSchemaForm } from "@/components/form/app-form";
import { toErrorMessage } from "@/components/form/field-errors";
import { OptionSelect } from "@/components/form/option-select";
import { PasswordInput } from "@/components/form/password-input";
import { requestContentTypeOptions } from "../monitor-meta";

type MonitorFormApi = ReturnType<typeof useSchemaForm<CreateMonitorInput>>;

const emptyHeader: MonitorHeaderInput = { name: "", value: "", secret: false };

type FieldMetaLike = { isTouched: boolean; errors: unknown[] };

const visibleErrors = (meta: FieldMetaLike, hasSubmitted: boolean) =>
  meta.isTouched || hasSubmitted ? meta.errors.map(toErrorMessage) : [];

const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const hasRequestConfig = (values: CreateMonitorInput) =>
  (values.requestHeaders?.length ?? 0) > 0 || Boolean(values.requestBody);

const summarizeRequest = (values: CreateMonitorInput) => {
  const headerCount = values.requestHeaders?.length ?? 0;
  const parts = [];

  if (headerCount > 0) {
    parts.push(headerCount === 1 ? "1 header" : `${headerCount} headers`);
  }

  if (values.requestBody) {
    parts.push("body");
  }

  return parts.length > 0 ? parts.join(", ") : "Default headers, no body";
};

const hasRequestErrors = (
  fieldMeta: Record<string, FieldMetaLike | undefined>,
) =>
  Object.entries(fieldMeta).some(
    ([name, meta]) =>
      name.startsWith("request") && (meta?.errors.length ?? 0) > 0,
  );

type HeaderRowProps = {
  form: MonitorFormApi;
  index: number;
  hasSubmitted: boolean;
  onRemove: () => void;
};

const HeaderRow = ({ form, index, hasSubmitted, onRemove }: HeaderRowProps) => {
  const switchId = useId();
  const isSecret = useStore(
    form.store,
    (state) => state.values.requestHeaders?.[index]?.secret ?? false,
  );

  return (
    <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto_auto]">
      <form.Field name={`requestHeaders[${index}].name`}>
        {(field) => {
          const errors = visibleErrors(field.state.meta, hasSubmitted);

          return (
            <div className="flex flex-col gap-1">
              <Input
                aria-label={`Header ${index + 1}`}
                placeholder="X-Api-Key"
                autoComplete="off"
                value={field.state.value}
                aria-invalid={errors.length > 0}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldError errors={errors} />
            </div>
          );
        }}
      </form.Field>
      <form.Field name={`requestHeaders[${index}].value`}>
        {(field) => {
          const errors = visibleErrors(field.state.meta, hasSubmitted);
          const inputProps = {
            "aria-label": `Header ${index + 1} value`,
            placeholder: isSecret ? "Secret value" : "Value",
            autoComplete: "off",
            value: field.state.value ?? "",
            "aria-invalid": errors.length > 0,
            onBlur: field.handleBlur,
            onChange: (event: ChangeEvent<HTMLInputElement>) =>
              field.handleChange(event.target.value),
          };

          if (isSecret && field.state.value === null) {
            return (
              <div className="flex h-9 items-center gap-2">
                <Badge variant="secondary">
                  <LockIcon />
                  Saved
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => field.handleChange("")}
                >
                  Replace
                </Button>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-1">
              {isSecret ? (
                <PasswordInput {...inputProps} />
              ) : (
                <Input {...inputProps} />
              )}
              <FieldError errors={errors} />
            </div>
          );
        }}
      </form.Field>
      <form.Field name={`requestHeaders[${index}].secret`}>
        {(field) => (
          <div className="flex h-9 items-center gap-2 text-sm">
            <Switch
              id={switchId}
              aria-label={`Header ${index + 1} is secret`}
              checked={field.state.value}
              onCheckedChange={(checked) => {
                if (
                  !checked &&
                  form.getFieldValue(`requestHeaders[${index}].value`) === null
                ) {
                  form.setFieldValue(`requestHeaders[${index}].value`, "");
                }
                field.handleChange(checked);
              }}
            />
            <FieldLabel htmlFor={switchId} className="font-normal">
              Secret
            </FieldLabel>
          </div>
        )}
      </form.Field>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove header ${index + 1}`}
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
};

export const MonitorRequestFields = ({ form }: { form: MonitorFormApi }) => {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(() =>
    hasRequestConfig(form.state.values),
  );
  const hasSubmitted = useStore(
    form.store,
    (state) => state.submissionAttempts > 0,
  );
  const showErrorsOpen = useStore(
    form.store,
    (state) =>
      state.submissionAttempts > 0 && hasRequestErrors(state.fieldMeta),
  );
  const isExpanded = isOpen || showErrorsOpen;

  return (
    <section className="rounded-lg border">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isExpanded)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronRightIcon
          className={cn(
            "size-4 transition-transform",
            isExpanded && "rotate-90",
          )}
        />
        Request
        <form.Subscribe selector={(state) => summarizeRequest(state.values)}>
          {(summary) => (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {summary}
            </span>
          )}
        </form.Subscribe>
      </button>
      <div
        id={panelId}
        hidden={!isExpanded}
        className="flex flex-col gap-6 border-t px-3 py-4"
      >
        <form.Field name="requestHeaders" mode="array">
          {(headersField) => {
            const headers = headersField.state.value ?? [];

            return (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <FieldLabel>Headers</FieldLabel>
                  <FieldDescription>
                    Sent with every check, for example an Authorization header
                    or an API key. Secret values are encrypted and never shown
                    again.
                  </FieldDescription>
                </div>
                {headers.map((_, index) => (
                  <HeaderRow
                    key={index}
                    form={form}
                    index={index}
                    hasSubmitted={hasSubmitted}
                    onRemove={() => headersField.removeValue(index)}
                  />
                ))}
                <FieldError
                  errors={visibleErrors(headersField.state.meta, hasSubmitted)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={headers.length >= REQUEST_LIMITS.headers}
                  onClick={() => headersField.pushValue({ ...emptyHeader })}
                >
                  <PlusIcon />
                  Add header
                </Button>
              </div>
            );
          }}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.method}>
          {(method) => {
            const allowsBody = methodAllowsBody(method);

            return (
              <div className="flex flex-col gap-4">
                <form.Field name="requestContentType">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <FieldLabel htmlFor={`${panelId}-content-type`}>
                        Content type
                      </FieldLabel>
                      <OptionSelect
                        id={`${panelId}-content-type`}
                        className="w-full sm:w-64"
                        value={field.state.value ?? ""}
                        options={requestContentTypeOptions}
                        placeholder="Choose a content type"
                        disabled={!allowsBody}
                        onChange={field.handleChange}
                      />
                      <FieldError
                        errors={visibleErrors(field.state.meta, hasSubmitted)}
                      />
                    </div>
                  )}
                </form.Field>
                <form.AppField
                  name="requestBody"
                  validators={{
                    onChangeListenTo: ["requestContentType"],
                    onChange: ({ value, fieldApi }) =>
                      value &&
                      fieldApi.form.getFieldValue("requestContentType") ===
                        "application/json" &&
                      !isValidJson(value)
                        ? "Enter valid JSON"
                        : undefined,
                  }}
                  listeners={{
                    onChange: ({ value }) => {
                      if (value && !form.getFieldValue("requestContentType")) {
                        form.setFieldValue(
                          "requestContentType",
                          "application/json",
                        );
                      }
                    },
                  }}
                >
                  {(field) => (
                    <field.TextareaField
                      label="Body"
                      monospace
                      disabled={!allowsBody}
                      placeholder={allowsBody ? '{"ping": true}' : undefined}
                      description={
                        allowsBody
                          ? `Sent with the selected content type. Up to ${REQUEST_LIMITS.bodyBytes / 1024} KB.`
                          : `${method} requests cannot send a body. Choose POST, PUT, PATCH or DELETE to add one.`
                      }
                    />
                  )}
                </form.AppField>
              </div>
            );
          }}
        </form.Subscribe>
      </div>
    </section>
  );
};
