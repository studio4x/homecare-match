/**
 * Calcula a distância entre dois pontos geográficos em quilômetros.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;

  const R = 6371; // Raio da Terra em km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return parseFloat(d.toFixed(1));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Busca coordenadas a partir de um endereço com múltiplas tentativas de fallback.
 */
export async function getCoordinates(addressData: {
  street: string;
  number?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip: string;
}): Promise<{ lat: number; lng: number } | null> {
  
  // Lista de tentativas da mais específica para a mais genérica
  const queries = [
    // 1. Endereço completo com CEP
    `${addressData.street}, ${addressData.number || ""}, ${addressData.city} - ${addressData.state}, ${addressData.zip}, Brasil`,
    // 2. Rua, Número e Cidade (sem bairro/cep que podem confundir)
    `${addressData.street}, ${addressData.number || ""}, ${addressData.city}, Brasil`,
    // 3. Apenas o CEP (muito preciso no Brasil para nível de rua/bloco)
    `${addressData.zip}, Brasil`,
    // 4. Cidade e Estado (último recurso)
    `${addressData.city}, ${addressData.state}, Brasil`
  ];

  for (const query of queries) {
    try {
      console.log(`[GeoUtils] Tentando geocodificar: \${query}`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR',
            'User-Agent': 'HomeCareMatch-App'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        console.log(`[GeoUtils] Sucesso com a query: \${query}`);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error("Erro na tentativa de geocodificação:", error);
    }
    
    // Pequeno delay entre tentativas para respeitar rate limit do serviço gratuito
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return null;
}