"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  MailWarning, 
  MailCheck,
  X,
  Sparkles,
  KeyRound,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { translateAuthError } from "@/lib/error-utils";
import { useNavigate } from "react-router-dom";

// REMOVIDO o superRefine daqui para evitar bloqueio no Login
// A validação de senhas iguais será feita manualmente no onSubmit
const authSchema = z.object({
  fullName: z.string().optional(),
  email: z.string({ required_error: "E-mail é obrigatório" }).email("Digite um e-mail válido"),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

interface AuthFormProps {
  mode: "login" | "register";
  onSuccess?: () => void;
  allowRegister?: boolean;
}

const AuthForm = ({ mode: initialMode, onSuccess, allowRegister = true }: AuthFormProps) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [loginMethod, setLoginMethod] = useState<"password" | "magic_link">("password");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Modais
  const [showSuccessRegisterModal, setShowSuccessRegisterModal] = useState(false);
  const [showMagicLinkSentModal, setShowMagicLinkSentModal] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError, // Usado para setar erro manual
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      confirmPassword: ""
    }
  });

  const onSubmit = async (data: AuthFormData) => {
    // --- VALIDAÇÕES MANUAIS ---
    
    // Validação específica para REGISTRO
    if (mode === "register") {
      if (!data.fullName || data.fullName.length < 3) {
        toast.error("Nome completo é obrigatório");
        return;
      }
      if (!data.password || data.password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
      // Aqui fazemos a verificação de senhas iguais apenas no registro
      if (data.password !== data.confirmPassword) {
        setError("confirmPassword", { message: "As senhas não coincidem" });
        toast.error("As senhas não coincidem");
        return;
      }
    }

    // Validação específica para LOGIN com SENHA
    if (mode === "login" && loginMethod === "password") {
      if (!data.password) {
        toast.error("Digite sua senha");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password!,
          options: {
            data: {
              full_name: data.fullName,
            }
          }
        });
        if (error) throw error;

        // Registro de indicação (se houver ?ref=)
        const referrerId = new URLSearchParams(window.location.search).get("ref");
        if (referrerId && signUpData?.user?.id) {
          try {
            await supabase.functions.invoke('record-referral', {
              body: {
                referrerId,
                newUserId: signUpData.user.id,
              }
            });
          } catch (invokeErr) {
            console.warn("[AuthForm] Falha ao registrar indicação:", invokeErr);
          }
        }

        setShowSuccessRegisterModal(true);
        setMode("login");
        reset();
      } else {
        // Lógica de Login
        if (loginMethod === "password") {
          const { data: signInData, error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password!,
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
          
          if (onSuccess) {
            onSuccess();
          } else {
            // Verifica se é admin para redirecionar corretamente
            const { data: profile } = await supabase
              .from('profiles')
              .select('is_admin, role')
              .eq('id', signInData.user.id)
              .maybeSingle();

            if (profile?.is_admin || profile?.role === 'admin') {
              navigate('/admin');
            } else {
              navigate('/dashboard');
            }
          }
        } else {
          // Lógica Magic Link (Sem senha)
          const { error } = await supabase.auth.signInWithOtp({
            email: data.email,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: window.location.origin + "/dashboard",
            },
          });

          if (error) {
            if (error.message.includes("Signups not allowed") || error.message.includes("not found")) {
              setShowUserNotFoundModal(true);
              return;
            }
            throw error;
          }

          setShowMagicLinkSentModal(true);
        }
      }
    } catch (error: any) {
      if (mode === "login" && loginMethod === "magic_link" && error.status === 400) {
         setShowUserNotFoundModal(true);
      } else {
        console.error("Auth error:", error);
        toast.error(translateAuthError(error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    reset();
    setShowPassword(false);
  };

  return (
    <div className="space-y-6">
      {mode === "login" && (
        <Tabs defaultValue="password" value={loginMethod} onValueChange={(v) => setLoginMethod(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Senha
            </TabsTrigger>
            <TabsTrigger value="magic_link" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Sem Senha
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
        {mode === "register" && (
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              placeholder="Nome e Sobrenome"
              {...register("fullName")}
              className={errors.fullName ? "border-destructive" : ""}
            />
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

        {/* Campo de Senha - Visível no Registro OU Login com Senha */}
        {(mode === "register" || (mode === "login" && loginMethod === "password")) && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              {mode === "login" && (
                <button type="button" className="text-xs text-muted-foreground hover:text-primary">
                  Esqueceu a senha?
                </button>
              )}
            </div>
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
          </div>
        )}

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
            loginMethod === "password" ? "Entrar" : "Enviar Link de Acesso"
          ) : (
            "Criar Conta"
          )}
        </Button>
        
        {mode === "login" && loginMethod === "magic_link" && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Enviaremos um link mágico para o seu e-mail.
          </p>
        )}
      </form>

      {allowRegister && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={toggleMode}
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

      {/* --- MODAIS --- */}

      {/* 1. Sucesso Registro */}
      <Dialog open={showSuccessRegisterModal} onOpenChange={setShowSuccessRegisterModal}>
        <DialogContent className="max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
            <MailCheck className="h-8 w-8 text-success" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">Conta criada!</DialogTitle>
          <DialogDescription className="text-lg">
            Enviamos um link de confirmação para o seu e-mail.
          </DialogDescription>
          <Button onClick={() => setShowSuccessRegisterModal(false)} className="w-full mt-6">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

      {/* 2. Magic Link Enviado */}
      <Dialog open={showMagicLinkSentModal} onOpenChange={setShowMagicLinkSentModal}>
        <DialogContent className="max-w-md p-8 text-center">
          <button onClick={() => setShowMagicLinkSentModal(false)} className="absolute right-4 top-4 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 animate-bounce">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">Link enviado!</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Verifique sua caixa de entrada. Enviamos um link mágico para você entrar sem precisar de senha.
          </DialogDescription>
          <div className="bg-secondary/50 p-3 rounded-lg mt-4 text-xs text-muted-foreground">
            Dica: Se não encontrar, verifique a pasta de Spam ou Lixo Eletrônico.
          </div>
          <Button onClick={() => setShowMagicLinkSentModal(false)} className="w-full mt-6">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

      {/* 3. Usuário Não Encontrado (Magic Link) */}
      <Dialog open={showUserNotFoundModal} onOpenChange={setShowUserNotFoundModal}>
        <DialogContent className="max-w-md p-8 text-center">
          <button onClick={() => setShowUserNotFoundModal(false)} className="absolute right-4 top-4 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <UserPlus className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">E-mail não cadastrado</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Não encontramos uma conta com este e-mail. Para acessar, você precisa criar uma conta primeiro.
          </DialogDescription>
          
          <div className="flex flex-col gap-3 mt-8">
            <Button 
              onClick={() => {
                setShowUserNotFoundModal(false);
                if (window.location.pathname.includes('login')) {
                  navigate('/cadastro-empresa');
                } else {
                  setMode("register");
                }
              }} 
              className="w-full h-12 text-base font-semibold"
            >
              Criar Conta Gratuita
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowUserNotFoundModal(false)}
              className="w-full"
            >
              Tentar outro e-mail
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthForm;