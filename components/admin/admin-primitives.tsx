"use client"

import Link from "next/link"
import { MoreHorizontal, Plus, Search } from "lucide-react"
import { money } from "@/lib/admin-data"

export function PageHeader({ title, description, action, href }: { title: string; description: string; action?: string; href?: string }) { return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[#a97b4c]">Admin workspace</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-[#777]">{description}</p></div>{action && href && <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6f4e37] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#583b2b]"><Plus />{action}</Link>}</div> }
export function StatCard({ label, value, change, tone = "default" }: { label: string; value: string; change?: string; tone?: string }) { return <div className="rounded-xl border border-[#e8e6e0] bg-white p-4 sm:p-5"><p className="text-sm text-[#777]">{label}</p><div className="mt-2 flex items-end justify-between gap-2"><p className="text-2xl font-semibold tracking-tight">{value}</p>{change && <span className={tone === "warning" ? "text-xs font-medium text-[#a97b4c]" : "text-xs font-medium text-[#4e8a65]"}>{change}</span>}</div></div> }
export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) { const styles: Record<string, string> = { success: "bg-[#eaf4ed] text-[#3e7654]", warning: "bg-[#fbf3df] text-[#9a7132]", danger: "bg-[#fbeaea] text-[#a34d4d]", neutral: "bg-[#f1f0ed] text-[#777]" }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone] ?? styles.neutral}`}>{children}</span> }
export function Toolbar({
  placeholder = "Search...",
  value,
  onChange,
  filterOptions,
  filterValue,
  onFilterChange,
}: {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  filterOptions?: { label: string; value: string }[]
  filterValue?: string
  onFilterChange?: (value: string) => void
}) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row">
    <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e8e6e0] bg-white px-3 text-sm text-[#999]">
      <Search />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent py-2.5 text-[#191919] outline-none placeholder:text-[#aaa]" />
    </label>
    {filterOptions && onFilterChange && <label className="flex items-center gap-2 rounded-lg border border-[#e8e6e0] bg-white px-3 text-sm text-[#777]">
      <span className="sr-only">Filter results</span>
      <select value={filterValue ?? ""} onChange={(event) => onFilterChange(event.target.value)} className="bg-transparent py-2.5 outline-none">
        {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>}
  </div>
}
export function EmptyActions() { return <button className="rounded-lg p-2 text-[#999] hover:bg-[#f5f3ef] hover:text-[#191919]"><MoreHorizontal /></button> }
export function DemoNote() { return null }
export function MiniBars({ values }: { values: number[] }) {
  const maximum = Math.max(...values, 0)
  return <div className="flex h-32 items-end gap-2">
    {values.map((value, index) => <div key={index} className="flex-1 rounded-t bg-[#d8c47a]" style={{ height: maximum ? `${Math.max(4, value / maximum * 100)}%` : "4%" }} />)}
  </div>
}
