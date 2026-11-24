export type SseMessage = {
  event: string;
  data: string;
  id: string | undefined;
};

type SseDraft = {
  event: string;
  data: string[];
  id: string | undefined;
};

const DEFAULT_EVENT = "message";
const LINE_BREAK = /\r\n|\r|\n/;

const emptyDraft = (): SseDraft => ({
  event: DEFAULT_EVENT,
  data: [],
  id: undefined,
});

export const formatSseMessage = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const formatSseComment = (text: string) => `: ${text}\n\n`;

const splitField = (line: string) => {
  const colon = line.indexOf(":");

  if (colon === -1) {
    return { field: line, value: "" };
  }

  const value = line.slice(colon + 1);

  return {
    field: line.slice(0, colon),
    value: value.startsWith(" ") ? value.slice(1) : value,
  };
};

export const createSseParser = (onMessage: (message: SseMessage) => void) => {
  let buffer = "";
  let draft = emptyDraft();

  const dispatch = () => {
    if (draft.data.length > 0) {
      onMessage({
        event: draft.event,
        data: draft.data.join("\n"),
        id: draft.id,
      });
    }

    draft = emptyDraft();
  };

  const readLine = (line: string) => {
    if (line === "") {
      dispatch();
      return;
    }

    if (line.startsWith(":")) {
      return;
    }

    const { field, value } = splitField(line);

    if (field === "event") {
      draft.event = value || DEFAULT_EVENT;
    } else if (field === "data") {
      draft.data.push(value);
    } else if (field === "id") {
      draft.id = value;
    }
  };

  return (chunk: string) => {
    const text = buffer + chunk;
    const endsWithCarriageReturn = text.endsWith("\r");
    const lines = (endsWithCarriageReturn ? text.slice(0, -1) : text).split(
      LINE_BREAK,
    );

    buffer = (lines.pop() ?? "") + (endsWithCarriageReturn ? "\r" : "");

    for (const line of lines) {
      readLine(line);
    }
  };
};
