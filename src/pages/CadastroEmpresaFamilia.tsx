"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Eye, EyeOff, MailCheck, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Layout from "@/components/layout/Layout";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { translateAuthError } from "@/lib/error-utils";
import { trackAccountCreated } from "@/lib/tracking";
import { trackShortLinkSignupConversion } from "@/lib/short-link-attribution";

const registerSchema = z.object({
  fullName: z.string({ required_error: "Nome é obrigatório" }).min(3, "O nome da empresa ou responsável é obrigatório"),
  email: z.string({ required_error: "E-mail é obrigatório" }).email("Digite um e-mail válido"),
  role: z.enum(["company", "family"], { required_error: "Selecione o tipo de conta" }),
  password: z.string({ required_error: "Senha é obrigatória" }).min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string({ required_error: "Confirmação de senha é obrigatória" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const CadastroEmpresaFamilia = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardRedirectUrl = `${window.location.origin}/dashboard`;

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: undefined,
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const roleParam = new URLSearchParams(location.search).get("role");
    if (roleParam === "company" || roleParam === "family") {
      form.setValue("role", roleParam, { shouldValidate: true });
    }
  }, [location.search, form]);

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: dashboardRedirectUrl,
          data: {
            full_name: data.fullName,
            role: data.role,
          },
        },
      });
      if (error) throw error;

      trackAccountCreated(data.role, {
        dedupeKey: signUpData?.user?.id,
        email: signUpData?.user?.email || data.email,
      });
      await trackShortLinkSignupConversion(signUpData?.user?.id || null);
      
      setShowSuccessModal(true);
      form.reset();
    } catch (error: any) {
      toast.error(translateAuthError(error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center py-12 px-4 bg-secondary/20">
        <div className="w-full max-w-lg space-y-8 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success">
              <Building2 className="h-6 w-6 text-success-foreground" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              Acesso para Empresas e Famílias
            </h2>
            <p className="mt-2 text-muted-foreground">
              Crie sua conta para encontrar os melhores profissionais de Home Care.
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Conta</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione se você é uma empresa ou família" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company">Empresa de Home Care</SelectItem>
                        <SelectItem value="family">Família / Responsável</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa ou Responsável</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Clínica Bem Cuidar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail de Contato</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contato@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} {...field} />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <Input type={showPassword ? "text" : "password"} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conta Gratuita"}
              </Button>
            </form>
          </Form>
          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Faça login aqui
            </Link>
          </p>
        </div>
      </div>

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
                Enviamos um link de confirmação para o seu e-mail. Por favor, <strong>verifique sua caixa de entrada</strong> para ativar sua conta e começar a buscar profissionais.
              </DialogDescription>
            </div>
            <Button 
              size="lg" 
              className="w-full max-w-xs h-14 text-lg font-semibold shadow-lg"
              onClick={() => setShowSuccessModal(false)}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default CadastroEmpresaFamilia;
