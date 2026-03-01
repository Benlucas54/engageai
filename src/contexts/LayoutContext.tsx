"use client";

import { createContext, useContext, useState } from "react";

interface LayoutContextValue {
  wide: boolean;
  setWide: (wide: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  wide: false,
  setWide: () => {},
});

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [wide, setWide] = useState(false);
  return (
    <LayoutContext.Provider value={{ wide, setWide }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
