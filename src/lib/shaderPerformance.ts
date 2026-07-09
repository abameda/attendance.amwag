export type ShaderPerformanceMode = 'animated' | 'static';

export type ShaderPerformanceSignals = {
  prefersReducedMotion: boolean;
  isCoarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

/**
 * Keep the login background decorative on constrained devices. The form
 * remains fully usable with the CSS fallback when WebGL animation is skipped.
 */
export function getShaderPerformanceMode(
  signals: ShaderPerformanceSignals,
): ShaderPerformanceMode {
  if (signals.prefersReducedMotion || signals.isCoarsePointer) {
    return 'static';
  }

  if (
    (signals.deviceMemory !== undefined && signals.deviceMemory <= 4) ||
    (signals.hardwareConcurrency !== undefined && signals.hardwareConcurrency <= 4)
  ) {
    return 'static';
  }

  return 'animated';
}
