/**
 * Feature Flags for Contract Drafter
 *
 * Centralized feature toggles to enable/disable functionality.
 * Use environment variables to control features without code changes.
 */

export const FEATURES = {
  /**
   * Local UI mode
   * Runs the UI without requiring backend services.
   */
  LOCAL_UI_MODE: process.env.NEXT_PUBLIC_LOCAL_UI_MODE === "true",

  /**
   * Contract-specific features (Sprint 2+)
   */
  CLAUSE_SELECTOR: process.env.NEXT_PUBLIC_CLAUSE_SELECTOR_ENABLED !== "false",
  RULES_ENGINE: process.env.NEXT_PUBLIC_RULES_ENGINE_ENABLED === "true",
  AGENT_CLAUSE_INSERTION:
    process.env.NEXT_PUBLIC_AGENT_CLAUSE_INSERTION_ENABLED === "true",
  REQUESTS_PANEL: process.env.NEXT_PUBLIC_REQUESTS_PANEL_ENABLED !== "false",
  CONTRACT_TOOLBAR:
    process.env.NEXT_PUBLIC_CONTRACT_TOOLBAR_ENABLED !== "false",

  /**
   * Development/debug features
   */
  DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE === "true",
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] === true;
}

/**
 * Get list of enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name);
}

/**
 * Feature gate component helper
 * Usage: if (!canUseFeature('CLAUSE_SELECTOR')) return null;
 */
export function canUseFeature(feature: keyof typeof FEATURES): boolean {
  return isFeatureEnabled(feature);
}
