"use client";

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { useSiteConfig } from '@/hooks/use-site-config';

interface ProfessionalMapProps {
  userLocation: { lat: number; lng: number } | null;
  professionals: any[];
  onProfessionalClick: (professional: any) => void;
  onBoundsChange?: (bounds: google.maps.LatLngBounds | null) => void;
  refitTrigger: number; // NEW: Prop to trigger refitting
}

const mapContainerStyle = {
  width: '100%',
  height: '450px',
};

const ProfessionalMap = ({ userLocation, professionals, onProfessionalClick, onBoundsChange, refitTrigger }: ProfessionalMapProps) => {
  const { data: config } = useSiteConfig();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null); // Use a ref for the map instance
  const initialFitDone = useRef(false); // Track if initial fit has been done

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: config?.google_maps_api_key || "",
  });

  const defaultCenter = useMemo(() => ({
    lat: -15.7942,
    lng: -47.8822
  }), []);

  const center = useMemo(() => {
    if (userLocation) return userLocation;
    if (professionals.length > 0 && professionals[0].lat && professionals[0].lng) {
      return { lat: Number(professionals[0].lat), lng: Number(professionals[0].lng) };
    }
    return defaultCenter;
  }, [userLocation, professionals, defaultCenter]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapRef.current = mapInstance;
    initialFitDone.current = false; // Reset on map load
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    mapRef.current = null;
  }, []);

  const handleIdle = () => {
    if (mapRef.current && onBoundsChange) {
      onBoundsChange(mapRef.current.getBounds() || null);
    }
  };

  // Effect to fit all markers when professionals list changes or refitTrigger is incremented
  useEffect(() => {
    if (!mapRef.current || typeof google === 'undefined' || professionals.length === 0) return;

    // Only fit bounds if it's the initial load or if refitTrigger has changed
    // We use a ref to prevent re-fitting on every render if data is the same
    if (!initialFitDone.current || refitTrigger > 0) { // refitTrigger > 0 ensures it runs after initial load
      const bounds = new google.maps.LatLngBounds();
      let hasValidPoints = false;

      if (userLocation) {
        bounds.extend(userLocation);
        hasValidPoints = true;
      }

      professionals.forEach(p => {
        if (p.lat && p.lng) {
          bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) });
          hasValidPoints = true;
        }
      });

      if (hasValidPoints) {
        mapRef.current.fitBounds(bounds);
        // Avoid excessive zoom if there's only one point
        if (professionals.length === 1 && !userLocation) {
          const listener = google.maps.event.addListener(mapRef.current, 'idle', () => {
            mapRef.current?.setZoom(12);
            google.maps.event.removeListener(listener);
          });
        }
        initialFitDone.current = true; // Mark initial fit as done
      }
    }
  }, [mapRef.current, professionals, userLocation, refitTrigger]); // Add refitTrigger to dependencies

  if (loadError) {
    return (
      <div className="w-full h-[450px] bg-destructive/5 rounded-3xl flex flex-col items-center justify-center gap-3 border border-destructive/20 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h3 className="font-bold text-destructive">Erro ao carregar o mapa</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          A chave de API do Google Maps não foi configurada ou é inválida. 
          Acesse o Painel Admin {'>'} Configurações para resolver.
        </p>
      </div>
    );
  }

  if (!isLoaded || !config?.google_maps_api_key) {
    return (
      <div className="w-full h-[450px] bg-secondary/20 rounded-3xl flex flex-col items-center justify-center gap-3 border border-dashed">
        {!config?.google_maps_api_key ? (
          <>
            <MapPin className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Aguardando configuração da API do Google Maps...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando mapa interativo...</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-border shadow-card animate-fade-in">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={userLocation ? 12 : 4}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onIdle={handleIdle}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {userLocation && (
          <MarkerF
            position={userLocation}
            icon={{
              url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            }}
            title="Sua Localização"
          />
        )}

        {professionals.map((p) => {
          if (!p.lat || !p.lng) return null;
          
          const isPremium = p.subscription_tier === 'yearly';
          
          return (
            <MarkerF
              key={p.id}
              position={{ lat: Number(p.lat), lng: Number(p.lng) }}
              onClick={() => onProfessionalClick(p)}
              icon={{
                url: isPremium 
                  ? "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png" 
                  : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              }}
              title={p.full_name}
            />
          );
        })}
      </GoogleMap>
      
      <div className="bg-card p-3 border-t flex items-center justify-center gap-6 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Você</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Premium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Profissional</span>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalMap;