"use client";

import React from "react";
import CreateUserForm from "@/components/admin/CreateUserForm";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const CreateUserPage = () => {
  const navigate = useNavigate();

  const handleUserCreated = () => {
    toast.success("Usuário criado com sucesso! Redirecionando para a lista de usuários.");
    navigate("/admin/usuarios");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Criar Novo Usuário</h1>
        <p className="text-muted-foreground">Preencha os dados para criar uma nova conta e seu perfil completo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Formulário de Criação
          </CardTitle>
          <CardDescription>Todos os campos marcados com * são obrigatórios.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm onUserCreated={handleUserCreated} />
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateUserPage;