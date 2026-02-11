"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[18rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  children,
  onClick,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none p-4 dark:bg-dark-card bg-white dark:border-border border-transparent justify-between flex flex-col space-y-4 border cursor-pointer",
        className
      )}
    >
      {header && (
        <div className="flex-1 min-h-0">
          {header}
        </div>
      )}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        {icon && (
          <div className="mb-2 text-ql-yellow">
            {icon}
          </div>
        )}
        {title && (
          <div className="font-semibold text-white mb-1 text-sm">
            {title}
          </div>
        )}
        {description && (
          <div className="text-zinc-400 text-xs leading-relaxed">
            {description}
          </div>
        )}
        {children}
      </div>
    </motion.div>
  );
};

// Stat card variant for dashboard
export const BentoStatCard = ({
  className,
  title,
  value,
  trend,
  icon,
  variant = "default",
}: {
  className?: string;
  title: string;
  value: string | number;
  trend?: { value: number; label: string; direction?: "up" | "down" };
  icon?: React.ReactNode;
  variant?: "default" | "yellow" | "green" | "blue" | "red";
}) => {
  const variantStyles = {
    default: "bg-dark-card border-border",
    yellow: "bg-ql-yellow/10 border-ql-yellow/30",
    green: "bg-accent-green/10 border-accent-green/30",
    blue: "bg-accent-blue/10 border-accent-blue/30",
    red: "bg-accent-red/10 border-accent-red/30",
  };

  const iconStyles = {
    default: "bg-dark-tertiary text-zinc-400",
    yellow: "bg-ql-yellow/20 text-ql-yellow",
    green: "bg-accent-green/20 text-accent-green",
    blue: "bg-accent-blue/20 text-accent-blue",
    red: "bg-accent-red/20 text-accent-red",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border p-4 flex items-start justify-between transition-all duration-200",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex-1">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold text-white mb-1">
          {value}
        </p>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend.direction === "down" ? "text-accent-red" : "text-accent-green"
          )}>
            <span>{trend.direction === "down" ? "↓" : "↑"}{Math.abs(trend.value)}</span>
            <span className="text-zinc-500">{trend.label}</span>
          </div>
        )}
      </div>
      {icon && (
        <div className={cn(
          "p-2.5 rounded-lg flex-shrink-0",
          iconStyles[variant]
        )}>
          {icon}
        </div>
      )}
    </motion.div>
  );
};
