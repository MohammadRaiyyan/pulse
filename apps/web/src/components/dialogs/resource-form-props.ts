export type ResourceFormProps<TInput> = {
  defaultValues: TInput;
  submitLabel: string;
  onSubmit: (input: TInput) => Promise<unknown>;
  onCancel: () => void;
};
