import { WelcomeScreen } from "./components/WelcomeScreen";

// Swapped in for the initial Webflow smoke test (verifies the Designer
// connection and the backend are both reachable) before wiring the actual
// gradient panel (GradientCanvas + ControlPanel) back in as the default view.
export default function App() {
  return <WelcomeScreen />;
}
