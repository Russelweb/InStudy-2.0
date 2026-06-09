/**
 * useHeartbeat — Phase 4, Tasks 4.1 + 4.2
 *
 * Tracks PRODUCTIVE study time — only counts time when the student
 * is actively interacting with a tool, not just sitting on the page.
 *
 * Usage:
 *   const { recordInteraction } = useHeartbeat(courseId, 'flashcard', docId);
 *
 *   // Call recordInteraction() whenever a qualifying action happens:
 *   //   - Flashcard rated
 *   //   - Quiz answer submitted
 *   //   - Tutor message sent / received
 *   //   - Document page changed
 *
 * Qualifying interactions reset a 2-minute idle timer.
 * A heartbeat (30s of productive time) is sent to the backend every 30s
 * ONLY IF at least one qualifying interaction happened in the last 30s.
 * Idle tabs NEVER send heartbeats.
 *
 * The hook is fully safe — all errors are swallowed silently so a
 * heartbeat failure can never break the study experience.
 */

import { useEffect, useRef, useCallback } from 'react';
import { masteryService } from '../services/api';

const HEARTBEAT_INTERVAL_MS  = 30_000;   // 30 seconds
const IDLE_TIMEOUT_MS        = 120_000;  // 2 minutes — after this, stop counting

/**
 * @param {string|null} courseId   - Active course ID (heartbeat not sent if null)
 * @param {string}      tool       - 'flashcard' | 'quiz' | 'tutor' | 'reading' | 'inspace' | 'workspace'
 * @param {string|null} [docId]    - Optional document ID (for reading / workspace)
 */
export function useHeartbeat(courseId, tool, docId = null) {
  // Has a qualifying interaction happened since the last heartbeat tick?
  const hasInteractionRef = useRef(false);

  // Is the student currently active (not idle for 2+ minutes)?
  const isActiveRef = useRef(false);

  // Timer IDs
  const heartbeatTimerRef = useRef(null);
  const idleTimerRef      = useRef(null);

  // ── Reset idle timer whenever an interaction happens ──────────────────────
  const resetIdleTimer = useCallback(() => {
    isActiveRef.current = true;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      // Student has been idle for 2 minutes — stop counting
      isActiveRef.current   = false;
      hasInteractionRef.current = false;
    }, IDLE_TIMEOUT_MS);
  }, []);

  // ── Public API: call this on every qualifying interaction ─────────────────
  const recordInteraction = useCallback(() => {
    hasInteractionRef.current = true;
    resetIdleTimer();
  }, [resetIdleTimer]);

  // ── Heartbeat tick (runs every 30s) ───────────────────────────────────────
  const sendHeartbeat = useCallback(async () => {
    if (!courseId || !hasInteractionRef.current || !isActiveRef.current) return;

    // Reset flag for the next 30s window
    hasInteractionRef.current = false;

    try {
      await masteryService.v2.heartbeat(
        courseId,
        tool,
        30,          // 30 productive seconds
        docId,
      );
    } catch {
      // Silently swallow — heartbeat failure must never surface to the user
    }
  }, [courseId, tool, docId]);

  // ── Lifecycle: start / stop heartbeat interval ────────────────────────────
  useEffect(() => {
    if (!courseId) return;

    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatTimerRef.current);
      clearTimeout(idleTimerRef.current);
    };
  }, [courseId, sendHeartbeat]);

  return { recordInteraction };
}
