"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Broadcast so every mounted useTheme instance re-renders after a toggle.
const THEME_EVENT = "sdc:theme";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  // Keep tabs in sync with each other.
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem("theme") === "dark";
}

// The server cannot know the visitor's stored preference, so it renders the
// light theme and the client corrects itself after hydration.
function getServerSnapshot() {
  return false;
}

/**
 * Dark mode preference, persisted in localStorage.
 *
 * Deliberately useSyncExternalStore rather than useState plus an effect that
 * reads localStorage and calls setState: that is the cascading-render pattern
 * the react-hooks lint rule rejects, and it also mismatches on hydration
 * because the server always renders light.
 */
export function useTheme() {
  const darkMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const toggleTheme = useCallback(() => {
    const next = localStorage.getItem("theme") !== "dark";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode) — the toggle still applies here.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { darkMode, toggleTheme };
}
