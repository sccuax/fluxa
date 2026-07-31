import { useSelectedElement } from "../hooks/useSelectedElement";
import { useBackendHealth } from "../hooks/useBackendHealth";

type Status = "checking" | "ok" | "error";

function StatusRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: Status;
  detail: string;
}) {
  const dotColor =
    status === "ok"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-amber-500 animate-pulse";

  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-neutral-300">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        {detail}
      </span>
    </div>
  );
}

export function WelcomeScreen() {
  const { element, loading: designerLoading, error: designerError } =
    useSelectedElement();
  const backend = useBackendHealth();

  const designerStatus: Status = designerError
    ? "error"
    : designerLoading
      ? "checking"
      : "ok";

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-center text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold">Fluxa</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Gradientes 3D personalizados para Webflow
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3 rounded-lg border border-neutral-800 p-4 text-left text-sm">
        <StatusRow
          label="Webflow Designer"
          status={designerStatus}
          detail={
            designerStatus === "ok"
              ? "Conectado"
              : designerStatus === "error"
                ? "Sin conexión"
                : "Conectando..."
          }
        />
        <StatusRow
          label="Backend (Data Client)"
          status={backend.status}
          detail={
            backend.status === "ok"
              ? "Conectado"
              : backend.status === "error"
                ? "Sin conexión"
                : "Conectando..."
          }
        />
        <div className="flex items-center justify-between gap-3">
          <span>Elemento seleccionado</span>
          <span className="text-neutral-400">
            {element ? element.id.element : "Ninguno"}
          </span>
        </div>
      </div>

      {(designerError || backend.error) && (
        <p className="max-w-xs text-xs text-red-400">
          {designerError ?? backend.error}
        </p>
      )}

      <div className="w-full max-w-xs space-y-1 rounded-lg border border-neutral-800 p-4 text-left font-mono text-[11px] text-neutral-500">
        <div>typeof webflow: {typeof webflow}</div>
        <div>in iframe: {String(window.self !== window.top)}</div>
        <div>href: {window.location.href}</div>
        <div>referrer: {document.referrer || "(none)"}</div>
      </div>
    </div>
  );
}
