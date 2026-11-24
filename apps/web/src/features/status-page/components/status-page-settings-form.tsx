import { statusPageSettingsSchema } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useSchemaForm } from "@/components/form/app-form";
import {
  statusPageSettingsQuery,
  useUpdateStatusPageSettings,
} from "../api/status-page-api";

export const StatusPageSettingsForm = () => {
  const { data: settings } = useSuspenseQuery(statusPageSettingsQuery);
  const updateSettings = useUpdateStatusPageSettings();
  const form = useSchemaForm({
    schema: statusPageSettingsSchema,
    defaultValues: settings,
    onSubmit: (values) => updateSettings.mutateAsync(values),
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="isEnabled">
          {(field) => (
            <field.SwitchField
              label="Publish the status page"
              description="Anyone with the link can see public services, their uptime and incident states. Monitor URLs, members and error details are never shown."
            />
          )}
        </form.AppField>
        <form.AppField name="title">
          {(field) => (
            <field.TextField label="Title" placeholder="Acme status" />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.TextField
              label="Short description"
              placeholder="Live health of the Acme platform."
            />
          )}
        </form.AppField>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/status" target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              View public page
            </Link>
          </Button>
          <form.SubmitButton>Save settings</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  );
};
