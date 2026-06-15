"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { poissonPmf } from "@/lib/model/poisson";

interface Props {
  homeGoalsEv: number;
  awayGoalsEv: number;
  homeName: string;
  awayName: string;
}

export default function MatchCharts({
  homeGoalsEv,
  awayGoalsEv,
  homeName,
  awayName,
}: Props) {
  const data = Array.from({ length: 7 }, (_, k) => ({
    goals: k,
    [homeName]: +(poissonPmf(homeGoalsEv, k) * 100).toFixed(1),
    [awayName]: +(poissonPmf(awayGoalsEv, k) * 100).toFixed(1),
  }));

  const ACCENT = "#00d4ff";
  const MUTED = "#6b7a8f";

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: number;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-xs space-y-1">
        <div className="text-[var(--muted-foreground)] mb-1">{label} goles</div>
        {payload.map((p) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}%
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={4}>
        <XAxis
          dataKey="goals"
          tick={{ fill: MUTED, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Goles", position: "insideBottom", offset: -2, fill: MUTED, fontSize: 10 }}
        />
        <YAxis
          tick={{ fill: MUTED, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey={homeName} radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={ACCENT} fillOpacity={0.85} />
          ))}
        </Bar>
        <Bar dataKey={awayName} radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={MUTED} fillOpacity={0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
