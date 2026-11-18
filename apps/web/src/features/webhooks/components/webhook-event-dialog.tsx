import type { WebhookEvent } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@pulse/ui/components/tabs";
import { CodeBlock } from "@/components/data/code-block";
import { Modal } from "@/components/dialogs/modal";
import { formatDateTime } from "@/lib/format/date";
import { formatPayload } from "@/lib/format/payload";

const formatHeaders = (headers: WebhookEvent["headers"]) =>
  Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

export const WebhookEventDialog = ({ event }: { event: WebhookEvent }) => (
  <Modal
    title={`${event.method} from ${event.sourceIp}`}
    description={`Received ${formatDateTime(event.receivedAt)}`}
    size="wide"
    trigger={<Button variant="outline">Inspect</Button>}
  >
    <Tabs defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="headers">Headers</TabsTrigger>
      </TabsList>
      <TabsContent value="body">
        <CodeBlock>{formatPayload(event.body)}</CodeBlock>
      </TabsContent>
      <TabsContent value="headers">
        <CodeBlock>{formatHeaders(event.headers)}</CodeBlock>
      </TabsContent>
    </Tabs>
  </Modal>
);
