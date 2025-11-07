"use client";

import { useState } from "react";

export const SyncLeadsButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/leads/sync", { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Failed to sync leads");
      }
      setMessage(`Fetched ${json.result.upserted} new leads`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
        disabled={isLoading}
        onClick={handleSync}
      >
        {isLoading ? "Syncing leads..." : "Sync Facebook + Google Leads"}
      </button>
      {message ? <span className="text-xs text-gray-500">{message}</span> : null}
    </div>
  );
};
