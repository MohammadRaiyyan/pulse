import { Tabs, TabsList, TabsTrigger } from "@pulse/ui/components/tabs";
import { findOption } from "@/lib/options";
import { type IncidentView, incidentViewOptions } from "../incident-meta";

type IncidentViewTabsProps = {
  value: IncidentView;
  onChange: (value: IncidentView) => void;
};

export const IncidentViewTabs = ({ value, onChange }: IncidentViewTabsProps) => (
  <Tabs
    value={value}
    onValueChange={(nextValue) => {
      const option = findOption(incidentViewOptions, nextValue);

      if (option) {
        onChange(option.value);
      }
    }}
  >
    <TabsList aria-label="Status">
      {incidentViewOptions.map((option) => (
        <TabsTrigger key={option.value} value={option.value}>
          {option.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
