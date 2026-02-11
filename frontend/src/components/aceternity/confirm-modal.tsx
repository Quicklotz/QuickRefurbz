"use client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { Button } from "./button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

const variantStyles = {
  danger: {
    icon: "bg-accent-red/20 text-accent-red",
    button: "bg-accent-red hover:bg-accent-red/90",
  },
  warning: {
    icon: "bg-ql-yellow/20 text-ql-yellow",
    button: "bg-ql-yellow hover:bg-ql-yellow/90 text-black",
  },
  info: {
    icon: "bg-accent-blue/20 text-accent-blue",
    button: "bg-accent-blue hover:bg-accent-blue/90",
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  const styles = variantStyles[variant];

  const handleConfirm = () => {
    onConfirm();
    if (!loading) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          >
            <div className="bg-dark-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", styles.icon)}>
                    <IconAlertTriangle size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-dark-tertiary transition-colors"
                >
                  <IconX size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 p-4 border-t border-border bg-dark-tertiary/30">
                <Button
                  variant="secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  {cancelText}
                </Button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-50",
                    styles.button
                  )}
                >
                  {loading ? "Processing..." : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
