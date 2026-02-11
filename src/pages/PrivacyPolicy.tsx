"use client";

import Layout from "@/components/layout/Layout";
import { Shield } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        </div>

        <div className="prose prose-slate max-w-none bg-card p-8 rounded-2xl border shadow-sm">
          <p className="text-muted-foreground italic">Última atualização: 11 de fevereiro de 2024</p>
          
          <h2>1. Introdução</h2>
          <p>A HomeCare Match valoriza a sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações pessoais ao utilizar nossa plataforma.</p>

          <h2>2. Informações que Coletamos</h2>
          <p>Coletamos informações que você nos fornece diretamente ao criar uma conta, como nome, e-mail, telefone, documentos de identificação (para verificação) e dados profissionais.</p>

          <h2>3. Uso das Informações</h2>
          <p>Utilizamos seus dados para:</p>
          <ul>
            <li>Conectar profissionais de saúde a empresas e famílias;</li>
            <li>Verificar a autenticidade de perfis profissionais;</li>
            <li>Melhorar nossos serviços e experiência do usuário;</li>
            <li>Enviar comunicações importantes sobre sua conta.</li>
          </ul>

          <h2>4. Compartilhamento de Dados</h2>
          <p>Seus dados de contato (como WhatsApp) só são exibidos para usuários logados que demonstrem interesse em seu perfil. Não vendemos suas informações para terceiros.</p>

          <h2>5. Segurança</h2>
          <p>Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados, incluindo criptografia e armazenamento em servidores seguros.</p>

          <h2>6. Seus Direitos</h2>
          <p>Você tem o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento através das configurações do seu perfil.</p>

          <h2>7. Contato</h2>
          <p>Para dúvidas sobre esta política, entre em contato pelo e-mail: contato@homecarematch.com.br</p>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;