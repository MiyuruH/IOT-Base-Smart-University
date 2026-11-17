"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface SplashScreenProps {
  onComplete?: () => void;
  autoRedirect?: boolean;
  destination?: string;
  duration?: number; // total duration in ms, default 4000ms
}

export default function SplashScreen({
  onComplete,
  autoRedirect = true,
  destination = "/login",
  duration = 2000,
}: SplashScreenProps) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);
  const hasFinishedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsExiting(true);

    try {
      sessionStorage.setItem("navsense_splash_seen", "true");
    } catch {
      // Ignore if sessionStorage is restricted
    }

    exitTimerRef.current = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else if (autoRedirect) {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (token) {
          router.replace("/dashboard");
        } else {
          router.replace(destination);
        }
      }
    }, 450);
  }, [onComplete, autoRedirect, destination, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFinish();
    }, duration);

    return () => {
      clearTimeout(timer);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [duration, handleFinish]);

  return (
    <div
      className={`splash-root ${isExiting ? "splash-exiting" : ""}`}
      onClick={handleFinish}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleFinish();
      }}
      title="Click to continue"
    >
      <style>{`
        .splash-root {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: #0f1117;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #EEEEEE;
          cursor: pointer;
          user-select: none;
          transition: opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), filter 0.45s ease;
          opacity: 1;
          transform: scale(1);
          filter: blur(0px);
        }

        .splash-exiting {
          opacity: 0 !important;
          transform: scale(1.04) !important;
          filter: blur(6px) !important;
          pointer-events: none;
        }

        /* Ambient Glow & Grid */
        .splash-bg-glow-1 {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 173, 181, 0.18) 0%, rgba(0, 173, 181, 0) 70%);
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
          animation: splashGlowPulse 3.5s ease-in-out infinite alternate;
        }

        .splash-bg-glow-2 {
          position: absolute;
          width: 440px;
          height: 440px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 212, 161, 0.12) 0%, rgba(0, 212, 161, 0) 70%);
          bottom: 15%;
          right: 25%;
          pointer-events: none;
        }

        .splash-grid-lines {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(72, 80, 91, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(72, 80, 91, 0.08) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
          pointer-events: none;
        }

        /* Center Hub */
        .splash-hub {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          z-index: 10;
          padding: 24px;
          max-width: 480px;
          width: 90%;
          animation: splashFadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Emblem & Radar Waves */
        .splash-logo-container {
          position: relative;
          width: 136px;
          height: 136px;
          margin-bottom: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .splash-radar-wave {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(0, 173, 181, 0.35);
          animation: splashRadarWave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }

        .splash-radar-wave:nth-child(2) {
          animation-delay: 0.9s;
        }

        .splash-radar-wave:nth-child(3) {
          animation-delay: 1.8s;
        }

        .splash-rotating-ring {
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          border: 1.5px dashed rgba(0, 173, 181, 0.5);
          animation: splashSpin 12s linear infinite;
        }

        .splash-emblem {
          position: relative;
          width: 86px;
          height: 86px;
          background: linear-gradient(135deg, #1E2025, #2B2E35);
          border: 2px solid #00ADB5;
          border-radius: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 32px rgba(0, 173, 181, 0.35), inset 0 0 16px rgba(0, 173, 181, 0.15);
          transform: rotate(0deg);
        }

        .splash-emblem-letter {
          font-size: 44px;
          font-weight: 900;
          background: linear-gradient(135deg, #00ADB5 20%, #00d4a1 90%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(0, 173, 181, 0.5));
          user-select: none;
        }

        .splash-active-beacon {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          background: #00d4a1;
          border: 2px solid #0f1117;
          border-radius: 50%;
          box-shadow: 0 0 10px #00d4a1;
          animation: splashBeaconPulse 1.6s ease-in-out infinite;
        }

        /* Branding Text */
        .splash-title {
          font-size: 40px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #FFFFFF 30%, #00ADB5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 28px rgba(0, 173, 181, 0.35);
        }

        .splash-subtitle {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #00ADB5;
          opacity: 0.9;
        }

        /* Minimal Loading Pulse Dots */
        .splash-pulse-dots {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 24px;
        }

        .splash-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00ADB5;
          box-shadow: 0 0 8px rgba(0, 173, 181, 0.6);
          animation: splashDotPulse 1.4s ease-in-out infinite;
        }

        .splash-pulse-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .splash-pulse-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        /* Keyframes */
        @keyframes splashFadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes splashRadarWave {
          0% {
            width: 80px;
            height: 80px;
            opacity: 0.9;
          }
          100% {
            width: 175px;
            height: 175px;
            opacity: 0;
          }
        }

        @keyframes splashSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes splashGlowPulse {
          0% {
            opacity: 0.5;
            transform: translateX(-50%) scale(0.95);
          }
          100% {
            opacity: 0.95;
            transform: translateX(-50%) scale(1.05);
          }
        }

        @keyframes splashBeaconPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.7;
          }
        }

        @keyframes splashDotPulse {
          0%, 100% {
            opacity: 0.25;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
            background: #00d4a1;
            box-shadow: 0 0 10px #00d4a1;
          }
        }
      `}</style>

      {/* Ambient background glows */}
      <div className="splash-bg-glow-1" />
      <div className="splash-bg-glow-2" />
      <div className="splash-grid-lines" />

      {/* Main Content Hub */}
      <div className="splash-hub">
        {/* Animated IoT Emblem */}
        <div className="splash-logo-container">
          <div className="splash-radar-wave" />
          <div className="splash-radar-wave" />
          <div className="splash-radar-wave" />
          <div className="splash-rotating-ring" />
          <div className="splash-emblem">
            <span className="splash-emblem-letter">N</span>
            <div className="splash-active-beacon" />
          </div>
        </div>

        {/* Brand Text */}
        <h1 className="splash-title">NavSense</h1>
        <p className="splash-subtitle">Smart Campus Monitoring System</p>

        {/* Minimalist Elegant Pulse Dots */}
        <div className="splash-pulse-dots">
          <span className="splash-pulse-dot" />
          <span className="splash-pulse-dot" />
          <span className="splash-pulse-dot" />
        </div>
      </div>
    </div>
  );
}
