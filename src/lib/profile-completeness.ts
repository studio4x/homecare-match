type ProfileCompletenessResult = {
  progress: number;
  missingFields: string[];
  isComplete: boolean;
};

const baseRequiredFields: Record<string, string> = {
  avatar_url: "Foto",
  full_name: "Nome",
  phone: "WhatsApp",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
};

const professionalRequiredFields: Record<string, string> = {
  specialty: "Especialidade",
  registration: "Registro",
  experience: "Formações",
  bio: "Biografia",
};

const companyRequiredFields: Record<string, string> = {
  company_name: "Razão Social",
  cnpj: "CNPJ",
  bio: "Descrição da Empresa",
};

const familyRequiredFields: Record<string, string> = {
  patient_name: "Nome do Paciente",
  patient_age: "Idade do Paciente",
  patient_medical_conditions: "Condição Médica",
  bio: "Outras Observações",
  availability: "Horário de Atendimento",
};

const isFilled = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim() !== "";
};

const getRequiredFieldsByRole = (role: unknown) => {
  if (role === "professional") {
    return { ...baseRequiredFields, ...professionalRequiredFields };
  }

  if (role === "company") {
    return { ...baseRequiredFields, ...companyRequiredFields };
  }

  if (role === "family") {
    return { ...baseRequiredFields, ...familyRequiredFields };
  }

  return { ...baseRequiredFields };
};

export const getProfileCompleteness = (profile: Record<string, unknown> | null | undefined): ProfileCompletenessResult => {
  if (!profile) {
    return { progress: 0, missingFields: [], isComplete: false };
  }

  const requiredFields = getRequiredFieldsByRole(profile.role);
  const entries = Object.entries(requiredFields);
  const missingFields = entries
    .filter(([key]) => !isFilled(profile[key]))
    .map(([, label]) => label);

  const completedCount = entries.length - missingFields.length;
  const progress = entries.length === 0 ? 0 : Math.round((completedCount / entries.length) * 100);

  return {
    progress,
    missingFields,
    isComplete: missingFields.length === 0,
  };
};
