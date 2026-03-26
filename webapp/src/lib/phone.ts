import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

// Format a phone number for WhatsApp (returns clean digits with country code, no +)
// e.g., "264 555 1234" → "5492645551234"
// e.g., "+5492645551234" → "5492645551234"
export function formatForWhatsApp(phone: string, defaultCountry: CountryCode = "AR"): string | null {
  // Clean input
  let cleaned = phone.trim();

  // If it's just digits with no country code, try parsing with default country
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);

  if (!parsed || !parsed.isValid()) return null;

  // For Argentina WhatsApp: need to add 9 after country code
  // WhatsApp format for AR: 549XXXXXXXXXX (not 54XXXXXXXXXX)
  const national = parsed.nationalNumber;
  const country = parsed.countryCallingCode;

  if (country === "54") {
    // Argentina: strip leading 0 and 15, add 9
    let arNum = national.replace(/^0/, "").replace(/^15/, "");
    // If doesn't start with 9, add it (mobile numbers need 9)
    if (!arNum.startsWith("9")) {
      arNum = "9" + arNum;
    }
    return `54${arNum}`;
  }

  // Other countries: just return country code + national number
  return `${country}${national}`;
}

// Validate a phone number
export function isValidPhone(phone: string, defaultCountry: CountryCode = "AR"): boolean {
  const parsed = parsePhoneNumberFromString(phone.trim(), defaultCountry);
  return parsed !== undefined && parsed.isValid();
}

// Format for display (human readable)
export function formatPhoneDisplay(phone: string, defaultCountry: CountryCode = "AR"): string {
  const parsed = parsePhoneNumberFromString(phone.trim(), defaultCountry);
  if (!parsed) return phone;
  return parsed.formatInternational();
}
