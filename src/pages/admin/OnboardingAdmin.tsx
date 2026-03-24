import React, from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const OnboardingAdmin = () => {
  const { data: flows, isLoading } = useQuery({
    queryKey: ["admin_onboarding_flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_email_flows")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl flex justify-between font-bold text-gray-900 border-b border-gray-200 pb-2">
          Automação de E-mails
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle>Fluxos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {isLoading ? "..." : flows?.filter(f => f.is_active).length || 0}
            </div>
            <p className="text-sm text-gray-500 mt-2">Fluxos rodando no momento</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Público</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows?.map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell className="font-medium">{flow.name}</TableCell>
                  <TableCell className="capitalize">{flow.audience_type}</TableCell>
                  <TableCell>
                    <Badge variant={flow.is_active ? "default" : "secondary"}>
                      {flow.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {/* Placeholder para as ações de CRUD que serão detalhadas */}
                    <button className="text-sm text-primary hover:underline">Ver Detalhes</button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && flows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    Nenhum fluxo encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingAdmin;
