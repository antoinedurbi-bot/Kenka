import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { prettyShort } from "../../lib/dates";

export interface TrendPoint {
  date: string;
  value: number;
}

export function TrendChart({
  data,
  color = "#c8323f",
  unit = "",
  target,
  domainPad = 1,
  trend,
  trendColor = "#c8933f",
}: {
  data: TrendPoint[];
  color?: string;
  unit?: string;
  target?: number;
  domainPad?: number;
  /** Seconde ligne lissée (ex. poids EMA) tracée sans points, par-dessus les mesures brutes. */
  trend?: TrendPoint[];
  trendColor?: string;
}) {
  if (data.length < 2) {
    return (
      <div className="k-hatch flex h-40 items-center justify-center border border-dashed border-ink-700 text-xs text-bone-600">
        Deux points minimum pour tracer une tendance.
      </div>
    );
  }

  // Un point brut et son point lissé partagent la même date : on les fusionne
  // par date pour que Recharts trace les deux lignes sur un seul axe X commun
  // au lieu de deux séries désynchronisées.
  const merged = trend
    ? data.map((d) => ({ ...d, trendValue: trend.find((t) => t.date === d.date)?.value }))
    : data;

  const values = data.map((d) => d.value);
  if (trend) values.push(...trend.map((t) => t.value));
  if (target !== undefined) values.push(target);
  const min = Math.min(...values) - domainPad;
  const max = Math.max(...values) + domainPad;

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#262320" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={prettyShort}
            tick={{ fill: "#6f695e", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            axisLine={{ stroke: "#262320" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fill: "#6f695e", fontSize: 10, fontFamily: "IBM Plex Mono" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "#121110",
              border: "1px solid #262320",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono",
              fontSize: 11,
            }}
            labelStyle={{ color: "#6f695e" }}
            itemStyle={{ color: "#f4f1ea" }}
            labelFormatter={(l) => prettyShort(String(l))}
            formatter={(v, name) => [`${v}${unit}`, name === "trendValue" ? "lissé" : ""]}
          />
          {target !== undefined && (
            <ReferenceLine
              y={target}
              stroke="#6f8894"
              strokeDasharray="3 3"
              label={{
                value: `cible ${target}${unit}`,
                fill: "#6f8894",
                fontSize: 9,
                fontFamily: "IBM Plex Mono",
                position: "insideTopRight",
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={trend ? 1 : 2}
            strokeOpacity={trend ? 0.45 : 1}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
          {trend && (
            <Line
              type="monotone"
              dataKey="trendValue"
              stroke={trendColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
