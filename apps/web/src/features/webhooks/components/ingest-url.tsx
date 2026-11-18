import { CopyButton } from "@/components/data/copy-button";

export const IngestUrl = ({ url }: { url: string }) => (
  <span className="flex min-w-0 items-center gap-1">
    <code className="truncate font-mono text-xs">{url}</code>
    <CopyButton value={url} label="Ingest URL" />
  </span>
);
