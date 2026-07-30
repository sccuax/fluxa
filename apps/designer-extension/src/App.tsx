import { GradientCanvas } from "./components/GradientCanvas";
import { ControlPanel } from "./components/ControlPanel";

export default function App() {
  return (
    <div className="grid h-screen grid-cols-[1fr_260px] bg-neutral-950 text-neutral-100">
      <div className="relative">
        <GradientCanvas />
      </div>
      <aside className="overflow-y-auto border-l border-neutral-800">
        <ControlPanel />
      </aside>
    </div>
  );
}
