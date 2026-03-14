import { useQuery } from "@tanstack/react-query";
import { getBriefProvenance } from "../api";
import type { BriefProvenance } from "../types";

export const provenanceKeys = {
  detail: (briefId: string) => ["brief-provenance", briefId] as const,
};

export function useBriefProvenance(briefId: string | null, enabled = false) {
  return useQuery<BriefProvenance>({
    queryKey: provenanceKeys.detail(briefId ?? ""),
    queryFn: () => getBriefProvenance(briefId!),
    enabled: enabled && !!briefId,
    staleTime: Infinity,
  });
}
