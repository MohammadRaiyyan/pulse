import { EkgTrace } from "@/components/brand/ekg-trace";
import { Brand } from "@/components/brand/brand";

const highlights = [
  "HTTP checks from every 30 seconds",
  "Alerts when a webhook goes quiet",
  "Role-based access for the whole team",
];

export const AuthShowcase = () => (
  <aside className="dark relative hidden flex-col justify-between overflow-hidden bg-background p-10 text-foreground lg:flex">
    <div className="relative">
      <Brand />
    </div>
    <div className="relative flex flex-col gap-8">
      <h2 className="max-w-md text-5xl leading-[1.05] font-semibold tracking-[-0.03em]">
        Know it&apos;s down before your users do.
      </h2>
      <EkgTrace
        beats={6}
        animated
        strokeWidth={2.5}
        className="h-20 w-full text-brand drop-shadow-[0_0_12px_var(--brand)]"
      />
    </div>
    <ul className="relative flex flex-col gap-2.5 font-mono text-xs text-muted-foreground">
      {highlights.map((highlight) => (
        <li key={highlight} className="flex items-center gap-3">
          <span className="size-1.5 rounded-[1px] bg-brand" aria-hidden />
          {highlight}
        </li>
      ))}
    </ul>
  </aside>
);
