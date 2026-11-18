import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@pulse/ui/components/card";
import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
};

export const AuthCard = ({
  title,
  description,
  footer,
  children,
}: AuthCardProps) => (
  <Card className="w-full max-w-sm shadow-[0_24px_60px_-30px_oklch(0.2_0.006_160/30%)]">
    <CardHeader>
      <CardTitle className="font-heading text-2xl tracking-tight">
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
    <CardFooter className="justify-center text-sm text-muted-foreground">
      {footer}
    </CardFooter>
  </Card>
);
