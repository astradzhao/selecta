"use client";

import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@selecta/ui/components/button";

const THEMES = ["system", "light", "dark"] as const;
type ThemeSetting = (typeof THEMES)[number];

function isThemeSetting(value: string | undefined): value is ThemeSetting {
  return THEMES.some((theme) => theme === value);
}

function nextTheme(current: string | undefined): ThemeSetting {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

function themeLabel(theme: string | undefined): string {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
}

function ThemeIcon({ theme }: { theme: string | undefined }) {
  if (theme === "light") return <SunIcon />;
  if (theme === "dark") return <MoonIcon />;
  return <MonitorIcon />;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted && isThemeSetting(theme) ? theme : "system";
  const next = nextTheme(current);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={!mounted}
      aria-label={`Color theme: ${themeLabel(current)}. Switch to ${themeLabel(next)}.`}
      onClick={() => setTheme(next)}
    >
      <ThemeIcon theme={current} />
    </Button>
  );
}
