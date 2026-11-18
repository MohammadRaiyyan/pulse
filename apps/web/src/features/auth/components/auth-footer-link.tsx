import { type LinkProps, Link } from "@tanstack/react-router";

type AuthFooterLinkProps = {
  prompt: string;
  to: LinkProps["to"];
  label: string;
};

export const AuthFooterLink = ({ prompt, to, label }: AuthFooterLinkProps) => (
  <p>
    {prompt}{" "}
    <Link to={to} className="text-foreground underline underline-offset-4">
      {label}
    </Link>
  </p>
);
