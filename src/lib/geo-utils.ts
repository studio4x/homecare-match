import { supabase } from "@/integrations/supabase/client";

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
 * Busca coordenadas via Google Maps (através de Edge Function segura).
 */
export async function getCoordinates(addressData: {
  street: string;
  number?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip: string;
}): Promise<{ lat: number; lng: number } | null> {
  
  const fullAddress = `${addressData.street}, ${addressData.number || ""}, ${addressData.neighborhood || ""}, ${addressData.city} - ${addressData.state}, ${addressData.zip}, Brasil`;

  try {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { address: fullAddress }
    });

    if (error) {
      let errorMsg = "Erro desconhecido na função.";
      try {
        const body = await error.context?.json();
        errorMsg = body?.details || body?.error || errorMsg;
      } catch {}
      
      throw new Error(errorMsg);
    }

    return { lat: data.lat, lng: data.lng };
  } catch (error: any) {
    console.error("[GeoUtils] Erro:", error.message);
    throw error;
  }
}