import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMOS = [
  {
    email: "demo.prof.20260225073823.1@homecarematch.app",
    full_name: "Ana Paula Ribeiro",
    specialty: "enfermeiro",
    registration: "COREN-SP 123456",
    city: "Sao Paulo",
    state: "SP",
    neighborhood: "Moema",
    phone: "(11) 98888-1001",
    hourly_rate: 75,
    experience: "8 anos em cuidados domiciliares e pos-alta hospitalar",
    professional_experiences:
      "Atendimento domiciliar a idosos e pacientes cronicos",
    bio: "Enfermeira com foco em seguranca, acolhimento e rotina medicamentosa.",
    availability: ["Período da Manhã", "Período da Tarde"],
    patient_profiles: ["Idosos", "Doenças Crônicas"],
    address_zip: "04546-001",
    address_street: "Avenida Ibirapuera",
    address_number: "1200",
    address_complement: "Conj. 101",
    lat: -23.599,
    lng: -46.666,
  },
  {
    email: "demo.prof.20260225073823.2@homecarematch.app",
    full_name: "Carlos Eduardo Lima",
    specialty: "fisioterapeuta",
    registration: "CREFITO-3 654321",
    city: "Campinas",
    state: "SP",
    neighborhood: "Cambuí",
    phone: "(19) 97777-2002",
    hourly_rate: 90,
    experience: "10 anos em reabilitacao neurologica e ortopedica",
    professional_experiences:
      "Reabilitacao funcional no domicilio com plano individual",
    bio: "Fisioterapeuta voltado a ganho de mobilidade e autonomia.",
    availability: ["Período da Tarde", "Finais de Semana"],
    patient_profiles: ["Pós-cirúrgico", "Reabilitação Neurológica"],
    address_zip: "13024-000",
    address_street: "Rua Coronel Quirino",
    address_number: "415",
    address_complement: "Sala 2",
    lat: -22.896,
    lng: -47.058,
  },
  {
    email: "demo.prof.20260225073823.3@homecarematch.app",
    full_name: "Mariana Souza Costa",
    specialty: "nutricionista",
    registration: "CRN-9 334455",
    city: "Belo Horizonte",
    state: "MG",
    neighborhood: "Savassi",
    phone: "(31) 96666-3003",
    hourly_rate: 85,
    experience: "6 anos em nutricao clinica para idosos e diabeticos",
    professional_experiences:
      "Plano alimentar para condicoes cronicas em home care",
    bio: "Nutricionista clinica para acompanhamento domiciliar e educacao alimentar.",
    availability: ["Período da Manhã", "1h de atendimento"],
    patient_profiles: ["Idosos", "Doenças Crônicas"],
    address_zip: "30140-071",
    address_street: "Rua Paraiba",
    address_number: "890",
    address_complement: "Apto 301",
    lat: -19.938,
    lng: -43.935,
  },
  {
    email: "demo.prof.20260225073823.4@homecarematch.app",
    full_name: "Ricardo Mendes Oliveira",
    specialty: "tecnico-enfermagem",
    registration: "COREN-PR 778899",
    city: "Curitiba",
    state: "PR",
    neighborhood: "Batel",
    phone: "(41) 95555-4004",
    hourly_rate: 60,
    experience: "7 anos em administracao de medicamentos e curativos",
    professional_experiences:
      "Plantao domiciliar com monitoramento de sinais vitais",
    bio: "Tecnico de enfermagem com experiencia em rotina de cuidados continuos.",
    availability: ["Plantão 12h (Noturno)", "Finais de Semana"],
    patient_profiles: ["Idosos", "Cuidados Paliativos"],
    address_zip: "80420-090",
    address_street: "Avenida Batel",
    address_number: "1550",
    address_complement: "Casa",
    lat: -25.442,
    lng: -49.285,
  },
  {
    email: "demo.prof.20260225073823.5@homecarematch.app",
    full_name: "Juliana Fernandes Rocha",
    specialty: "psicologo",
    registration: "CRP-07 112233",
    city: "Porto Alegre",
    state: "RS",
    neighborhood: "Moinhos de Vento",
    phone: "(51) 94444-5005",
    hourly_rate: 110,
    experience: "9 anos em suporte emocional para pacientes e familiares",
    professional_experiences:
      "Atendimento psicologico domiciliar e orientacao de cuidadores",
    bio: "Psicologa com foco em saude mental no contexto de cuidados domiciliares.",
    availability: ["Período da Noite", "2h de atendimento"],
    patient_profiles: ["Idosos", "Cuidados Paliativos"],
    address_zip: "90570-001",
    address_street: "Rua Vinte e Quatro de Outubro",
    address_number: "980",
    address_complement: "Conj. 4",
    lat: -30.025,
    lng: -51.2,
  },
];

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function main() {
  const users = await listAllUsers();
  const byEmail = new Map(users.map((u) => [u.email?.toLowerCase(), u]));

  const result = [];

  for (const demo of DEMOS) {
    const authUser = byEmail.get(demo.email.toLowerCase());
    if (!authUser?.id) {
      result.push({ email: demo.email, ok: false, reason: "auth_user_not_found" });
      continue;
    }

    const userId = authUser.id;

    const metadata = {
      ...(authUser.user_metadata || {}),
      role: "professional",
      full_name: demo.full_name,
      specialty: demo.specialty,
      registration: demo.registration,
      city: demo.city,
      state: demo.state,
      neighborhood: demo.neighborhood,
      experience: demo.experience,
      professional_experiences: demo.professional_experiences,
      bio: demo.bio,
      phone: demo.phone,
      hourly_rate: String(demo.hourly_rate),
      availability: demo.availability,
      patient_profiles: demo.patient_profiles,
      address_zip: demo.address_zip,
      address_street: demo.address_street,
      address_number: demo.address_number,
      address_complement: demo.address_complement,
      lat: String(demo.lat),
      lng: String(demo.lng),
      is_verified: true,
      verification_sent: true,
      has_seen_onboarding: true,
      notifications_enabled: true,
    };

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
      user_metadata: metadata,
    });

    if (authUpdateError) {
      result.push({ email: demo.email, ok: false, reason: `auth_update_failed: ${authUpdateError.message}` });
      continue;
    }

    const profilePayload = {
      id: userId,
      full_name: demo.full_name,
      email: demo.email,
      role: "professional",
      specialty: demo.specialty,
      registration: demo.registration,
      city: demo.city,
      state: demo.state,
      neighborhood: demo.neighborhood,
      experience: demo.experience,
      professional_experiences: demo.professional_experiences,
      bio: demo.bio,
      phone: demo.phone,
      hourly_rate: demo.hourly_rate,
      availability: demo.availability,
      patient_profiles: demo.patient_profiles,
      address_zip: demo.address_zip,
      address_street: demo.address_street,
      address_number: demo.address_number,
      address_complement: demo.address_complement,
      lat: demo.lat,
      lng: demo.lng,
      is_verified: true,
      verification_sent: true,
      email_confirmed: true,
      has_seen_onboarding: true,
      notifications_enabled: true,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (upsertError) {
      result.push({ email: demo.email, ok: false, reason: `profile_upsert_failed: ${upsertError.message}` });
      continue;
    }

    result.push({ email: demo.email, ok: true, user_id: userId });
  }

  console.table(result);

  const failed = result.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

