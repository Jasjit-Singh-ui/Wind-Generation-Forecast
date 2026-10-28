import type { BarShapeProps } from "recharts";

/** Bar with a 4px rounded data end (top when positive, bottom when negative), square at the baseline. */
export function RoundedBar(props: BarShapeProps) {
  const { x, y, width, height, fill, value, isActive } = props;
  if (!width || !height) return <g />;
  const amount = Array.isArray(value) ? value[1] - value[0] : value;
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  const r = Math.min(4, width / 2, h);
  const left = x;
  const right = x + width;
  const bottom = top + h;
  const d =
    amount >= 0
      ? `M${left},${bottom}V${top + r}A${r},${r} 0 0 1 ${left + r},${top}H${right - r}A${r},${r} 0 0 1 ${right},${top + r}V${bottom}Z`
      : `M${left},${top}H${right}V${bottom - r}A${r},${r} 0 0 1 ${right - r},${bottom}H${left + r}A${r},${r} 0 0 1 ${left},${bottom - r}Z`;
  return <path d={d} fill={fill} opacity={isActive ? 0.78 : 1} />;
}
