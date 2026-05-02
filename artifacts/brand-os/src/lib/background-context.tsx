import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface BackgroundContextType {
  activeTheme: string;
  setActiveTheme: (key: string) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  activeTheme: "none",
  setActiveTheme: () => {},
});

export function BackgroundProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: string | null;
}) {
  const [activeTheme, setActiveTheme] = useState(initialTheme ?? "none");

  useEffect(() => {
    if (initialTheme && initialTheme !== activeTheme) {
      setActiveTheme(initialTheme);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTheme]);

  return (
    <BackgroundContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackgroundTheme() {
  return useContext(BackgroundContext);
}
