"use client"

import Link from "next/link"
import { SignOutButton, useUser } from "@clerk/nextjs"
import { ArrowRight, CircleUserRound, LogOut, Mail, Settings, ShieldCheck } from "lucide-react"

export default function AdminProfilePage() {
  const { isLoaded, isSignedIn, user } = useUser()

  if (!isLoaded) {
    return (
      <main className="mx-auto min-h-[50vh] max-w-4xl">
        <div className="h-8 w-48 animate-pulse rounded bg-[#ece9e3]" />
      </main>
    )
  }

  if (!isSignedIn || !user) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center rounded-xl border border-[#e8e6e0] bg-white p-8 text-center">
        <CircleUserRound className="size-8 text-[#6f4e37]" />
        <h1 className="mt-4 text-xl font-semibold">Profile unavailable</h1>
        <p className="mt-2 text-sm text-[#777]">Your administrator account could not be loaded.</p>
      </main>
    )
  }

  const name = user.fullName || user.username || "Administrator"
  const email = user.primaryEmailAddress?.emailAddress
  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[#a97b4c]">
          Admin workspace
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your profile</h1>
        <p className="mt-1 text-sm text-[#777]">Account details and administrator options.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <section className="rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-5 border-b border-[#eee] pb-6 sm:flex-row sm:items-center">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1ebe4] text-[#6f4e37]">
              {user.imageUrl ? (
                <img src={user.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <CircleUserRound className="size-8" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{name}</p>
              <p className="mt-1 text-sm text-[#777]">Administrator</p>
              {createdAt && <p className="mt-1 text-xs text-[#999]">Account since {createdAt}</p>}
            </div>
          </div>
          <div className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="rounded-lg bg-[#faf9f7] p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#999]">
                <CircleUserRound className="size-4" /> Name
              </div>
              <p className="mt-2 break-words text-sm font-medium">{name}</p>
            </div>
            <div className="rounded-lg bg-[#faf9f7] p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#999]">
                <Mail className="size-4" /> Email
              </div>
              <p className="mt-2 break-all text-sm font-medium">{email || "No email address available"}</p>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#e8e6e0] p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#6f4e37]" />
            <div>
              <p className="text-sm font-medium">Administrator access</p>
              <p className="mt-1 text-xs leading-5 text-[#777]">
                Your role and account security are managed by the existing Kalpanika sign-in.
              </p>
            </div>
          </div>
        </section>
        <section className="h-fit rounded-xl border border-[#e8e6e0] bg-white p-5">
          <h2 className="font-semibold">Profile options</h2>
          <p className="mt-1 text-sm text-[#777]">Manage your workspace or sign out securely.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/admin/settings"
              className="flex items-center justify-between rounded-lg border border-[#e8e6e0] px-4 py-3 text-sm transition-colors hover:bg-[#faf9f7]"
            >
              <span className="flex items-center gap-3"><Settings className="size-4 text-[#6f4e37]" />Workspace settings</span>
              <ArrowRight className="size-4 text-[#999]" />
            </Link>
            <SignOutButton>
              <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-[#777] transition-colors hover:bg-[#fbeaea] hover:text-[#a34d4d]">
                <LogOut className="size-4" /> Sign out
              </button>
            </SignOutButton>
          </div>
        </section>
      </div>
    </div>
  )
}
