"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import SplashScreen from "@/components/SplashScreen";

export default function AppSplashGate() {
  const pathname = usePathname();
  // Keep initial pathname so navigating from "/" to "/login" or "/dashboard"
  // does not trigger a second splash screen.
  const [initialPath] = useState(pathname);
  const [dismissed, setDismissed] = useState(false);

  if (initialPath === "/" || dismissed) {
    return null;
  }

  return (
    <SplashScreen
      duration={4000}
      autoRedirect={false}
      onComplete={() => setDismissed(true)}
    />
  );
}
