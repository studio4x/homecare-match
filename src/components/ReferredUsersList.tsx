"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RegisteredUser {
  full_name: string;
  created_at: string;
  role: string;
}

interface ReferredUsersListProps {
  users: RegisteredUser[];
  loading: boolean;
}

const ReferredUsersList = ({ users, loading }: ReferredUsersListProps) => {
  if (loading) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          Carregando lista de indicados...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Cadastros Confirmados ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length > 0 ? (
          <div className="space-y-3">
            {users.map((u, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/5">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">{u.full_name || "Usuário em conclusão"}</p>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[9px] uppercase h-4">
                      {u.role === 'professional' ? 'Profissional' : u.role === 'company' ? 'Empresa' : 'Família'}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-success" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhum cadastro realizado pelo seu link ainda.</p>
            <p className="text-[10px] mt-1">Compartilhe seu link para começar a ganhar selos!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferredUsersList;