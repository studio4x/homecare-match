import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProfessionalStats = {
  total: number;
  bySpecialty: Record<string, number>;
};

export function useProfessionalStats(specialties: string[]) {
  return useQuery({
    queryKey: ["professional-stats", specialties],
    queryFn: async (): Promise<ProfessionalStats> => {
      const base = () =>
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "professional")
          .eq("email_confirmed", true)
          .not("full_name", "is", null);

      const { count: total, error: totalError } = await base();
      if (totalError) throw totalError;

      const counts = await Promise.all(
        specialties.map(async (specialty) => {
          const { count, error } = await base().eq("specialty", specialty);
          if (error) throw error;
          return [specialty, count ?? 0] as const;
        })
      );

      return {
        total: total ?? 0,
        bySpecialty: Object.fromEntries(counts),
      };
    },
    staleTime: 60_000,
  });
}
