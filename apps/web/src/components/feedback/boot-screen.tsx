import { BrandMark } from "@/components/brand/brand-mark";
import { EkgTrace } from "@/components/brand/ekg-trace";

export const BootScreen = () => (
  <output
    className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background"
    aria-label="Loading Pulse"
  >
    <BrandMark size="large" />
    <EkgTrace
      beats={4}
      animated
      strokeWidth={2}
      className="h-8 w-56 text-brand"
    />
    <p className="font-mono text-xs text-muted-foreground">
      Establishing signal
    </p>
  </output>
);
