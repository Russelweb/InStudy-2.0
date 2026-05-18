/**
 * AuraMascot — the visual Aura companion.
 * Mounted once in MainLayout. Reads from AuraContext.
 *
 * Sits fixed bottom-right. The orb animates based on mode.
 * Speech bubble appears above the orb when there's a message.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useAura } from "../context/AuraContext";
import AuraQuickChat from "./AuraQuickChat";
import TextSelectionMenu from "./TextSelectionMenu";

// ── Orb animation variants per mode ──────────────────────────────────────
const orbVariants = {
  idle: {
    y: [0, -6, 0],
    scale: 1,
    rotate: 0,
    transition: {
      y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
      scale: { duration: 0.3 },
    },
  },
  pointing: {
    y: -10,
    scale: 1.08,
    rotate: -14,
    transition: { duration: 0.4, ease: "easeOut" },
  },
  thinking: {
    scale: [1, 1.05, 1],
    rotate: [0, 360],
    transition: {
      scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 2.5, ease: "linear" },
    },
  },
  celebrating: {
    y: [0, -18, 0, -10, 0],
    scale: [1, 1.2, 1, 1.1, 1],
    rotate: [0, 8, -8, 4, 0],
    transition: { duration: 0.7, ease: "easeOut" },
  },
  concerned: {
    x: [0, -4, 4, -3, 3, 0],
    scale: 0.95,
    rotate: 0,
    transition: {
      x: { duration: 0.4, ease: "easeOut" },
      scale: { duration: 0.3 },
    },
  },
  nudge: {
    y: [0, -8, 0],
    scale: [1, 1.06, 1],
    rotate: [0, -6, 6, 0],
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Personality theme palettes
const personalityPalettes = {
  socratic: {
    idle: "rgba(14,165,233,0.35)",
    pointing: "rgba(14,165,233,0.55)",
    thinking: "rgba(14,165,233,0.4)",
    celebrating: "rgba(105,246,184,0.6)",
    concerned: "rgba(215,51,87,0.4)",
    nudge: "rgba(14,165,233,0.45)",
    inner: {
      idle: ["#0284c7", "#0369a1"],
      pointing: ["#06b6d4", "#0891b2"],
      thinking: ["#0284c7", "#0369a1"],
      celebrating: ["#059669", "#065f46"],
      concerned: ["#be123c", "#881337"],
      nudge: ["#0284c7", "#0369a1"],
    }
  },
  cheerleader: {
    idle: "rgba(234,179,8,0.35)",
    pointing: "rgba(234,179,8,0.55)",
    thinking: "rgba(234,179,8,0.4)",
    celebrating: "rgba(105,246,184,0.6)",
    concerned: "rgba(215,51,87,0.4)",
    nudge: "rgba(234,179,8,0.45)",
    inner: {
      idle: ["#eab308", "#ca8a04"],
      pointing: ["#facc15", "#eab308"],
      thinking: ["#eab308", "#ca8a04"],
      celebrating: ["#10b981", "#059669"],
      concerned: ["#be123c", "#881337"],
      nudge: ["#eab308", "#ca8a04"],
    }
  },
  strict: {
    idle: "rgba(244,63,94,0.35)",
    pointing: "rgba(244,63,94,0.55)",
    thinking: "rgba(244,63,94,0.4)",
    celebrating: "rgba(105,246,184,0.6)",
    concerned: "rgba(215,51,87,0.4)",
    nudge: "rgba(244,63,94,0.45)",
    inner: {
      idle: ["#e11d48", "#9f1239"],
      pointing: ["#f43f5e", "#be123c"],
      thinking: ["#e11d48", "#9f1239"],
      celebrating: ["#059669", "#065f46"],
      concerned: ["#be123c", "#881337"],
      nudge: ["#e11d48", "#9f1239"],
    }
  }
};

// ── Upward pointer arrow (for onboarding/guide) ───────────────────────────
const PointerArrow = () => (
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
    transition={{ duration: 1.6, repeat: 2, ease: "easeInOut" }}
    className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5"
  >
    <span className="material-symbols-outlined text-primary text-lg">
      keyboard_arrow_up
    </span>
  </motion.div>
);

// ── Speech bubble ─────────────────────────────────────────────────────────
const SpeechBubble = ({ message, action, mode, onDismiss }) => {
  const borderColor =
    {
      celebrating: "border-secondary/30",
      concerned: "border-error-dim/30",
      nudge: "border-primary/30",
      pointing: "border-primary/30",
      guide: "border-primary/30",
    }[mode] || "border-outline-variant/20";

  const iconColor =
    {
      celebrating: "text-secondary",
      concerned: "text-error",
      nudge: "text-primary",
    }[mode] || "text-primary";

  const icon =
    {
      celebrating: "celebration",
      concerned: "warning",
      nudge: "schedule",
      pointing: "arrow_upward",
      guide: "lightbulb",
    }[mode] || "auto_awesome";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.94 }}
      transition={{ duration: 0.2 }}
      className={`absolute bottom-16 right-0 w-64 sm:w-72 bg-surface-container border ${borderColor} rounded-2xl shadow-2xl p-4 backdrop-blur-xl`}
      style={{ background: "rgba(24,32,25,0.95)" }}
    >
      {/* Tail */}
      <div
        className="absolute -bottom-2 right-5 w-4 h-4 bg-surface-container border-r border-b border-outline-variant/20 rotate-45"
        style={{ background: "rgba(24,32,25,0.95)" }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-base ${iconColor}`}>
            {icon}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Aura
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-on-surface-variant/40 hover:text-on-surface-variant transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {/* Message */}
      <p className="text-sm text-on-surface leading-snug mb-3">{message}</p>

      {/* Action button */}
      {action && (
        <button
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="w-full py-2 px-3 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
        >
          {action.label}
          <span className="material-symbols-outlined text-sm">
            arrow_forward
          </span>
        </button>
      )}
    </motion.div>
  );
};

import { useState } from "react";

// ── Main component ────────────────────────────────────────────────────────
const AuraMascot = () => {
  const { auraState, dismissAura, toggleQuickChat, askAuraBackground, personality } =
    useAura();
  const [isDragOver, setIsDragOver] = useState(false);
  const [radialMenuOpen, setRadialMenuOpen] = useState(false);
  const { mode, message, action, visible } = auraState;

  const currentPalette = personalityPalettes[personality] || personalityPalettes.socratic;

  const glow = isDragOver
    ? "var(--md-sys-color-primary)"
    : currentPalette[mode] || currentPalette.idle;
  const colors = isDragOver
    ? [currentPalette.inner.thinking[0], currentPalette.inner.celebrating[1]]
    : currentPalette.inner[mode] || currentPalette.inner.idle;
  const showArrow = (mode === "pointing" || mode === "guide") && visible;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const textData = e.dataTransfer.getData("text/plain");
    if (textData) {
      askAuraBackground(`Summarize this text: "${textData}"`);
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      askAuraBackground(
        `I just dropped ${files.length} file(s) onto you: ${files.map((f) => f.name).join(", ")}. Tell me briefly what I should do with them.`,
      );
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setRadialMenuOpen((prev) => !prev);
  };

  return (
    <>
      {/* Global Text Selection Listener for Aura */}
      <TextSelectionMenu />

      <div className="fixed bottom-6 right-5 z-[110] flex flex-col items-end select-none">
        {/* Quick Chat Popover */}
        <AuraQuickChat />

        {/* Speech bubble */}
        <AnimatePresence>
          {visible && message && (
            <SpeechBubble
              key="bubble"
              message={message}
              action={action}
              mode={mode}
              onDismiss={dismissAura}
            />
          )}
        </AnimatePresence>

        {/* Orb container to position the radial menu around it */}
        <div className="relative">
          {/* Radial Menu */}
          <AnimatePresence>
            {radialMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ width: "200px", height: "200px", zIndex: -1 }}
              >
                {[
                  {
                    icon: "auto_awesome",
                    label: "Summarize",
                    action: () =>
                      askAuraBackground(
                        "Please summarize the main concepts on this page in 2 sentences.",
                      ),
                  },
                  {
                    icon: "quiz",
                    label: "Quiz Me",
                    action: () =>
                      askAuraBackground(
                        "Generate a single quick quiz question to test my knowledge on this topic. Don't give the answer, wait for me to answer.",
                      ),
                  },
                  {
                    icon: "event",
                    label: "Plan Day",
                    action: () =>
                      askAuraBackground(
                        "Give me a 1-sentence tip on what to study right now.",
                      ),
                  },
                  {
                    icon: "lightbulb",
                    label: "Explain",
                    action: () =>
                      askAuraBackground(
                        "Can you explain this topic like I am 5 years old in just one sentence?",
                      ),
                  },
                ].map((item, index) => {
                  // Fan out items from Left (180deg) to Top (270deg) because Aura is in bottom-right corner
                  const startAngle = 180;
                  const endAngle = 270;
                  const step = (endAngle - startAngle) / (4 - 1);
                  const angle = (startAngle + index * step) * (Math.PI / 180);
                  const radius = 80;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;

                  return (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: 1, x, y, scale: 1 }}
                      exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                      transition={{
                        delay: index * 0.05,
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.action();
                        setRadialMenuOpen(false);
                      }}
                      className="absolute pointer-events-auto w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-primary/20 text-on-surface hover:text-primary transition-colors shadow-lg border border-outline-variant/30 backdrop-blur-md group"
                      style={{
                        left: "calc(50% - 24px)",
                        top: "calc(50% - 24px)",
                      }}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {item.icon}
                      </span>
                      <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none border border-outline-variant/20">
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Orb */}
          <motion.button
            onClick={() => {
              if (visible) {
                dismissAura();
              } else {
                toggleQuickChat();
              }
              setRadialMenuOpen(false);
            }}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label="Aura — click to chat, right-click for quick actions"
            className="relative w-12 h-12 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            variants={orbVariants}
            animate={mode}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
          >
            {/* Pointer arrow */}
            <AnimatePresence>
              {showArrow && <PointerArrow key="arrow" />}
            </AnimatePresence>

            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ boxShadow: `0 0 20px 6px ${glow}` }}
              transition={{ duration: 0.4 }}
            />

            {/* Orb body — SVG gradient sphere */}
            <svg
              viewBox="0 0 48 48"
              className="w-full h-full"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="aura-grad" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor={colors[0]} stopOpacity="1" />
                  <stop offset="100%" stopColor={colors[1]} stopOpacity="1" />
                </radialGradient>
                <radialGradient id="aura-shine" cx="30%" cy="25%" r="40%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* Base sphere */}
              <circle cx="24" cy="24" r="22" fill="url(#aura-grad)" />
              {/* Shine highlight */}
              <circle cx="24" cy="24" r="22" fill="url(#aura-shine)" />
              {/* Inner symbol — changes by mode */}
              {mode === "thinking" && (
                <motion.circle
                  cx="24"
                  cy="24"
                  r="8"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="2"
                  strokeDasharray="16 32"
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    ease: "linear",
                  }}
                  style={{ transformOrigin: "24px 24px" }}
                />
              )}
              {mode === "celebrating" && (
                <>
                  <circle
                    cx="18"
                    cy="22"
                    r="2.5"
                    fill="rgba(255,255,255,0.7)"
                  />
                  <circle
                    cx="24"
                    cy="18"
                    r="2.5"
                    fill="rgba(255,255,255,0.7)"
                  />
                  <circle
                    cx="30"
                    cy="22"
                    r="2.5"
                    fill="rgba(255,255,255,0.7)"
                  />
                </>
              )}
              {(mode === "idle" ||
                mode === "pointing" ||
                mode === "nudge" ||
                mode === "guide") && (
                /* Subtle inner glow dot */
                <circle cx="24" cy="24" r="6" fill="rgba(255,255,255,0.15)" />
              )}
              {mode === "concerned" && (
                /* Dimmed inner */
                <circle cx="24" cy="24" r="6" fill="rgba(0,0,0,0.2)" />
              )}
            </svg>
          </motion.button>
        </div>
      </div>
    </>
  );
};

export default AuraMascot;
