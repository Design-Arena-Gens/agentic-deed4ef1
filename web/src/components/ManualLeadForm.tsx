"use client";

import { FormEvent, useState } from "react";

const SOURCES = ["MANUAL", "REFERRED", "WEBSITE"] as const;

export const ManualLeadForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    setIsSubmitting(true);
    setToast(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: payload.fullName,
          guardianName: payload.guardianName,
          phone: payload.phone,
          alternatePhone: payload.alternatePhone,
          email: payload.email,
          targetExam: payload.targetExam,
          city: payload.city,
          notes: payload.notes,
          source: payload.source,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error ?? "Failed to create lead");
      }

      form.reset();
      setToast("Lead added successfully");
    } catch (error) {
      setToast((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <input className="rounded border border-gray-200 px-3 py-2" name="fullName" placeholder="Student name" />
        <input className="rounded border border-gray-200 px-3 py-2" name="guardianName" placeholder="Parent/Guardian" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="rounded border border-gray-200 px-3 py-2" name="phone" placeholder="Primary phone" required />
        <input className="rounded border border-gray-200 px-3 py-2" name="alternatePhone" placeholder="Alternate phone" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="rounded border border-gray-200 px-3 py-2" name="email" placeholder="Email" />
        <input className="rounded border border-gray-200 px-3 py-2" name="city" placeholder="City" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="rounded border border-gray-200 px-3 py-2" name="targetExam" placeholder="Target Exam" />
        <select className="rounded border border-gray-200 px-3 py-2" defaultValue="MANUAL" name="source">
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>
      <textarea className="rounded border border-gray-200 px-3 py-2" name="notes" placeholder="Important notes" rows={3} />
      <button
        className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : "Add Lead Manually"}
      </button>
      {toast ? <span className="text-xs text-gray-500">{toast}</span> : null}
    </form>
  );
};
