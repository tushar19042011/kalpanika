"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { faqs } from "@/lib/faq-content"

export function FAQBrowser() {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const results = useMemo(
    () => faqs.filter((faq) =>
      `${faq.question} ${faq.answer} ${faq.category}`.toLocaleLowerCase().includes(normalizedQuery),
    ),
    [normalizedQuery],
  )

  return (
    <>
      <label className="mt-8 flex items-center gap-3 border-b border-[#493323] pb-3 text-[#777064]">
        <Search aria-hidden="true" className="size-5 shrink-0" />
        <span className="sr-only">Search frequently asked questions</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a question"
          className="min-w-0 flex-1 bg-transparent text-base text-[#493323] outline-none placeholder:text-[#777064]/70"
        />
      </label>
      <div className="mt-8 divide-y divide-[#e6ddcc] border-y border-[#e6ddcc]">
        {results.map((faq) => (
          <details key={faq.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-base font-medium text-[#493323] [&::-webkit-details-marker]:hidden">
              <span><span className="mb-1 block text-xs font-normal uppercase tracking-[0.12em] text-[#a97b4c]">{faq.category}</span>{faq.question}</span>
              <span aria-hidden="true" className="text-xl text-[#a97b4c] group-open:rotate-45">+</span>
            </summary>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#777064]">{faq.answer}</p>
          </details>
        ))}
        {results.length === 0 && (
          <p className="py-8 text-sm text-[#777064]">No questions match that search. Try another term or contact us.</p>
        )}
      </div>
    </>
  )
}
