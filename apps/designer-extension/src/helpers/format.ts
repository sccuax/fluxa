export function formatSliderValue(value: number, step: number): string {
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  return value.toFixed(decimals);
}
