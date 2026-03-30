const GRADIENTS = [
  "bg-gradient-to-br from-orange-900 via-red-900 to-rose-950",
  "bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-950",
  "bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-950",
  "bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-950",
  "bg-gradient-to-br from-amber-900 via-orange-900 to-red-950",
  "bg-gradient-to-br from-rose-900 via-pink-900 to-purple-950",
  "bg-gradient-to-br from-teal-900 via-emerald-900 to-green-950",
  "bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-950",
  "bg-gradient-to-br from-fuchsia-900 via-pink-900 to-rose-950",
  "bg-gradient-to-br from-lime-900 via-green-900 to-emerald-950",
  "bg-gradient-to-br from-cyan-900 via-sky-900 to-blue-950",
  "bg-gradient-to-br from-red-900 via-orange-900 to-amber-950",
];

export function coverGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
