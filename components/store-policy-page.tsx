import { StorefrontShell } from "@/components/storefront-shell"

export type StorePolicyContent = {
  label: string
  introduction: string
  sections: { title: string; paragraphs: string[] }[]
}

export function StorePolicyPage({ title, content }: { title: string; content: StorePolicyContent }) {
  return (
    <StorefrontShell>
      <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 md:px-10 md:py-24">
        <p className="eyebrow">{content.label}</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">{title}</h1>
        <p className="mt-6 border-t border-[#e6ddcc] pt-6 text-sm leading-7 text-[#777064]">{content.introduction}</p>
        <div className="mt-8 grid gap-8">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-medium text-[#493323]">{section.title}</h2>
              <div className="mt-2 grid gap-3 text-sm leading-7 text-[#777064]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
      </main>
    </StorefrontShell>
  )
}
