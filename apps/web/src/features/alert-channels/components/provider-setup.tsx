import type { AlertChannelType } from "@pulse/contracts";
import { channelTypeMeta } from "../alert-channel-meta";

export const ProviderSetup = ({ type }: { type: AlertChannelType }) => {
  const { label, setupSteps, testNote } = channelTypeMeta[type];

  return (
    <section
      aria-label={`How to set up ${label}`}
      className="flex flex-col gap-2 rounded-xl bg-muted p-3 text-sm"
    >
      <h3 className="font-medium">Setup</h3>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
        {setupSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{testNote}</p>
    </section>
  );
};
