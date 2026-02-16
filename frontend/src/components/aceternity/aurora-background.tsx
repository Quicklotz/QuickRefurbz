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
    <div
      className={cn(
        "relative flex flex-col min-h-screen items-center justify-center bg-[var(--color-dark-primary)] text-white",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn(
            "absolute -inset-[10px] opacity-50",
            "[--aurora:repeating-linear-gradient(100deg,var(--color-ql-yellow)_10%,rgba(212,168,0,0.3)_15%,transparent_30%,transparent_60%,rgba(212,168,0,0.3)_85%)]",
            "[background-image:var(--aurora)]",
            "[background-size:300%,_200%]",
            "[background-position:50%_50%,50%_50%]",
            "filter blur-[10px]",
            "after:content-[''] after:absolute after:inset-0",
            "after:[background-image:var(--aurora)]",
            "after:[background-size:200%,_100%]",
            "after:animate-aurora after:[background-attachment:fixed]",
            "after:mix-blend-difference",
            showRadialGradient &&
              "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]"
          )}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};
