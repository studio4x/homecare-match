type CompanyFamilyRole = "company" | "family";

type RequiredField = {
  key: string;
  label: string;
};

const baseRequiredFields: RequiredField[] = [
  { key: "avatar_url", label: "Foto" },
  { key: "full_name", label: "Nome" },
  { key: "phone", label: "WhatsApp" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
];

const companyRequiredFields: RequiredField[] = [
  { key: "company_name", label: "Razão Social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "bio", label: "Descrição da Empresa" },
];

const familyRequiredFields: RequiredField[] = [
  { key: "patient_name", label: "Nome do Paciente" },
  { key: "patient_age", label: "Idade do Paciente" },
  { key: "patient_medical_conditions", label: "Condição Médica" },
  { key: "patient_specialties", label: "Especialidades Necessárias" },
  { key: "bio", label: "Outras Observações" },
  { key: "availability", label: "Horário de Atendimento" },
];

export type CompanyFamilyContactEligibility = {
  role: CompanyFamilyRole | null;
  isCompanyOrFamily: boolean;
  isProfileComplete: boolean;
  isDocumentsVerified: boolean;
  canAddProfessionalContact: boolean;
  missingProfileFields: string[];
};

const isBlank = (value: unknown) => {
  if (Array.isArray(value)) return value.length === 0;
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
};

const getRequiredFieldsForRole = (role: CompanyFamilyRole): RequiredField[] => {
  if (role === "company") return [...baseRequiredFields, ...companyRequiredFields];
  return [...baseRequiredFields, ...familyRequiredFields];
};

export const getCompanyFamilyContactEligibility = (profile: any): CompanyFamilyContactEligibility => {
  const role = profile?.role as CompanyFamilyRole | undefined;
  const isCompanyOrFamily = role === "company" || role === "family";

  if (!isCompanyOrFamily) {
    return {
      role: null,
      isCompanyOrFamily: false,
      isProfileComplete: true,
      isDocumentsVerified: true,
      canAddProfessionalContact: true,
      missingProfileFields: [],
    };
  }

  const requiredFields = getRequiredFieldsForRole(role);
  const missingProfileFields = requiredFields
    .filter(({ key }) => isBlank(profile?.[key]))
    .map(({ label }) => label);
  const isProfileComplete = missingProfileFields.length === 0;
  const isDocumentsVerified = Boolean(profile?.is_verified);

  return {
    role,
    isCompanyOrFamily: true,
    isProfileComplete,
    isDocumentsVerified,
    canAddProfessionalContact: isProfileComplete && isDocumentsVerified,
    missingProfileFields,
  };
};

export const getCompanyFamilyContactBlockMessage = (eligibility: CompanyFamilyContactEligibility) => {
  if (eligibility.canAddProfessionalContact) {
    return "";
  }

  if (!eligibility.isProfileComplete && !eligibility.isDocumentsVerified) {
    return "Complete seu perfil e valide seus documentos para liberar novos contatos.";
  }

  if (!eligibility.isProfileComplete) {
    return "Complete seu perfil para liberar novos contatos.";
  }

  return "Seus documentos ainda não foram validados. Aguarde a aprovação para liberar novos contatos.";
};
