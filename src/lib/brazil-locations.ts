const CITY_CACHE = new Map<string, string[]>();

export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const normalizeState = (state?: string | null) => String(state || "").trim().toUpperCase();

export const fetchCitiesByState = async (state?: string | null) => {
  const normalizedState = normalizeState(state);
  if (!normalizedState || !BRAZIL_STATES.includes(normalizedState as (typeof BRAZIL_STATES)[number])) {
    return [];
  }

  const cachedCities = CITY_CACHE.get(normalizedState);
  if (cachedCities) {
    return cachedCities;
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedState}/municipios`,
  );
  if (!response.ok) {
    throw new Error(`Falha ao carregar cidades para ${normalizedState}`);
  }

  const payload = (await response.json()) as Array<{ nome?: string }>;
  const cities = Array.from(
    new Set(
      payload
        .map((city) => String(city?.nome || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  CITY_CACHE.set(normalizedState, cities);
  return cities;
};

