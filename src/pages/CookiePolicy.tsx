"use client";

import Layout from "@/components/layout/Layout";
import { Cookie } from "lucide-react";

const CookiePolicy = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cookie className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Política de Cookies</h1>
        </div>

        <div className="prose prose-slate max-w-none bg-card p-8 rounded-2xl border shadow-sm">
          <p className="text-muted-foreground italic">Última atualização: 11 de fevereiro de 2024</p>

          <h2>1. O que são Cookies?</h2>
          <p>Cookies são pequenos arquivos de texto enviados pelo site ao seu navegador e armazenados no seu dispositivo. Eles permitem que o site "lembre" de suas ações ou preferências ao longo do tempo.</p>

          <h2>2. Como usamos os Cookies?</h2>
          <p>Utilizamos cookies para:</p>
          <ul>
            <li><strong>Essenciais:</strong> Necessários para o funcionamento do site e login;</li>
            <li><strong>Analíticos:</strong> Para entender como os visitantes interagem com o site (Google Analytics);</li>
            <li><strong>Marketing:</strong> Para exibir anúncios relevantes e medir a eficácia de campanhas.</li>
          </ul>

          <h2>3. Tipos de Cookies que utilizamos</h2>
          <p>Utilizamos cookies de sessão (temporários) e cookies persistentes (que permanecem no seu dispositivo até expirarem ou serem excluídos).</p>

          <h2>4. Controle de Cookies</h2>
          <p>Você pode gerenciar ou desativar cookies nas configurações do seu navegador. No entanto, desativar cookies essenciais pode afetar a funcionalidade do site.</p>

          <h2>5. Alterações nesta Política</h2>
          <p>Podemos atualizar esta política periodicamente. Recomendamos que você a revise regularmente.</p>
        </div>
      </div>
    </Layout>
  );
};

export default CookiePolicy;