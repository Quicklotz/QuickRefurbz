"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { IconX, IconCheck, IconAlertTriangle, IconInfoCircle, IconAlertCircle } from "@tabler/icons-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

const toastConfig = {
  success: {
    icon: IconCheck,
    bg: "bg-accent-green/10",
    border: "border-accent-green/30",
    iconColor: "text-accent-green",
    iconBg: "bg-accent-green/20",
  },
  error: {
    icon: IconAlertCircle,
    bg: "bg-accent-red/10",
    border: "border-accent-red/30",
    iconColor: "text-accent-red",
    iconBg: "bg-accent-red/20",
  },
  warning: {
    icon: IconAlertTriangle,
    bg: "bg-ql-yellow/10",
    border: "border-ql-yellow/30",
    iconColor: "text-ql-yellow",
    iconBg: "bg-ql-yellow/20",
  },
  info: {
    icon: IconInfoCircle,
    bg: "bg-accent-blue/10",
    border: "border-accent-blue/30",
    iconColor: "text-accent-blue",
    iconBg: "bg-accent-blue/20",
  },
};

const ToastItem = ({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: () => void;
}) => {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  React.useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(onRemove, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm",
        "bg-dark-card",
        config.border
      )}
    >
      <div className={cn("p-1.5 rounded-lg flex-shrink-0", config.iconBg)}>
        <Icon size={16} className={config.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-zinc-400 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-dark-tertiary transition-colors flex-shrink-0"
      >
        <IconX size={14} />
      </button>
    </motion.div>
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, message?: string) => addToast({ type: "success", title, message }),
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string) => addToast({ type: "error", title, message }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string) => addToast({ type: "warning", title, message }),
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string) => addToast({ type: "info", title, message }),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info }}
    >
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// Utility hook for common toast patterns
export const useToastActions = () => {
  const toast = useToast();

  return {
    showSuccess: toast.success,
    showError: toast.error,
    showWarning: toast.warning,
    showInfo: toast.info,
    handleError: (error: unknown, fallbackMessage = "An error occurred") => {
      const message = error instanceof Error ? error.message : fallbackMessage;
      toast.error("Error", message);
    },
    handleApiError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Request failed";
      toast.error("API Error", message);
    },
  };
};
