export type EmailTutorialRole = "professional" | "company" | "family";

export type EmailTutorialStep = {
  role: EmailTutorialRole;
  roleLabel: string;
  step: number;
  text: string;
  featureKey: string;
  title: string;
};

const ROLE_LABELS: Record<EmailTutorialRole, string> = {
  professional: "Profissional",
  company: "Empresa",
  family: "Familia",
};

const buildFeatureKey = (role: EmailTutorialRole, step: number) => `email-confirmed-${role}-step-${step}`;

export const getEmailConfirmationSteps = (role: EmailTutorialRole): EmailTutorialStep[] => {
  const roleLabel = ROLE_LABELS[role];

  const common = [
    {
      step: 1,
      text: "Complete seu perfil no Dashboard > Perfil.",
    },
    {
      step: 2,
      text: "Envie e valide seus documentos para analise.",
    },
  ];

  if (role === "company") {
    return [
      ...common,
      { step: 3, text: "Cadastre os pacientes que necessitam de profissionais." },
      { step: 4, text: "Busque profissionais para iniciar os contatos." },
    ].map((item) => ({
      role,
      roleLabel,
      step: item.step,
      text: item.text,
      featureKey: buildFeatureKey(role, item.step),
      title: `${roleLabel} - Etapa ${item.step}`,
    }));
  }

  if (role === "family") {
    return [
      ...common,
      { step: 3, text: "Busque profissionais para iniciar os contatos." },
    ].map((item) => ({
      role,
      roleLabel,
      step: item.step,
      text: item.text,
      featureKey: buildFeatureKey(role, item.step),
      title: `${roleLabel} - Etapa ${item.step}`,
    }));
  }

  return [
    ...common,
    {
      step: 3,
      text: "Mantenha-se conectado(a) na plataforma, e-mail ou WhatsApp para receber contatos de empresas e familias.",
    },
  ].map((item) => ({
    role,
    roleLabel,
    step: item.step,
    text: item.text,
    featureKey: buildFeatureKey(role, item.step),
    title: `${roleLabel} - Etapa ${item.step}`,
  }));
};

export const getAllEmailConfirmationSteps = (): EmailTutorialStep[] => [
  ...getEmailConfirmationSteps("professional"),
  ...getEmailConfirmationSteps("company"),
  ...getEmailConfirmationSteps("family"),
];
