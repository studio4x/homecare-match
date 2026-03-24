import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProfessionalStats = {
  total: number;
};

export function useProfessionalStats() {
  return useQuery({
    queryKey: ["professional-stats"],
    queryFn: async (): Promise<ProfessionalStats> => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "professional")
        .eq("is_hidden", false)
        .eq("email_confirmed", true)
        .not("full_name", "is", null);

      if (error) throw error;

      return {
        total: count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}