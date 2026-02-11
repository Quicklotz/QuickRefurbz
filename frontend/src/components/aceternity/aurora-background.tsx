"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main>
      <div
        className={cn(
          "relative flex flex-col h-[100vh] items-center justify-center bg-dark-primary text-white transition-bg",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              `
            [--ql-yellow:theme(colors.ql.yellow)]
            [--accent-purple:theme(colors.accent.purple)]
            [--accent-blue:theme(colors.accent.blue)]
            [--accent-green:theme(colors.accent.green)]
            [--dark-primary:theme(colors.dark.primary)]
            pointer-events-none
            absolute
            -inset-[10px]
            opacity-50
            will-change-transform`,
              `[background-image:var(--ql-yellow-gradient),var(--ql-yellow-gradient)]`,
              `[background-size:200%,_200%]`,
              `[background-position:50%_50%,50%_50%]`,
              `after:content-[""] after:absolute after:inset-0 after:[background-image:var(--ql-yellow-gradient),var(--ql-yellow-gradient)] after:[background-size:200%,_200%] after:animate-aurora after:[background-attachment:fixed] after:mix-blend-soft-light`,
              `[--ql-yellow-gradient:repeating-linear-gradient(100deg,var(--ql-yellow)_10%,var(--accent-purple)_15%,var(--accent-blue)_20%,var(--accent-green)_25%,var(--ql-yellow)_30%)]`,
              showRadialGradient &&
                `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`
            )}
          ></div>
        </div>
        {children}
      </div>
    </main>
  );
};
