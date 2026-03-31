export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isSupabaseBackedAuthEnabled() {
  return process.env.NEXT_PUBLIC_LOCAL_UI_MODE !== "true" && hasSupabaseEnv();
}

export function isLocalOrMockAuthMode() {
  return !isSupabaseBackedAuthEnabled();
}

