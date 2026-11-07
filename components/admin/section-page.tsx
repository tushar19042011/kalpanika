import { PageHeader } from "@/components/admin/admin-primitives"

export function SectionPage({ kind }: { kind: "settings" }) {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Settings"
        description="Payment and store settings are managed through the configured server environment."
      />
      <section className="rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-7">
        <h2 className="font-semibold">Checkout configuration</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777]">
          Checkout currently records orders with payment pending. No payment
          provider is configured, so order payments cannot be marked successful
          from this dashboard.
        </p>
        <p className="mt-4 text-xs text-[#999]">
          {kind === "settings" ? "Configure a verified payment provider before enabling payment status updates." : ""}
        </p>
      </section>
    </div>
  )
}
