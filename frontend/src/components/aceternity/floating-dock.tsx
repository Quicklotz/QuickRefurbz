"use client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";

export const FloatingDock = ({
  items,
  className,
}: {
  items: {
    title: string;
    icon: React.ReactNode;
    href: string;
  }[];
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "mx-auto flex h-16 gap-4 items-end rounded-2xl bg-[var(--color-dark-card)] px-4 pb-3 border border-[var(--color-border)]",
        className
      )}
    >
      {items.map((item) => (
        <IconContainer key={item.title} {...item} />
      ))}
    </div>
  );
};

function IconContainer({
  title,
  icon,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <a
      ref={ref}
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative aspect-square rounded-full bg-[var(--color-dark-tertiary)] flex items-center justify-center transition-transform hover:scale-110"
      style={{ width: 40, height: 40 }}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 2, x: "-50%" }}
            className="absolute -top-8 left-1/2 px-2 py-0.5 whitespace-pre rounded-md bg-[var(--color-dark-tertiary)] border border-[var(--color-border)] text-white text-xs"
          >
            {title}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-center text-zinc-400 hover:text-white">
        {icon}
      </div>
    </a>
  );
}
