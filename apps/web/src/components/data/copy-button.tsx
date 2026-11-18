import { CopyIcon } from "lucide-react";
import { IconButton } from "@/components/actions/icon-button";
import { toast } from "sonner";

type CopyButtonProps = {
  value: string;
  label: string;
};

export const CopyButton = ({ value, label }: CopyButtonProps) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <IconButton onClick={copy} label={`Copy ${label}`}>
      <CopyIcon />
    </IconButton>
  );
};
