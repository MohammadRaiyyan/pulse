import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckboxGroupField } from "@/components/form/checkbox-group-field";
import { alertChannelOptionsQuery } from "../api/alert-channel-resource";

export const AlertChannelsField = ({
  description,
}: {
  description?: string;
}) => {
  const { data: options } = useSuspenseQuery(alertChannelOptionsQuery);

  return (
    <CheckboxGroupField
      label="Alert channels"
      description={description}
      options={options}
      emptyMessage="No alert channels yet. Create one to get notified."
    />
  );
};
