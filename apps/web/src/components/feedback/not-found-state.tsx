import { Button } from "@pulse/ui/components/button";
import { Link } from "@tanstack/react-router";
import { FileQuestionIcon } from "lucide-react";
import { EmptyState } from "./empty-state";

export const NotFoundState = () => (
  <EmptyState
    icon={FileQuestionIcon}
    title="Page not found"
    description="The page you are looking for does not exist or was moved."
    action={
      <Button variant="ghost-accent" asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    }
  />
);
