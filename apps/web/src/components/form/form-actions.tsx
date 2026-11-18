import { Button } from "@pulse/ui/components/button";
import { SubmitButton } from "./submit-button";

type FormActionsProps = {
  submitLabel: string;
  onCancel: () => void;
};

export const FormActions = ({ submitLabel, onCancel }: FormActionsProps) => (
  <div className="flex justify-end gap-2">
    <Button type="button" variant="ghost" onClick={onCancel}>
      Cancel
    </Button>
    <SubmitButton>{submitLabel}</SubmitButton>
  </div>
);
