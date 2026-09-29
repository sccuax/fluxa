// One way to load a WebAssembly module: streaming-compiled, fetched at most
// once per page, cached by URL. Feature modules (palette extraction, ...) wrap
// this and expose a typed API; nothing else on the site calls WebAssembly.*.

const modules = new Map<string, Promise<WebAssembly.Instance>>();

export function loadWasm(
  url: string,
  imports: WebAssembly.Imports = {},
): Promise<WebAssembly.Instance> {
  const existing = modules.get(url);
  if (existing) return existing;

  const pending = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`wasm fetch failed (${response.status}): ${url}`);
    try {
      // Fast path: compile while downloading. Needs `application/wasm`.
      const { instance } = await WebAssembly.instantiateStreaming(response.clone(), imports);
      return instance;
    } catch {
      const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), imports);
      return instance;
    }
  })();

  // Do not cache a failure: a later call may succeed (network blip).
  pending.catch(() => modules.delete(url));
  modules.set(url, pending);
  return pending;
}
