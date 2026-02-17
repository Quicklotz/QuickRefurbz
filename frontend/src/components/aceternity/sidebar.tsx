"use client";
import React, { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NavLink, useLocation } from "react-router-dom";
import { IconMenu2, IconX, IconChevronRight } from "@tabler/icons-react";

interface SidebarContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  open: false,
  setOpen: () => {},
  animate: true,
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({
  children,
  open: controlledOpen,
  setOpen: controlledSetOpen,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  animate?: boolean;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledSetOpen ?? setInternalOpen;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { open, setOpen, animate } = useSidebar();

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: animate ? (open ? 256 : 72) : open ? 256 : 72,
        }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        className={cn(
          "fixed top-0 left-0 bottom-0 z-40 bg-dark-secondary border-r border-border flex-col hidden md:flex",
          className
        )}
      >
        {/* Toggle button */}
        <button
          onClick={() => setOpen(!open)}
          className="absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-dark-secondary border border-border flex items-center justify-center text-zinc-400 hover:text-white hover:bg-dark-tertiary transition-colors"
        >
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <IconChevronRight size={14} />
          </motion.div>
        </button>
        {children}
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-dark-secondary border-r border-border flex flex-col md:hidden",
                className
              )}
            >
              {children}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export const SidebarBody = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
      {children}
    </div>
  );
};

export const SidebarHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("px-4 py-4 border-b border-border flex-shrink-0", className)}>
      {children}
    </div>
  );
};

export const SidebarContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <nav className={cn("flex-1 overflow-y-auto py-4 px-2 space-y-1", className)}>
      {children}
    </nav>
  );
};

export const SidebarFooter = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("border-t border-border flex-shrink-0", className)}>
      {children}
    </div>
  );
};

export const SidebarLink = ({
  to,
  icon,
  label,
  end = false,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  onClick?: () => void;
}) => {
  const { open, animate } = useSidebar();
  const location = useLocation();
  const isActive = end
    ? location.pathname === to
    : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
        isActive
          ? "bg-ql-yellow text-black"
          : "text-zinc-400 hover:bg-dark-tertiary hover:text-white"
      )}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {icon}
      </div>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: animate ? 0.2 : 0 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
};

export const SidebarButton = ({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "danger";
}) => {
  const { open, animate } = useSidebar();

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full",
        variant === "danger"
          ? "text-accent-red hover:bg-accent-red/10"
          : "text-zinc-400 hover:bg-dark-tertiary hover:text-white"
      )}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {icon}
      </div>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: animate ? 0.2 : 0 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

export const SidebarLogo = ({
  logo,
  logoCompact,
  title,
}: {
  logo?: React.ReactNode;
  logoCompact?: React.ReactNode;
  title?: string;
}) => {
  const { open } = useSidebar();

  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            {logo || <span className="text-2xl font-bold text-ql-yellow">{title || "QR"}</span>}
          </motion.div>
        ) : (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {logoCompact || <span className="text-2xl font-bold text-ql-yellow">QR</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarToggle = ({ className }: { className?: string }) => {
  const { open, setOpen } = useSidebar();

  return (
    <button
      onClick={() => setOpen(!open)}
      className={cn(
        "p-2 rounded-lg bg-dark-tertiary text-zinc-400 hover:text-white hover:bg-dark-hover transition-colors md:hidden",
        className
      )}
    >
      {open ? <IconX size={20} /> : <IconMenu2 size={20} />}
    </button>
  );
};

export const SidebarSection = ({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const { open, animate } = useSidebar();

  return (
    <div className={cn("mb-4", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: animate ? 0.15 : 0 }}
            className="px-3 mb-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {title}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
};

export const SidebarDivider = ({ className }: { className?: string }) => {
  return <div className={cn("h-px bg-border mx-3 my-3", className)} />;
};

export const SidebarUserSection = ({
  avatar,
  name,
  role,
}: {
  avatar?: React.ReactNode;
  name: string;
  role?: string;
}) => {
  const { open, animate } = useSidebar();

  return (
    <div className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-ql-yellow text-black flex items-center justify-center font-bold flex-shrink-0">
        {avatar || name.charAt(0).toUpperCase()}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: animate ? 0.2 : 0 }}
            className="flex-1 overflow-hidden"
          >
            <div className="font-semibold text-sm text-white truncate">{name}</div>
            {role && <div className="text-xs text-zinc-500 capitalize truncate">{role}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
