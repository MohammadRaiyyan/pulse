import { useSuspenseQuery } from "@tanstack/react-query";
import { authConfigQuery } from "../api/auth-api";

export const useAuthConfig = () => useSuspenseQuery(authConfigQuery).data;
