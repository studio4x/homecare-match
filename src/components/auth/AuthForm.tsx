"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, AlertCircle, MailWarning, MailCheck } from "lucide-react";
import { toast } from "sonner";

const authSchema = z.object({
  fullName: z.string().min(3, "Digite seu nome completo").optional(),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((data) => {
  // Se estiver no modo registro (confirmPassword existe), fullName é obrigatório
  if (data.confirmPassword !== undefined && (!data.fullName || data.fullName.trim().length < 3)) {
    return false;
  }
  return true;
}, {
  message: "Nome completo é obrigatório",
  path: ["fullName"],
});

type AuthFormData = z.infer<typeof authSchema>;

interface AuthFormProps {
  mode: "login" | "register";
  onSuccess?: () => void;
  allowRegister?: boolean;
}

const AuthForm = ({ mode: initialMode, onSuccess, allowRegister = true }: AuthFormProps) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  const onSubmit = async (data: AuthFormData) => {
    setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
            }
          }
        });
        if (error) throw error;
        
        toast.success("Conta criada com sucesso!", {
          description: "Enviamos um link de confirmação para o seu e-mail. Por favor, verifique sua caixa de entrada para ativar sua conta.",
          icon: <MailCheck className="h-5 w-5 text-success" />,
          duration: 10000,
        });
        
        setMode("login");
        reset();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            toast.error("Verifique seu e-mail para continuar.", {
              description: "Clique no link de confirmação enviado para sua caixa de entrada.",
              icon: <MailWarning className="h-5 w-5" />,
              duration: 10000,
            });
            return;
          }
          throw error;
        }
        toast.success("Bem-vindo de volta!");
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {mode === "register" && (
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              placeholder="Nome e Sobrenome"
              {...register("fullName")}
              className={errors.fullName ? "border-destructive" : ""}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            {...register("email")}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...register("password")}
              className={errors.password ? "border-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {mode === "register" && (
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              {...register("confirmPassword")}
              className={errors.confirmPassword ? "border-destructive" : ""}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : mode === "login" ? (
            "Entrar"
          ) : (
            "Criar Conta"
          )}
        </Button>
      </form>

      {allowRegister && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              reset();
            }}
            className="text-sm text-primary hover:underline"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre aqui"}
          </button>
        </div>
      )}

      {!allowRegister && mode === "login" && (
        <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>O cadastro de novos administradores está desabilitado. Entre com uma conta existente.</p>
        </div>
      )}
    </div>
  );
};

export default AuthForm;