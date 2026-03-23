"use client";

import { useEffect } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";

const LIBRARIES: ("places")[] = ["places"];

export function AddressAutocomplete({
  value,
  onChange,
  onCoordinates,
  placeholder = "Calle y número, barrio",
  label = "Dirección",
  optional = false,
}: {
  value: string;
  onChange: (address: string) => void;
  onCoordinates?: (lat: number, lng: number) => void;
  placeholder?: string;
  label?: string;
  optional?: boolean;
}) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

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

  // Sync external value
  useEffect(() => {
    if (value !== searchValue) {
      setSearchValue(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(description: string) {
    setSearchValue(description, false);
    clearSuggestions();
    onChange(description);

    if (onCoordinates) {
      try {
        const results = await getGeocode({ address: description });
        const { lat, lng } = getLatLng(results[0]);
        onCoordinates(lat, lng);
      } catch (err) {
        console.error("Geocode error:", err);
      }
    }
  }

  return (
    <div className="relative">
      <label className="mb-1.5 block text-sm font-medium text-text">
        {label} {optional && <span className="text-text-muted font-normal">(opcional)</span>}
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
            onChange(e.target.value);
          }}
          disabled={!ready}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 pl-10 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      {status === "OK" && data.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-white shadow-lg overflow-hidden">
          {data.map(({ place_id, structured_formatting }) => (
            <li key={place_id}>
              <button
                type="button"
                onClick={() => handleSelect(
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
  );
}
