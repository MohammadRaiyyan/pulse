export const CodeBlock = ({ children }: { children: string }) => (
  <pre className="max-h-80 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all">
    {children}
  </pre>
);
