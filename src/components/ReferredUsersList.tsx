"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle2, Circle, UserCheck, Users } from "lucide-react";

interface ReferralStages {
  signup_created: boolean;
  email_confirmed: boolean;
  profile_completed: boolean;
  documents_verified: boolean;
}

interface RegisteredUser {
  id: string;
  full_name: string;
  created_at: string;
  role: string;
  current_status: string;
  is_valid_referral: boolean;
  stages: ReferralStages;
}

interface ReferredUsersListProps {
  users: RegisteredUser[];
  loading: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  professional: "Profissional",
  company: "Empresa",
  family: "Familia",
};

const STAGE_META: Array<{ key: keyof ReferralStages; label: string }> = [
  { key: "signup_created", label: "Criou cadastro" },
  { key: "email_confirmed", label: "Validou e-mail" },
  { key: "profile_completed", label: "Preencheu perfil" },
  { key: "documents_verified", label: "Validou documentos" },
];

const ReferredUsersList = ({ users, loading }: ReferredUsersListProps) => {
  if (loading) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="py-10 text-center text-muted-foreground">Carregando lista de indicados...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-primary" />
          Cadastros Confirmados ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length > 0 ? (
          <div className="space-y-3">
            {users.map((user) => {
              const completedStages = STAGE_META.reduce((acc, stage) => {
                return acc + (user.stages?.[stage.key] ? 1 : 0);
              }, 0);
              const progressPercent = Math.round((completedStages / STAGE_META.length) * 100);

              return (
                <div key={user.id} className="space-y-2 rounded-lg border bg-secondary/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">{user.full_name || "Usuario em conclusao"}</p>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="h-4 text-[9px] uppercase">
                          {ROLE_LABEL[user.role] || "Profissional"}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(user.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={user.is_valid_referral ? "bg-success hover:bg-success/90" : ""} variant={user.is_valid_referral ? "default" : "outline"}>
                        {user.is_valid_referral ? "Indicacao valida" : "Em andamento"}
                      </Badge>
                      <Badge variant="secondary" className="h-5 text-[10px]">
                        {completedStages}/{STAGE_META.length} etapas
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Progresso da indicacao: {progressPercent}%</p>
                  </div>

                  <p className="text-xs text-muted-foreground">Status atual: {user.current_status}</p>

                  <div className="grid gap-1">
                    {STAGE_META.map((stage) => {
                      const done = !!user.stages?.[stage.key];
                      return (
                        <div key={stage.key} className="flex items-center gap-2 text-[11px]">
                          {done ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className={done ? "text-foreground" : "text-muted-foreground"}>{stage.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum cadastro realizado pelo seu link ainda.</p>
            <p className="mt-1 text-[10px]">A indicacao so se torna valida ao chegar em "Validou documentos".</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferredUsersList;
