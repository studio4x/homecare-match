"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  MailWarning, 
  MailCheck,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { translateAuthError } from "@/lib/error-utils";

const authSchema = z.object({
  fullName: z.string({ required_error: "Nome é obrigatório" }).min(3, "Digite seu nome completo").optional(),
  email: z.string({ required_error: "E-mail é obrigatório" }).email("Digite um e-mail válido"),
  password: z.string({ required_error: "Senha é obrigatória" }).min(6, "A senha deve ter pelo menos 6 caracteres"),
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
  if (data.confirmPassword !== undefined && (!data.fullName || data.fullName.trim().length < 3)) {
    return false;
  }
  return true;
}, {
  message: "Nome completo é obrigatório para cadastro",
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
        
        setShowSuccessModal(true);
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
      toast.error(translateAuthError(error.message));
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

      {/* Modal de Sucesso Customizado */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl animate-scale-in">
          <div className="relative bg-card p-12 md:p-16 flex flex-col items-center text-center space-y-8">
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </button>

            <div className="h-24 w-24 rounded-full bg-success/10 flex items-center justify-center animate-bounce">
              <MailCheck className="h-12 w-12 text-success" />
            </div>

            <div className="space-y-4">
              <DialogTitle className="text-4xl font-bold tracking-tight text-foreground">
                Conta criada com sucesso!
              </DialogTitle>
              <DialogDescription className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Enviamos um link de confirmação para o seu e-mail. Por favor, <strong>verifique sua caixa de entrada</strong> para ativar sua conta e começar.
              </DialogDescription>
            </div>

            <Button 
              size="lg" 
              className="w-full max-w-xs h-14 text-lg font-semibold shadow-lg"
              onClick={() => setShowSuccessModal(false)}
            >
              Entendido
            </Button>
            
            <p className="text-sm text-muted-foreground italic">
              Não recebeu? Verifique sua caixa de spam ou lixo eletrônico.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthForm;