"use client";

import { useState, useEffect } from "react";
import { isValidPhone, formatPhoneDisplay } from "@/lib/phone";

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
      } else {
        setLocalNumber(value);
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
      {valid === false && localNumber.length > 5 && (
        <p className="mt-1 text-xs text-red-400">Número inválido para {selectedCountry.label}</p>
      )}
    </div>
  );
}
