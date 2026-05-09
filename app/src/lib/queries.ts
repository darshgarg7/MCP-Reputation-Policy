import { queryOptions } from "@tanstack/react-query";
import { fetchDemoHealth, fetchServers } from "./api-client";

export const SERVERS_QUERY_KEY = ["servers"] as const;
export const DEMO_HEALTH_QUERY_KEY = ["demo-health"] as const;

export const serversQueryOptions = () =>
  queryOptions({
    queryKey: SERVERS_QUERY_KEY,
    queryFn: fetchServers,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 1000,
    retry: 2,
  });

export const demoHealthQueryOptions = () =>
  queryOptions({
    queryKey: DEMO_HEALTH_QUERY_KEY,
    queryFn: fetchDemoHealth,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 1000,
    retry: 1,
  });
