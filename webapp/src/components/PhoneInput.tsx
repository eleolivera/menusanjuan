"use client";

import { useState, useEffect } from "react";
import { isValidPhone, formatPhoneDisplay, formatForWhatsApp } from "@/lib/phone";

const COUNTRIES = [
  { code: "AR", flag: "🇦🇷", prefix: "+54", label: "Argentina" },
  { code: "CL", flag: "🇨🇱", prefix: "+56", label: "Chile" },
  { code: "UY", flag: "🇺🇾", prefix: "+598", label: "Uruguay" },
  { code: "BR", flag: "🇧🇷", prefix: "+55", label: "Brasil" },
  { code: "PY", flag: "🇵🇾", prefix: "+595", label: "Paraguay" },
  { code: "BO", flag: "🇧🇴", prefix: "+591", label: "Bolivia" },
  { code: "PE", flag: "🇵🇪", prefix: "+51", label: "Perú" },
  { code: "CO", flag: "🇨🇴", prefix: "+57", label: "Colombia" },
  { code: "MX", flag: "🇲🇽", prefix: "+52", label: "México" },
  { code: "US", flag: "🇺🇸", prefix: "+1", label: "USA" },
  { code: "ES", flag: "🇪🇸", prefix: "+34", label: "España" },
];

export function PhoneInput({
  value,
  onChange,
  label = "Teléfono",
  placeholder = "264 555 1234",
  required = false,
  darkMode = false,
}: {
  value: string;
  onChange: (phone: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  darkMode?: boolean;
}) {
  const [country, setCountry] = useState("AR");
  const [localNumber, setLocalNumber] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);

  // Initialize from value
  useEffect(() => {
    if (value && !localNumber) {
      // Try to detect country from value
      const match = COUNTRIES.find((c) => value.startsWith(c.prefix) || value.startsWith(c.prefix.replace("+", "")));
      if (match) {
        setCountry(match.code);
        const stripped = value.replace(match.prefix, "").replace(match.prefix.replace("+", ""), "");
        setLocalNumber(stripped);
        // Validate on init
        const isValid = isValidPhone(value, match.code as any);
        setValid(stripped.length > 5 ? isValid : null);
      } else {
        setLocalNumber(value);
        const isValid = isValidPhone(value, "AR");
        setValid(value.length > 5 ? isValid : null);
      }
    }
  }, []);

  function handleChange(num: string) {
    // Only allow digits and spaces
    const cleaned = num.replace(/[^\d\s]/g, "");
    setLocalNumber(cleaned);

    const selectedCountry = COUNTRIES.find((c) => c.code === country)!;
    const fullNumber = `${selectedCountry.prefix}${cleaned.replace(/\s/g, "")}`;

    const isValid = isValidPhone(fullNumber, country as any);
    setValid(cleaned.length > 5 ? isValid : null);

    onChange(fullNumber);
  }

  function handleCountryChange(code: string) {
    setCountry(code);
    setShowDropdown(false);
    // Re-validate with new country
    const selectedCountry = COUNTRIES.find((c) => c.code === code)!;
    const fullNumber = `${selectedCountry.prefix}${localNumber.replace(/\s/g, "")}`;
    onChange(fullNumber);
  }

  const selectedCountry = COUNTRIES.find((c) => c.code === country)!;
  const inputClass = darkMode
    ? "rounded-r-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
    : "rounded-r-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors";
  const btnClass = darkMode
    ? "rounded-l-xl border border-white/10 border-r-0 bg-white/5 px-3 py-3 text-sm text-white hover:bg-white/10 transition-colors"
    : "rounded-l-xl border border-border border-r-0 bg-surface-alt px-3 py-3 text-sm text-text hover:bg-surface-hover transition-colors";

  return (
    <div>
      {label && (
        <label className={`mb-1.5 block text-sm font-medium ${darkMode ? "text-slate-400" : "text-text"}`}>
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <div className="flex relative">
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className={`${btnClass} flex items-center gap-1.5 shrink-0`}
        >
          <span>{selectedCountry.flag}</span>
          <span className="text-xs font-medium">{selectedCountry.prefix}</span>
          <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className={`absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border shadow-lg overflow-hidden ${darkMode ? "border-white/10 bg-slate-900" : "border-border bg-surface"}`}>
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCountryChange(c.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  c.code === country
                    ? "bg-primary/10 text-primary"
                    : darkMode ? "text-slate-300 hover:bg-white/5" : "text-text hover:bg-surface-hover"
                }`}
              >
                <span>{c.flag}</span>
                <span className="flex-1 text-left">{c.label}</span>
                <span className="text-xs opacity-50">{c.prefix}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <input
          type="tel"
          value={localNumber}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 ${inputClass}`}
        />

        {/* Validation indicator */}
        {valid !== null && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {valid ? (
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3">
        {valid === false && localNumber.length > 5 && (
          <p className="text-xs text-red-400">Número inválido para {selectedCountry.label}</p>
        )}
        {valid === true && (
          <a
            href={`https://wa.me/${formatForWhatsApp(selectedCountry.prefix + localNumber.replace(/\s/g, ""), country as any)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#25D366] hover:underline"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Probar en WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
