import { BrandMark } from "./brand-mark";

export const Brand = () => (
  <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:px-0">
    <BrandMark />
    <span className="font-heading text-lg leading-none font-bold tracking-[-0.03em] group-data-[collapsible=icon]:hidden">
      Pulse
    </span>
  </div>
);
