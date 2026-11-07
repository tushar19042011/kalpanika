"use client"

import * as React from "react"
import { ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import { cn } from "@/lib/utils"

type ChartConfig = Record<string, { label: string; color: string }>

export function ChartContainer({ config, className, children }: { config: ChartConfig; className?: string; children: React.ReactNode }) {
  return <div data-chart="kalpanika" style={Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color])) as React.CSSProperties} className={cn("h-full w-full text-xs", className)}><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>
}

export function ChartTooltip({ content }: { content?: React.ReactElement }) { return <RechartsTooltip content={content} cursor={{ stroke: "#e6ddcc", strokeDasharray: "4 4" }} /> }

type ChartTooltipPayload = { name?: string; value?: number | string }
export function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: ChartTooltipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  return <div className="rounded-lg border border-[#e6ddcc] bg-[#fffcf5] px-3 py-2 text-xs shadow-lg"><p className="mb-1 text-[#777064]">{label}</p>{payload.map((entry) => <div key={entry.name} className="flex items-center justify-between gap-5"><span className="text-[#777064]">{entry.name}</span><strong className="font-medium text-[#493323]">₹{Number(entry.value).toLocaleString("en-IN")}</strong></div>)}</div>
}
