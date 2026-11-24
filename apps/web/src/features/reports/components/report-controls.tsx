import { type ReportPreset, slaTargetSchema } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { Input } from "@pulse/ui/components/input";
import { Label } from "@pulse/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@pulse/ui/components/tabs";
import { type FormEvent, useState } from "react";
import { findOption } from "@/lib/options";
import { reportPresetOptions } from "../report-meta";
import {
  type ReportSearch,
  earliestReportDay,
  presetFromDay,
  todayUtc,
  validateCustomRange,
} from "../report-search";

type ReportControlsProps = {
  search: ReportSearch;
  onChange: (changes: Partial<ReportSearch>) => void;
};

const RangeTabs = ({
  value,
  onChange,
}: {
  value: ReportPreset;
  onChange: (value: ReportPreset) => void;
}) => (
  <Tabs
    value={value}
    onValueChange={(nextValue) => {
      const option = findOption(reportPresetOptions, nextValue);

      if (option) {
        onChange(option.value);
      }
    }}
  >
    <TabsList aria-label="Report range">
      {reportPresetOptions.map((option) => (
        <TabsTrigger key={option.value} value={option.value}>
          {option.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);

const CustomRangeForm = ({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
}) => {
  const today = todayUtc();
  const [draft, setDraft] = useState({ from, to });
  const error = validateCustomRange(draft.from, draft.to, today);
  const isUnchanged = draft.from === from && draft.to === to;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!error) {
      onApply(draft);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3"
      aria-label="Custom range"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-from">From (UTC)</Label>
        <Input
          id="report-from"
          type="date"
          className="w-40"
          min={earliestReportDay(today)}
          max={today}
          value={draft.from}
          aria-invalid={Boolean(error)}
          onChange={(event) =>
            setDraft((current) => ({ ...current, from: event.target.value }))
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-to">To (UTC)</Label>
        <Input
          id="report-to"
          type="date"
          className="w-40"
          min={earliestReportDay(today)}
          max={today}
          value={draft.to}
          aria-invalid={Boolean(error)}
          onChange={(event) =>
            setDraft((current) => ({ ...current, to: event.target.value }))
          }
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={Boolean(error) || isUnchanged}
      >
        Apply
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
};

const SlaTargetForm = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value));
  const parsed = slaTargetSchema.safeParse(draft === "" ? undefined : draft);
  const error = parsed.success ? null : "Use a value from 0 to 100";

  const commit = () => {
    if (parsed.success && parsed.data !== value) {
      onChange(parsed.data);
    }
  };

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <Label htmlFor="report-sla">SLA target (%)</Label>
      <Input
        id="report-sla"
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step={0.01}
        className="w-28"
        value={draft}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "report-sla-error" : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
      {error ? (
        <p id="report-sla-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
};

export const ReportControls = ({ search, onChange }: ReportControlsProps) => {
  const today = todayUtc();

  const changeRange = (range: ReportPreset) => {
    if (range === "custom") {
      onChange({
        range,
        from: search.from ?? presetFromDay("30d", today),
        to: search.to ?? today,
      });
      return;
    }

    onChange({ range, from: undefined, to: undefined });
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Range</span>
          <RangeTabs value={search.range} onChange={changeRange} />
        </div>
        {search.range === "custom" ? (
          <CustomRangeForm
            key={`${search.from}-${search.to}`}
            from={search.from ?? presetFromDay("30d", today)}
            to={search.to ?? today}
            onApply={(range) => onChange(range)}
          />
        ) : null}
      </div>
      <SlaTargetForm
        key={search.slaTarget}
        value={search.slaTarget}
        onChange={(slaTarget) => onChange({ slaTarget })}
      />
    </div>
  );
};
