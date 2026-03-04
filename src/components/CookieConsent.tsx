"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "engageai_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept(value: string) {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] border-t border-border bg-surface-card px-6 py-4">
      <div className="max-w-[720px] mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="flex-1 text-[13px] text-content-sub leading-relaxed">
          We use essential cookies to keep you signed in. No tracking or
          advertising cookies are used.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accept("essential")}
            className="bg-surface-card text-content border border-border rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap py-[5px] px-3.5 text-[11px]"
          >
            Essential only
          </button>
          <button
            onClick={() => accept("all")}
            className="bg-content text-white border border-content rounded-md font-medium cursor-pointer font-sans tracking-[0.02em] whitespace-nowrap py-[5px] px-3.5 text-[11px]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
