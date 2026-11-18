import { env } from "@/config/env";

export const apiPath = (path: string) => `${env.apiUrl}${path}`;
