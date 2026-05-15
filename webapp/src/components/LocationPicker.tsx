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

// Preview map (small, decorative, taps to open fullscreen)
const previewMapStyle = {
  width: "100%",
  height: "150px",
  borderRadius: "12px",
};

// Fullscreen map (interactive)
const fullscreenMapStyle = {
  width: "100%",
  height: "100%",
};

// Locked-down options for the preview map — no interaction, just a snapshot
const previewMapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  gestureHandling: "none",
  draggable: false,
  scrollwheel: false,
  zoomControl: false,
  keyboardShortcuts: false,
  clickableIcons: false,
  styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
};

// Fullscreen options — Uber-style: one-finger pan, no UI clutter
const fullscreenMapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  gestureHandling: "greedy", // one-finger pan on mobile
  zoomControl: true,
  zoomControlOptions: {
    position: typeof google !== "undefined" ? google.maps.ControlPosition.RIGHT_BOTTOM : undefined,
  },
  restriction: {
    latLngBounds: SAN_JUAN_BOUNDS,
    strictBounds: true,
  },
  styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
};

export function LocationPicker({
  onLocationConfirm,
  addressLabel = "Dirección de entrega",
  placeholder = "Escribí tu dirección...",
  geolocateLabel = "Mi ubicación",
  initialAddress,
  initialLat,
  initialLng,
}: {
  onLocationConfirm: (address: string, lat: number, lng: number) => void;
  /** Top label for the address autocomplete field */
  addressLabel?: string;
  /** Placeholder text for the address input */
  placeholder?: string;
  /** Label shown next to the GPS button — "Mi ubicación" is the default but
   *  in agent flows it's useful to relabel ("Marcar en el mapa", etc.) */
  geolocateLabel?: string;
  /** Pre-fill from an existing address + coords (useful when re-editing) */
  initialAddress?: string;
  initialLat?: number | null;
  initialLng?: number | null;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  // writtenAddress — what shows on the receipt
  // coords — actual lat/lng for delivery
  const [writtenAddress, setWrittenAddress] = useState(initialAddress || "");
  const [coords, setCoords] = useState(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER,
  );
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapTouched, setMapTouched] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  // In fullscreen mode, this address mirrors the reverse-geocode of the current map center
  const [fsAddress, setFsAddress] = useState<string>("");

  const previewMapRef = useRef<google.maps.Map | null>(null);
  const fsMapRef = useRef<google.maps.Map | null>(null);
  const fsPendingCoords = useRef(coords);

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

  // Lock body scroll while fullscreen map is open
  useEffect(() => {
    if (!mapOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapOpen]);

  // Reverse-geocode helper — turns coords into a human address string
  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    if (typeof google === "undefined") return "";
    try {
      const geocoder = new google.maps.Geocoder();
      const res = await geocoder.geocode({ location: { lat, lng } });
      return res.results[0]?.formatted_address || "";
    } catch {
      return "";
    }
  }

  // ─── Preview map ─────
  const onPreviewLoad = useCallback((map: google.maps.Map) => {
    previewMapRef.current = map;
  }, []);

  // ─── Fullscreen map ─────
  const onFullscreenLoad = useCallback(
    (map: google.maps.Map) => {
      fsMapRef.current = map;
      // Initial reverse geocode (in case map opens with a fresh center)
      reverseGeocode(coords.lat, coords.lng).then((addr) => {
        if (addr) setFsAddress(addr);
      });
    },
    [coords.lat, coords.lng],
  );

  // Map stopped moving → update pending coords + reverse geocode for the top bar
  const onFullscreenIdle = useCallback(() => {
    if (!fsMapRef.current) return;
    const center = fsMapRef.current.getCenter();
    if (!center) return;
    const lat = center.lat();
    const lng = center.lng();
    fsPendingCoords.current = { lat, lng };
    reverseGeocode(lat, lng).then((addr) => {
      setFsAddress(addr);
    });
  }, []);

  // ─── Address autocomplete (preview mode) ─────
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
      fsPendingCoords.current = { lat, lng };
      if (previewMapRef.current) {
        previewMapRef.current.panTo({ lat, lng });
        previewMapRef.current.setZoom(17);
      }
    } catch (err) {
      console.error("Geocode error:", err);
    }
  }

  // ─── Mi Ubicación ─────
  // Opens fullscreen map centered on GPS
  function handleLocateMe() {
    if (!navigator.geolocation) {
      setMapOpen(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        fsPendingCoords.current = { lat, lng };
        setMapTouched(true);
        setIsConfirmed(false);
        setLocating(false);
        setMapOpen(true);
      },
      () => {
        // Permission denied or failed — still open the map so user can pin manually
        setLocating(false);
        setMapOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ─── Open fullscreen map (tap on preview or "Ver en mapa") ─────
  function openMap() {
    fsPendingCoords.current = coords;
    setMapOpen(true);
  }

  // ─── Confirm from inside fullscreen map ─────
  async function confirmFromMap() {
    const { lat, lng } = fsPendingCoords.current;
    setCoords({ lat, lng });
    setMapTouched(true);

    // If the user hasn't typed an address, fill writtenAddress with the reverse-geocoded one
    // (or a coord fallback if reverse geocode failed)
    if (!writtenAddress.trim()) {
      const addr = fsAddress || (await reverseGeocode(lat, lng));
      const finalAddr = addr || `Ubicacion en mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      setWrittenAddress(finalAddr);
      setSearchValue(finalAddr, false);
    }

    setMapOpen(false);
  }

  // ─── Confirm from preview mode (just typed address, no map adjustment) ─────
  function handleConfirm() {
    setIsConfirmed(true);
    const addr = writtenAddress.trim() || `Ubicacion en mapa (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`;
    onLocationConfirm(addr, coords.lat, coords.lng);
  }

  function handleEdit() {
    setIsConfirmed(false);
  }

  const canConfirm = writtenAddress.trim().length > 0 || mapTouched;
  const hasResolvedAddress = fsAddress && !fsAddress.toLowerCase().startsWith("unnamed");

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Dirección de entrega</label>
        <div className="h-12 w-full rounded-xl border border-border bg-surface-alt animate-shimmer" />
        <div className="h-[150px] w-full rounded-xl border border-border bg-surface-alt animate-shimmer" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Address autocomplete */}
        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-text">
            {addressLabel}
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
              placeholder={placeholder}
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

        {/* Two ways to open the map — buttons above the preview */}
        {!isConfirmed && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openMap}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-text hover:border-primary hover:bg-primary/5 transition-all"
            >
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Ajustar en mapa
            </button>
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-text hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
            >
              {locating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              )}
              {geolocateLabel}
            </button>
          </div>
        )}

        {/* Compact preview map — tap to expand */}
        {!isConfirmed && (
          <button
            type="button"
            onClick={openMap}
            className="relative w-full block overflow-hidden rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <GoogleMap
              mapContainerStyle={previewMapStyle}
              center={coords}
              zoom={DEFAULT_ZOOM}
              options={previewMapOptions}
              onLoad={onPreviewLoad}
            />
            {/* Fixed center pin */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none"
              style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}
            >
              <svg width="32" height="32" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(25, 25)">
                  <ellipse cx="0" cy="15" rx="8" ry="3" fill="rgba(0,0,0,0.2)" />
                  <path d="M 0,-20 C -8,-20 -15,-13 -15,-5 C -15,5 0,20 0,20 C 0,20 15,5 15,-5 C 15,-13 8,-20 0,-20 Z" fill="#f97316" stroke="#ea580c" strokeWidth="2" />
                  <circle cx="0" cy="-5" r="5" fill="white" />
                </g>
              </svg>
            </div>
            {/* Overlay hint */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors flex items-end justify-center pb-2 pointer-events-none">
              <span className="rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[11px] font-medium text-text shadow-sm">
                Tocá para ajustar
              </span>
            </div>
          </button>
        )}

        {mapTouched && !isConfirmed && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-xs text-amber-800">Ubicación ajustada en el mapa</span>
          </div>
        )}

        {canConfirm && !isConfirmed && (
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Confirmar dirección
          </button>
        )}

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
            <p className="mt-1 ml-6 text-xs text-emerald-700">
              {writtenAddress.trim() || `📍 Ubicación marcada en el mapa (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`}
            </p>
          </div>
        )}
      </div>

      {/* Fullscreen map overlay — Uber-style */}
      {mapOpen && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col" style={{ touchAction: "none" }}>
          {/* Top bar — close + reverse-geocoded address preview */}
          <div className="shrink-0 bg-white border-b border-border px-4 py-3 flex items-center gap-3 safe-area-top">
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              className="rounded-full p-2 hover:bg-surface-alt transition-colors"
              aria-label="Cerrar mapa"
            >
              <svg className="h-5 w-5 text-text" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Ubicación seleccionada</div>
              <div className="text-sm font-medium text-text truncate">
                {fsAddress || "Movéme para elegir el lugar exacto"}
              </div>
            </div>
          </div>

          {/* Map fills remaining space */}
          <div className="flex-1 relative" style={{ touchAction: "manipulation" }}>
            <GoogleMap
              mapContainerStyle={fullscreenMapStyle}
              center={coords}
              zoom={DEFAULT_ZOOM}
              options={fullscreenMapOptions}
              onLoad={onFullscreenLoad}
              onIdle={onFullscreenIdle}
            />

            {/* Fixed center pin (CSS overlay — the map moves under it) */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10"
              style={{ filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.35))" }}
            >
              <svg width="48" height="48" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(25, 25)">
                  <ellipse cx="0" cy="15" rx="9" ry="3" fill="rgba(0,0,0,0.25)" />
                  <path d="M 0,-20 C -8,-20 -15,-13 -15,-5 C -15,5 0,20 0,20 C 0,20 15,5 15,-5 C 15,-13 8,-20 0,-20 Z" fill="#f97316" stroke="#ea580c" strokeWidth="2" />
                  <circle cx="0" cy="-5" r="5" fill="white" />
                </g>
              </svg>
            </div>

            {/* Re-locate button floating */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-medium text-text-secondary shadow-md hover:text-primary transition-all disabled:opacity-50"
            >
              {locating ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              )}
              {geolocateLabel}
            </button>
          </div>

          {/* Bottom sheet — info + confirm */}
          <div className="shrink-0 bg-white border-t border-border px-4 pt-3 pb-4 space-y-2 safe-area-bottom shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
            {!hasResolvedAddress && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                💡 No detectamos una dirección clara. El motorista usará el pin para llegar — asegurate de moverlo a la puerta exacta.
              </div>
            )}
            <button
              type="button"
              onClick={confirmFromMap}
              className="w-full rounded-xl bg-primary px-3 py-3.5 text-base font-bold text-white shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors"
            >
              Confirmar esta ubicación
            </button>
          </div>
        </div>
      )}
    </>
  );
}
