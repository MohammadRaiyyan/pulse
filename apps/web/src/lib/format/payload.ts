const JSON_INDENT = 2;

export const formatPayload = (body: string) => {
  try {
    return JSON.stringify(JSON.parse(body), null, JSON_INDENT);
  } catch {
    return body;
  }
};
