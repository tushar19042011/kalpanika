"use client"

import { AdminDropdown } from "@/components/admin/admin-interactions"
import { useAdminData } from "@/components/admin/admin-data-provider"
import { StatusBadge } from "@/components/admin/admin-primitives"
import { fulfillmentStatuses, fulfillmentTransitions } from "@/lib/admin-data"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"

export function OrderStatusControl({ orderId }: { orderId: string }) {
  const { orders, ready, setFulfillmentStatus } = useAdminData()
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const order = orders.find((item) => item.id.replace(/^#/, "") === orderId)
  if (!ready || !order) return <p className="mt-4 text-sm text-[#777]">{ready ? "Order not found." : "Loading order…"}</p>

  return <>
    <AdminDropdown
      label={`Change fulfillment status for order ${order.id}`}
      disabled={saving}
      triggerClassName="mt-4 cursor-pointer rounded-full outline-offset-2 hover:ring-2 hover:ring-[#6f4e37]/20 focus-visible:ring-2 focus-visible:ring-[#6f4e37]"
      trigger={<StatusBadge tone={order.status === "Delivered" ? "success" : order.status === "Cancelled" ? "danger" : "warning"}>{saving && <LoaderCircle aria-hidden="true" className="mr-1 size-3 animate-spin" />}{order.status}</StatusBadge>}
      options={fulfillmentStatuses.map((status) => {
        const transitionAllowed = status === order.status || fulfillmentTransitions[order.status].includes(status)
        return {
        label: status,
        selected: status === order.status,
        disabled: saving || !transitionAllowed,
        disabledReason: transitionAllowed ? undefined : `Cannot move from ${order.status} to ${status}.`,
        onSelect: () => {
          setSaving(true)
          void setFulfillmentStatus(order.id, status).then((error) => {
            setFeedback({ message: error ?? `Fulfillment updated to ${status.toLowerCase()}.`, error: Boolean(error) })
          }).finally(() => setSaving(false))
        },
      }})}
    />
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`mt-3 text-xs ${feedback.error ? "text-[#a34d4d]" : "text-[#3e7654]"}`}>{feedback.message}</p>}
  </>
}
