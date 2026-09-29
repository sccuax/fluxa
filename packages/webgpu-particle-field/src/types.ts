/** Same contract as the product renderers' handles (`@fluxa/glass-liquid-renderer`,
 *  `@fluxa/ruido-evolutivo-renderer`), so hosts treat every shader alike. */
export interface StageHandle {
  pause(): void;
  resume(): void;
  dispose(): void;
}

export interface StageOptions {
  /** Called if the GPU device is lost after mount, so the host can fall back. */
  onLost?: () => void;
}
