import { queryOptions } from "@tanstack/react-query";
import { fetchServers } from "./api-client";

export const SERVERS_QUERY_KEY = ["servers"] as const;

export const serversQueryOptions = () =>
  queryOptions({
    queryKey: SERVERS_QUERY_KEY,
    queryFn: fetchServers,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 1000,
    retry: 2,
  });
