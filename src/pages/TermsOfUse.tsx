"use client";

import Layout from "@/components/layout/Layout";
import SeoMeta from "@/components/SeoMeta";
import { FileText, ShieldAlert } from "lucide-react";

const highlights = [
  "A HomeCare Match e uma plataforma tecnologica de conexao entre profissionais de saude, empresas de home care e familias.",
  "A contratacao, a definicao de valores, a rotina de atendimento e o pagamento pelo cuidado acontecem diretamente entre as partes.",
  "A decisao de contratar um profissional e de risco exclusivo da familia ou da empresa contratante, que deve entrevistar, validar referencias e formalizar sua propria relacao contratual.",
];

const sections = [
  {
    title: "1. Aceitacao dos termos",
    paragraphs: [
      "Ao acessar, navegar, criar conta ou usar qualquer funcionalidade da HomeCare Match, voce declara que leu, entendeu e concorda com estes Termos de Uso e Risco Legal, com a Politica de Privacidade e com a Politica de Cookies.",
      "Se voce nao concordar com estas regras, nao utilize a plataforma.",
    ],
  },
  {
    title: "2. O que a HomeCare Match oferece",
    paragraphs: [
      "A HomeCare Match funciona como uma ponte tecnologica para aproximar tres publicos: profissionais da saude, empresas de home care e familias que buscam atendimento domiciliar.",
      "A plataforma oferece visibilidade de perfil, ferramentas de conexao, recursos de apoio e conteudos educacionais, incluindo a Academy.",
    ],
    bullets: [
      "Profissionais podem contratar planos de assinatura mensal ou anual para ampliar visibilidade e acessar funcionalidades premium.",
      "Cursos podem ser adquiridos de forma avulsa, conforme a oferta disponivel na plataforma.",
      "O acesso para empresas parceiras e familias e atualmente gratuito, sem garantia de gratuidade permanente.",
    ],
  },
  {
    title: "3. Natureza do servico e ausencia de vinculo",
    paragraphs: [
      "A HomeCare Match nao e agencia de empregos, nao realiza recrutamento executivo, nao faz terceirizacao de mao de obra e nao presta o servico de cuidado domiciliar em nome proprio.",
      "A plataforma nao faz gestao de escalas, nao supervisiona a execucao do atendimento no domicilio, nao assina contratos de trabalho e nao cobra taxa de agenciamento nem percentual sobre os servicos prestados.",
      "Nao existe vinculo empregaticio, societario, associativo, representativo ou de preposicao entre a HomeCare Match e os profissionais, empresas ou familias em razao do uso da plataforma.",
    ],
    bullets: [
      "A escolha de contratar ou nao contratar pertence exclusivamente ao contratante.",
      "O profissional define se aceita a oportunidade, em quais condicoes e por qual valor.",
      "Qualquer contrato de prestacao de servicos, emprego, parceria ou plantao deve ser formalizado diretamente entre as partes interessadas.",
    ],
  },
  {
    title: "4. Cadastro, elegibilidade e informacoes do usuario",
    paragraphs: [
      "Cada usuario deve fornecer informacoes verdadeiras, completas e atualizadas. O uso de dados falsos, incompletos ou de terceiros sem autorizacao podera gerar suspensao ou banimento.",
      "Os profissionais sao responsaveis pela legitimidade de seus documentos, registros de classe, certificados, experiencia informada e disponibilidade declarada.",
    ],
  },
  {
    title: "5. Selo de verificacao e criterio de confianca",
    paragraphs: [
      "Quando houver Selo de Verificacao, isso significa apenas que a HomeCare Match conferiu determinados documentos de identidade e, quando aplicavel, o registro profissional apresentado pelo usuario, como COREN ou CREFITO.",
      "O selo nao representa garantia de conduta, capacidade tecnica futura, idoneidade moral, ausencia de antecedentes, qualidade do atendimento ou adequacao do profissional a um caso concreto.",
    ],
    bullets: [
      "Familias e empresas devem sempre realizar entrevista propria antes da contratacao.",
      "Familias e empresas devem checar referencias profissionais e pessoais por conta propria.",
      "Familias e empresas devem validar a regularidade documental e profissional conforme o tipo de atendimento contratado.",
    ],
  },
  {
    title: "6. Contratacao, pagamentos e relacao entre as partes",
    paragraphs: [
      "A HomeCare Match nao participa da negociacao final do servico assistencial no domicilio. Valores, carga horaria, escala, forma de pagamento, reembolsos, substituicoes, folgas, obrigacoes acessorias e demais condicoes do atendimento sao ajustados diretamente entre contratante e profissional.",
      "O pagamento pelo cuidado domiciliar e combinado e realizado fora da plataforma, diretamente entre quem contrata e quem presta o servico, salvo se no futuro houver funcionalidade especifica comunicada em instrumento proprio.",
    ],
  },
  {
    title: "7. Assinaturas, renovacao automatica e reembolsos",
    paragraphs: [
      "Os planos premium voltados aos profissionais podem ser cobrados de forma mensal ou anual e contam com renovacao automatica por meio do provedor de pagamentos Asaas, ate que haja cancelamento nos termos aplicaveis.",
      "O usuario contratante do plano deve acompanhar seu ciclo de cobranca, manter os dados de pagamento atualizados e solicitar cancelamento antes da renovacao, quando nao desejar a continuidade.",
      "O reembolso ou estorno da assinatura ou de compras elegiveis so e garantido quando solicitado em ate 7 dias corridos da confirmacao do pagamento, em conformidade com o Codigo de Defesa do Consumidor, respeitadas as regras operacionais do meio de pagamento.",
    ],
    bullets: [
      "Apos esse prazo, a analise de eventual excecao sera discricionaria e dependera do caso concreto.",
      "Taxas, prazos de processamento e procedimentos do provedor de pagamento podem influenciar o prazo final de devolucao.",
    ],
  },
  {
    title: "8. Risco legal e limite de responsabilidade",
    paragraphs: [
      "A contratacao de atendimento domiciliar envolve avaliacao propria do contratante. Por isso, a decisao de contratar um profissional encontrado na HomeCare Match e de risco exclusivo da familia ou da empresa contratante.",
      "A HomeCare Match nao se responsabiliza, civil ou criminalmente, por fatos ocorridos durante ou em decorrencia da prestacao do servico no domicilio, incluindo acidentes, omissoes, negligencia, imprudencia, impericia, danos materiais, furtos, extravios, lesoes, abusos, conflitos interpessoais, descumprimento contratual ou disputas trabalhistas.",
      "Tambem nao respondemos por condutas praticadas por usuarios fora da plataforma, por informacoes falsas prestadas por terceiros, por interrupcoes de servicos externos ou por expectativas comerciais nao concretizadas.",
    ],
    bullets: [
      "A HomeCare Match nao garante contratacao, renda minima, volume de oportunidades ou compatibilidade entre usuarios.",
      "A HomeCare Match nao substitui diligencia, entrevista, verificacao de referencias, analise juridica ou avaliacao tecnica feita pelo contratante.",
      "Sempre que necessario, as partes devem buscar apoio juridico, contabil, trabalhista ou regulatorio proprio antes da contratacao.",
    ],
  },
  {
    title: "9. Conduta, denuncias e medidas de seguranca",
    paragraphs: [
      "Todos os usuarios devem agir com boa-fe, respeito, urbanidade e observancia da legislacao aplicavel. E proibido usar a plataforma para fraude, assedio, discriminacao, ameaca, falsidade ideologica, captacao enganosa, divulgacao indevida de dados, spam, praticas abusivas ou qualquer atividade ilicita.",
      "A HomeCare Match mantem canais de denuncia e suporte para relatar comportamentos inadequados, suspeitas de fraude, uso indevido da plataforma e outras ocorrencias relevantes.",
    ],
    bullets: [
      "Podemos suspender, restringir ou banir contas que violarem estes termos, politicas internas ou a legislacao.",
      "Tambem podemos remover perfis, anuncios, documentos ou conteudos que gerem risco juridico, reputacional ou operacional para a plataforma e para terceiros.",
      "Em casos graves com indicios de crime relatados ao suporte, a HomeCare Match podera preservar registros e encaminhar informacoes as autoridades competentes, na forma da lei.",
    ],
  },
  {
    title: "10. Privacidade, LGPD e tratamento de dados",
    paragraphs: [
      "O tratamento de dados pessoais e dados sensiveis realizado pela HomeCare Match segue a Politica de Privacidade vigente e a legislacao aplicavel, incluindo a LGPD.",
      "Documentos enviados para verificacao, dados cadastrais e informacoes profissionais sao utilizados para operacao da plataforma, seguranca, prevencao a fraude, cumprimento de obrigacoes legais e melhoria da experiencia do usuario.",
      "A HomeCare Match nao vende dados pessoais. O contato por WhatsApp e liberado apenas nas hipoteses previstas na plataforma, inclusive para usuarios logados com interesse legitimo em prosseguir na conexao.",
    ],
  },
  {
    title: "11. Propriedade intelectual e uso adequado da plataforma",
    paragraphs: [
      "A marca HomeCare Match, a identidade visual, os textos, os fluxos, as funcionalidades, os materiais da Academy e os demais ativos da plataforma sao protegidos pela legislacao aplicavel.",
      "Nao e permitido copiar, revender, raspar dados, explorar comercialmente o conteudo da plataforma sem autorizacao expressa ou utilizar a estrutura do servico para finalidades ilicitas.",
    ],
  },
  {
    title: "12. Alteracoes destes termos",
    paragraphs: [
      "A HomeCare Match pode atualizar estes Termos de Uso e Risco Legal a qualquer momento para refletir mudancas operacionais, regulatorias ou de seguranca.",
      "A versao vigente sera disponibilizada nesta pagina com a data de ultima atualizacao. O uso continuado da plataforma apos a publicacao das alteracoes representa a aceitacao da nova versao.",
    ],
  },
  {
    title: "13. Contato",
    paragraphs: [
      "Para duvidas juridicas, operacionais, pedidos relacionados a assinatura ou comunicacoes sobre estes termos, entre em contato pelos canais oficiais da HomeCare Match.",
      "E-mail: contato@homecarematch.com.br",
    ],
  },
];

const TermsOfUse = () => {
  return (
    <Layout>
      <SeoMeta
        title="Termos de Uso e Risco Legal"
        description="Leia os Termos de Uso e Risco Legal da HomeCare Match, incluindo regras de uso, limites de responsabilidade, assinaturas e diretrizes de privacidade."
        canonicalUrl="https://www.homecarematch.com.br/termos-de-uso"
      />

      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Termos de Uso e Risco Legal</h1>
            <p className="text-sm text-muted-foreground">Ultima atualizacao: 26 de marco de 2026</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Resumo juridico essencial</h2>
          </div>
          <ul className="space-y-2 text-sm leading-6">
            {highlights.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-foreground">{section.title}</h2>
              <div className="space-y-4 text-sm leading-7 text-muted-foreground">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default TermsOfUse;
