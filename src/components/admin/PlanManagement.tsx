"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PlanManagement = () => {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("price");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Planos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div key={plan.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    {plan.popular && <Badge className="bg-primary/10 text-primary border-primary/20"><Star className="h-3 w-3 mr-1" /> Popular</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <ul className="space-y-1 text-sm">
                    {plan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" disabled>Editar Plano</Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">Nenhum plano encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanManagement;