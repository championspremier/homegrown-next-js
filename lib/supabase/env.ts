const PLACEHOLDER = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (isBuild) {
      return name === "NEXT_PUBLIC_SUPABASE_URL" ? PLACEHOLDER : PLACEHOLDER_KEY;
    }
    throw new Error(
      `Missing required env: ${name}. Set it in .env.local (see .env.local.example).`
    );
  }
  return value;
}

export function getSupabaseEnv() {
  return {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
