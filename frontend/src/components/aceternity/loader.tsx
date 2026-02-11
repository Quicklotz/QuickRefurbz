"use client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "spinner" | "dots" | "pulse" | "bars";
  color?: string;
  text?: string;
}

const sizeConfig = {
  sm: { loader: "w-4 h-4", text: "text-xs", gap: "gap-1" },
  md: { loader: "w-6 h-6", text: "text-sm", gap: "gap-1.5" },
  lg: { loader: "w-8 h-8", text: "text-base", gap: "gap-2" },
  xl: { loader: "w-12 h-12", text: "text-lg", gap: "gap-3" },
};

// Spinner variant
const SpinnerLoader = ({ size, color }: { size: keyof typeof sizeConfig; color: string }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    className={cn(
      "rounded-full border-2 border-transparent",
      sizeConfig[size].loader
    )}
    style={{
      borderTopColor: color,
      borderRightColor: `${color}40`,
    }}
  />
);

// Dots variant
const DotsLoader = ({ size, color }: { size: keyof typeof sizeConfig; color: string }) => {
  const dotSize = size === "sm" ? 4 : size === "md" ? 6 : size === "lg" ? 8 : 10;

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
          }}
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
          }}
          className="rounded-full"
        />
      ))}
    </div>
  );
};

// Pulse variant
const PulseLoader = ({ size, color }: { size: keyof typeof sizeConfig; color: string }) => (
  <div className="relative">
    <motion.div
      animate={{
        scale: [1, 1.5, 1],
        opacity: [1, 0, 1],
      }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={cn("rounded-full absolute inset-0", sizeConfig[size].loader)}
      style={{ backgroundColor: `${color}30` }}
    />
    <motion.div
      animate={{ scale: [0.8, 1, 0.8] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={cn("rounded-full", sizeConfig[size].loader)}
      style={{ backgroundColor: color }}
    />
  </div>
);

// Bars variant
const BarsLoader = ({ size, color }: { size: keyof typeof sizeConfig; color: string }) => {
  const barWidth = size === "sm" ? 2 : size === "md" ? 3 : size === "lg" ? 4 : 5;
  const barHeight = size === "sm" ? 12 : size === "md" ? 16 : size === "lg" ? 20 : 28;

  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          animate={{
            scaleY: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
          }}
          style={{
            width: barWidth,
            height: barHeight,
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};

export const Loader = ({
  className,
  size = "md",
  variant = "spinner",
  color = "#f1c40f",
  text,
}: LoaderProps) => {
  const LoaderComponent = {
    spinner: SpinnerLoader,
    dots: DotsLoader,
    pulse: PulseLoader,
    bars: BarsLoader,
  }[variant];

  return (
    <div className={cn("flex flex-col items-center justify-center", sizeConfig[size].gap, className)}>
      <LoaderComponent size={size} color={color} />
      {text && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn("text-zinc-400", sizeConfig[size].text)}
        >
          {text}
        </motion.span>
      )}
    </div>
  );
};

// Full page loading overlay
export const LoaderOverlay = ({
  visible,
  text = "Loading...",
  variant = "spinner",
}: {
  visible: boolean;
  text?: string;
  variant?: LoaderProps["variant"];
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-primary/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-dark-card border border-border"
          >
            <Loader size="xl" variant={variant} />
            <span className="text-zinc-300 font-medium">{text}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Inline skeleton for loading states
export const Skeleton = ({
  className,
  width,
  height = "1rem",
}: {
  className?: string;
  width?: string;
  height?: string;
}) => (
  <motion.div
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity }}
    className={cn("bg-dark-tertiary rounded", className)}
    style={{ width, height }}
  />
);
