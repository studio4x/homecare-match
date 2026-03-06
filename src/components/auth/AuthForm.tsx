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
  UserPlus,
  HelpCircle,
  Ticket
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter
} from "@/components/ui/dialog";
import { translateAuthError } from "@/lib/error-utils";
import { trackAccountCreated } from "@/lib/tracking";
import { useNavigate } from "react-router-dom";

const authSchema = z.object({
  fullName: z.string().optional(),
  email: z.string({ required_error: "E-mail é obrigatório" }).email("Digite um e-mail válido"),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  couponCode: z.string().optional(),
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
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showResetSentModal, setShowResetSentModal] = useState(false);

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    getValues
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      confirmPassword: "",
      couponCode: ""
    }
  });

  const handleResetPassword = async () => {
    const email = getValues("email");
    if (!email) {
      toast.error("Digite seu e-mail primeiro.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/redefinir-senha",
      });
      if (error) throw error;
      
      setShowForgotPasswordModal(false);
      setShowEmailExistsModal(false);
      setShowResetSentModal(true);
    } catch (error: any) {
      toast.error(translateAuthError(error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmationEmail = async (email: string) => {
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) {
      toast.error("Digite seu e-mail para reenviar a confirmação.");
      return;
    }

    const toastId = toast.loading("Reenviando e-mail de confirmação...");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: window.location.origin + "/dashboard",
        },
      });

      if (error) throw error;
      toast.success("E-mail de confirmação reenviado com sucesso.", { id: toastId });
    } catch (error: any) {
      toast.error(translateAuthError(error.message), { id: toastId });
    }
  };

  const onSubmit = async (data: AuthFormData) => {
    if (mode === "register") {
      if (!data.fullName || data.fullName.length < 3) {
        toast.error("Nome completo é obrigatório");
        return;
      }
      if (!data.password || data.password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
      if (data.password !== data.confirmPassword) {
        setError("confirmPassword", { message: "As senhas não coincidem" });
        toast.error("As senhas não coincidem");
        return;
      }

      // VALIDAÇÃO DE CUPOM ANTES DO REGISTRO
      if (data.couponCode?.trim()) {
        setLoading(true);
        try {
          const { data: coupon, error: couponError } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', data.couponCode.trim().toUpperCase())
            .eq('is_active', true)
            .maybeSingle();

          if (couponError || !coupon) {
            toast.error("Cupom inválido ou expirado.");
            setLoading(false);
            return;
          }

          if (coupon.current_uses >= coupon.max_uses) {
            toast.error("Este cupom já atingiu o limite máximo de utilizações.");
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("[Coupon Validation Error]", err);
        }
      }
    }

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
            emailRedirectTo: window.location.origin + "/dashboard",
            data: {
              full_name: data.fullName,
              coupon_code: data.couponCode?.trim().toUpperCase() || null
            }
          }
        });

        if (error) {
          if (error.message.toLowerCase().includes("user already registered")) {
            setShowEmailExistsModal(true);
            return;
          }
          throw error;
        }

        if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
          setShowEmailExistsModal(true);
          return;
        }

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

        trackAccountCreated("professional", {
          dedupeKey: signUpData?.user?.id,
          email: signUpData?.user?.email || data.email,
        });
        setShowSuccessRegisterModal(true);
        setMode("login");
        reset();
      } else {
        if (loginMethod === "password") {
          const { data: signInData, error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password!,
          });

          if (error) {
            if (error.message.includes("Email not confirmed")) {
              let emailConfirmationToastId: string | number;
              emailConfirmationToastId = toast.error("Verifique seu e-mail para continuar.", {
                description: (
                  <div className="space-y-3">
                    <p>Clique no link de confirmação enviado para sua caixa de entrada.</p>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        toast.dismiss(emailConfirmationToastId);
                        await handleResendConfirmationEmail(data.email);
                      }}
                    >
                      Reenviar e-mail de confirmação
                    </Button>
                  </div>
                ),
                icon: <MailWarning className="h-5 w-5" />,
                duration: Infinity,
                closeButton: true,
              });
              return;
            }
            throw error;
          }
          
          toast.success("Bem-vindo de volta!");
          
          if (onSuccess) {
            onSuccess();
          } else {
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

        {(mode === "register" || (mode === "login" && loginMethod === "password")) && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              {mode === "login" && (
                <button 
                  type="button" 
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
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
          <>
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

            <div className="space-y-2 animate-fade-in pt-2">
              <Label htmlFor="couponCode" className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                Cupom de Lançamento (Opcional)
              </Label>
              <Input
                id="couponCode"
                placeholder="Ex: LANÇAMENTO30"
                {...register("couponCode")}
                className="uppercase font-mono"
              />
              <p className="text-[10px] text-muted-foreground italic">Se você possui um código promocional, insira-o aqui para ganhar dias grátis.</p>
            </div>
          </>
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

      {/* Modal: E-mail já existe */}
      <Dialog open={showEmailExistsModal} onOpenChange={setShowEmailExistsModal}>
        <DialogContent className="max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">E-mail já cadastrado</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Já existe uma conta vinculada a este e-mail em nossa plataforma.
          </DialogDescription>
          
          <div className="flex flex-col gap-3 mt-8">
            <Button 
              onClick={() => {
                setShowEmailExistsModal(false);
                setMode("login");
              }} 
              className="w-full h-12 text-base font-semibold"
            >
              Fazer Login agora
            </Button>
            <Button 
              variant="outline" 
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Esqueci minha senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Esqueci Senha */}
      <Dialog open={showForgotPasswordModal} onOpenChange={setShowForgotPasswordModal}>
        <DialogContent className="max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">Recuperar Senha</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Enviaremos um link para o e-mail <strong>{getValues("email")}</strong> para você criar uma nova senha.
          </DialogDescription>
          
          <div className="flex flex-col gap-3 mt-8">
            <Button 
              onClick={handleResetPassword} 
              disabled={loading}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Link de Recuperação
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowForgotPasswordModal(false)}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Link de Reset Enviado */}
      <Dialog open={showResetSentModal} onOpenChange={setShowResetSentModal}>
        <DialogContent className="max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
            <MailCheck className="h-8 w-8 text-success" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">E-mail enviado!</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Verifique sua caixa de entrada. Se o e-mail estiver correto, você receberá as instruções para redefinir sua senha em instantes.
          </DialogDescription>
          <Button onClick={() => setShowResetSentModal(false)} className="w-full mt-6">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

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
