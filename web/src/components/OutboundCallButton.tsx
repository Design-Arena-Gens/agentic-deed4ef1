"use client";

import { useState } from "react";

type Props = {
  leadId: string;
  phone?: string | null;
};

export const OutboundCallButton = ({ leadId, phone }: Props) => {
  const [isCalling, setIsCalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    if (!phone) {
      setMessage("Phone number missing");
      return;
    }
    setIsCalling(true);
    setMessage(null);
    try {
      const response = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Call failed");
      }
      setMessage("Calling now...");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        className="rounded border border-blue-600 px-3 py-1 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        disabled={isCalling || !phone}
        onClick={handleClick}
        type="button"
      >
        {isCalling ? "Dialing..." : "Call Now"}
      </button>
      {message ? <span className="text-[11px] text-gray-500">{message}</span> : null}
    </div>
  );
};
