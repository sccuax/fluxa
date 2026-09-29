/** Contract every render tier implements, mirroring the product renderers'
 *  handles (`pause`/`resume`/`dispose`) so the island treats them the same. */
export interface StageHandle {
  pause(): void;
  resume(): void;
  dispose(): void;
}

export interface StageOptions {
  /** Called if the GPU device is lost after mount, so the island can fall back. */
  onLost?: () => void;
}
