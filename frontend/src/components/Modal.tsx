import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./Icons";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = "560px",
  children,
  footer,
  danger = false,
  zIndex,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      // Only restore scroll when no other modal is active
      const remaining = document.querySelectorAll(".modal-backdrop");
      if (remaining.length <= 1) {
        document.body.style.overflow = "auto";
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Confirmation/danger dialogs get front-most priority (3000), regular modals get 1500
  const effectiveZIndex = zIndex ?? (danger ? 3000 : 1500);

  const modalNode = (
    <div
      className={`modal-backdrop ${danger ? "is-danger modal-backdrop-alert" : ""}`}
      style={{ zIndex: effectiveZIndex }}
      onClick={onClose}
    >
      <div
        className={`modal-window-3d ${danger ? "modal-danger" : ""}`}
        style={{
          maxWidth,
          position: "relative",
          zIndex: effectiveZIndex + 1,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            {typeof title === "string" ? <h3 className="modal-title">{title}</h3> : title}
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-content-scroll">
          {children}
        </div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
