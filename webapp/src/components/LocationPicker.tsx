"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";

const LIBRARIES: ("places")[] = ["places"];
const DEFAULT_CENTER = { lat: -31.5375, lng: -68.5364 };
const DEFAULT_ZOOM = 16;

const SAN_JUAN_BOUNDS = {
  north: -30.8,
  south: -32.2,
  west: -69.8,
  east: -67.5,
};

const mapContainerStyle = {
  width: "100%",
  height: "250px",
  borderRadius: "12px",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "cooperative",
  scrollwheel: false,
  restriction: {
    latLngBounds: SAN_JUAN_BOUNDS,
    strictBounds: true,
  },
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
  ],
};

export function LocationPicker({
  onLocationConfirm,
}: {
  onLocationConfirm: (address: string, lat: number, lng: number) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  // Two separate concepts:
  // writtenAddress — what the user typed/selected, for the receipt
  // coords — actual lat/lng from map center, for the QR code
  const [writtenAddress, setWrittenAddress] = useState("");
  const [coords, setCoords] = useState(DEFAULT_CENTER);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapTouched, setMapTouched] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const panningFromSearch = useRef(false);

  // Places autocomplete
  const {
    init,
    ready,
    value: searchValue,
    suggestions: { status, data },
    setValue: setSearchValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    initOnMount: false,
    requestOptions: {
      componentRestrictions: { country: "ar" },
      locationBias: {
        center: { lat: -31.5375, lng: -68.5364 },
        radius: 50000,
      },
    },
    debounce: 300,
  });

  useEffect(() => {
    if (isLoaded) init();
  }, [isLoaded, init]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // When map stops moving, read center as coordinates
  // This does NOT update the written address — only coords
  const onMapIdle = useCallback(() => {
    if (!mapRef.current) return;

    // Skip if this idle was triggered by autocomplete panning
    if (panningFromSearch.current) {
      panningFromSearch.current = false;
      return;
    }

    const center = mapRef.current.getCenter();
    if (!center) return;
    const lat = center.lat();
    const lng = center.lng();
    setCoords({ lat, lng });
    setMapTouched(true);
    setIsConfirmed(false);
  }, []);

  // Address autocomplete → updates BOTH written address + coordinates + map
  async function handleSelectAddress(description: string) {
    setSearchValue(description, false);
    clearSuggestions();
    setWrittenAddress(description);
    setMapTouched(false);
    setIsConfirmed(false);

    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = getLatLng(results[0]);
      setCoords({ lat, lng });
      panningFromSearch.current = true;
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(17);
      }
    } catch (err) {
      console.error("Geocode error:", err);
    }
  }

  // "Mi ubicación" → updates ONLY coordinates, NOT written address
  function handleLocateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setMapTouched(true);
        setIsConfirmed(false);
        panningFromSearch.current = true;
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(17);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleConfirm() {
    setIsConfirmed(true);
    // Send written address (for receipt) + coords (for QR)
    onLocationConfirm(writtenAddress, coords.lat, coords.lng);
  }

  function handleEdit() {
    setIsConfirmed(false);
  }

  // Can confirm when we have a written address
  const canConfirm = writtenAddress.trim().length > 0;

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Dirección de entrega</label>
        <div className="h-12 w-full rounded-xl border border-border bg-surface-alt animate-shimmer" />
        <div className="h-[250px] w-full rounded-xl border border-border bg-surface-alt animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Address autocomplete — always editable unless confirmed */}
      <div className="relative">
        <label className="mb-1.5 block text-sm font-medium text-text">
          Dirección de entrega
        </label>
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setWrittenAddress(e.target.value);
              setIsConfirmed(false);
            }}
            disabled={!ready || isConfirmed}
            placeholder="Escribí tu dirección..."
            className="w-full rounded-xl border border-border bg-white px-4 py-3 pl-10 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:bg-surface-alt disabled:text-text-secondary"
          />
        </div>

        {/* Suggestions dropdown */}
        {status === "OK" && data.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-white shadow-lg overflow-hidden">
            {data.map(({ place_id, structured_formatting }) => (
              <li key={place_id}>
                <button
                  type="button"
                  onClick={() => handleSelectAddress(
                    `${structured_formatting.main_text}, ${structured_formatting.secondary_text || ""}`
                  )}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/5 transition-colors"
                >
                  <span className="font-semibold text-text">{structured_formatting.main_text}</span>
                  {structured_formatting.secondary_text && (
                    <span className="block text-xs text-text-muted mt-0.5">{structured_formatting.secondary_text}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map with fixed center pin */}
      <div className="relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={coords}
          zoom={DEFAULT_ZOOM}
          options={mapOptions}
          onLoad={onMapLoad}
          onIdle={onMapIdle}
        />

        {/* Fixed center pin */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10"
          style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}
        >
          <svg width="40" height="40" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(25, 25)">
              <ellipse cx="0" cy="15" rx="8" ry="3" fill="rgba(0,0,0,0.2)" />
              <path
                d="M 0,-20 C -8,-20 -15,-13 -15,-5 C -15,5 0,20 0,20 C 0,20 15,5 15,-5 C 15,-13 8,-20 0,-20 Z"
                fill="#f97316" stroke="#ea580c" strokeWidth="2"
              />
              <circle cx="0" cy="-5" r="5" fill="white" />
            </g>
          </svg>
        </div>

        {/* Locate me button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow-md hover:text-primary transition-all disabled:opacity-50"
        >
          {locating ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M12 9v6m3-3H9" />
            </svg>
          )}
          Mi ubicación
        </button>
      </div>

      <p className="text-[11px] text-text-muted">
        Mové el mapa para ajustar la ubicación exacta. La dirección escrita no cambia.
      </p>

      {/* Map adjusted indicator */}
      {mapTouched && !isConfirmed && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="text-xs text-amber-800">
            Ubicación ajustada en el mapa
          </span>
        </div>
      )}

      {/* Confirm button */}
      {canConfirm && !isConfirmed && (
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          Confirmar dirección y ubicación
        </button>
      )}

      {/* Confirmed state */}
      {isConfirmed && (
        <div className="rounded-xl border border-success/30 bg-emerald-50 p-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-emerald-800">Dirección confirmada</span>
            </div>
            <button
              type="button"
              onClick={handleEdit}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline transition-colors"
            >
              Cambiar
            </button>
          </div>
          <p className="mt-1 ml-6 text-xs text-emerald-700">{writtenAddress}</p>
        </div>
      )}
    </div>
  );
}
