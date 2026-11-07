import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { StorefrontShell } from '@/components/storefront-shell'

const steps = [
  ['01', 'Imagine', 'An idea begins as a feeling, a need, or a shape you cannot stop thinking about.'],
  ['02', 'Design', 'The thought becomes a digital model, refined until form and function feel in balance.'],
  ['03', 'Create', 'A 3D printer translates the model into layers, one precise gesture at a time.'],
  ['04', 'Experience', 'The finished object enters everyday life and starts to become personal.'],
]

export default function OurStoryPage() {
  return (
    <StorefrontShell active="story">
      <main>
        <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-8 sm:py-10 md:grid-cols-[.82fr_1.18fr] md:gap-10 md:px-10 md:py-11">
          <div>
            <p className="eyebrow">The story of Kalpanika</p>
            <h1 className="mt-4 max-w-lg text-[2.95rem] font-medium leading-[.98] tracking-[-.06em] sm:text-[3.25rem] md:text-[clamp(3.35rem,4.7vw,5rem)]">
              Ideas
              <br />
              <em className="font-serif font-normal">take shape.</em>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-[#777064] sm:leading-7">
              We transform imagination and thoughtful design into physical objects through 3D printing.
            </p>
          </div>
          <div className="relative aspect-[1.5] overflow-hidden bg-[#e9ddc5] sm:aspect-[1.3] md:aspect-[1.28]">
            <Image
              src="/kalpanika-hero.png"
              alt="Sculptural objects in a warm studio setting"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 60vw"
            />
            <span className="absolute bottom-4 left-4 bg-[#493323] px-3 py-2 text-xs text-[#f1e6a8]">
              Digital thought / physical form
            </span>
          </div>
        </section>

        <section className="border-y border-[#e6ddcc] bg-[#f7f1e3] px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-[1440px]">
            <p className="eyebrow">Our philosophy</p>
            <div className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_.9fr] md:gap-16">
              <div>
                <h2 className="max-w-2xl text-4xl font-medium leading-tight tracking-[-.05em] md:text-6xl">
                  Good design turns ordinary spaces into something personal.
                </h2>
                <p className="mt-7 max-w-xl leading-7 text-[#777064]">
                  Kalpanika is a design practice interested in the quiet magic of making. We explore useful, expressive objects that connect a digital idea with the texture of the real world. Every piece is an invitation to look closer, live with intention, and keep the things that feel like you.
                </p>
              </div>
              <div className="relative aspect-[1.15] overflow-hidden bg-[#e4d8c9]">
                <Image
                  src="/process-layer.png"
                  alt="A close-up detail of layered making"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 45vw"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">From idea to object</p>
              <h2 className="section-heading">A thought, made tangible.</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-[#777064]">
              A simple process, open to curiosity at every layer.
            </p>
          </div>
          <div className="grid border-t border-[#e6ddcc] md:grid-cols-4">
            {steps.map(([number, title, text]) => (
              <div
                key={number}
                className="border-b border-[#e6ddcc] py-8 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
              >
                <p className="text-xs tracking-[.18em] text-[#6f4e37]">{number}</p>
                <h3 className="mt-16 text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#777064]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#493323] px-5 py-24 text-[#fffcf5] md:px-10 md:py-32">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 md:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="eyebrow text-[#d8c47a]">Design values</p>
              <h2 className="mt-5 max-w-xl text-4xl font-medium leading-tight tracking-[-.05em] md:text-6xl">
                Technology with a human point of view.
              </h2>
            </div>
            <div className="grid gap-7 border-t border-[#8b715d] pt-7 text-sm leading-6 text-[#d9d0c4]">
              <div>
                <p className="text-[#f1e6a8]">01 / Thoughtful design</p>
                <p className="mt-2">Form should invite use, not ask for attention.</p>
              </div>
              <div>
                <p className="text-[#f1e6a8]">02 / Curiosity &amp; experimentation</p>
                <p className="mt-2">We leave room for the unexpected to make an appearance.</p>
              </div>
              <div>
                <p className="text-[#f1e6a8]">03 / Objects for everyday life</p>
                <p className="mt-2">The best ideas are the ones that find a place in your routine.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <div className="border-b border-[#e6ddcc] pb-16">
            <p className="eyebrow">A brand statement</p>
            <h2 className="mt-5 max-w-3xl text-5xl font-medium leading-[.98] tracking-[-.06em] md:text-8xl">
              From a digital idea to something you can hold.
            </h2>
          </div>
          <div className="flex flex-col justify-between gap-8 pt-10 md:flex-row md:items-end">
            <p className="max-w-sm leading-7 text-[#777064]">
              The collection is our ongoing sketchbook: a growing set of forms made for curious spaces.
            </p>
            <Link href="/products" className="button-primary">
              Explore products <ArrowUpRight />
            </Link>
          </div>
        </section>
      </main>
    </StorefrontShell>
  )
}
