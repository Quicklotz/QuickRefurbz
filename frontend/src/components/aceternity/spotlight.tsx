"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  className?: string;
  spotlightColor?: string;
  children?: React.ReactNode;
}

export const Spotlight = ({
  className,
  spotlightColor = "rgba(255, 255, 255, 0.1)",
  children,
}: SpotlightProps) => {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
};

interface SpotlightCardProps {
  className?: string;
  children?: React.ReactNode;
}

export const SpotlightCard = ({
  className,
  children,
}: SpotlightCardProps) => {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-dark-card)] transition-colors",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(241, 196, 15, 0.06), transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
};
