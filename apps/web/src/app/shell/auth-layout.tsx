import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthShowcase } from "./auth-showcase";
import { Brand } from "@/components/brand/brand";

export const AuthShell = ({ children }: { children: ReactNode }) => (
  <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
    <AuthShowcase />
    <div className="flex flex-col items-center justify-center gap-6 p-6">
      <div className="lg:hidden">
        <Brand />
      </div>
      {children}
    </div>
  </div>
);

export const AuthLayout = () => (
  <AuthShell>
    <Outlet />
  </AuthShell>
);
