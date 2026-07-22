import { useState, useEffect, useCallback } from "react";

// Progressive cooldown steps in seconds: 30s, 60s (1 min), 120s (2 min), 300s (5 min)
const COOLDOWN_STEPS = [30, 60, 120, 300];

interface CooldownEntry {
  count: number;
  expiresAt: number;
}

export interface InviteStatus {
  canInvite: boolean;
  remainingSeconds: number;
  label: string;
  count: number;
}

/**
 * Hook to manage progressive invite cooldowns (30s -> 60s -> 120s...).
 * Cooldowns automatically reset when switching lobbies (when lobbyId changes).
 */
export function useInviteCooldown(lobbyId: string | null | undefined) {
  const [cooldowns, setCooldowns] = useState<Record<string, CooldownEntry>>({});
  const [prevLobbyId, setPrevLobbyId] = useState<string | null | undefined>(lobbyId);
  const [, setTick] = useState(0);

  // Reset all cooldowns when switching or leaving lobbies
  if (prevLobbyId !== lobbyId) {
    setPrevLobbyId(lobbyId);
    setCooldowns({});
  }

  // Countdown timer ticker
  useEffect(() => {
    const hasActiveCooldowns = Object.values(cooldowns).some(
      (c) => c.expiresAt > Date.now()
    );
    if (!hasActiveCooldowns) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldowns]);

  // Trigger invite cooldown for a user
  const triggerInvite = useCallback((targetUserId: string) => {
    setCooldowns((prev) => {
      const currentEntry = prev[targetUserId];
      const currentCount = currentEntry?.count || 0;
      const stepIndex = Math.min(currentCount, COOLDOWN_STEPS.length - 1);
      const cooldownSeconds = COOLDOWN_STEPS[stepIndex];
      const expiresAt = Date.now() + cooldownSeconds * 1000;

      return {
        ...prev,
        [targetUserId]: {
          count: currentCount + 1,
          expiresAt,
        },
      };
    });
  }, []);

  // Check status for a target user
  const getInviteStatus = useCallback(
    (targetUserId: string): InviteStatus => {
      const entry = cooldowns[targetUserId];
      if (!entry) {
        return { canInvite: true, remainingSeconds: 0, label: "Invite", count: 0 };
      }

      const remainingMs = entry.expiresAt - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      const canInvite = remainingSeconds <= 0;

      let label = "Invite";
      if (!canInvite) {
        label = `${remainingSeconds}s`;
      } else if (entry.count > 0) {
        label = "Re-invite";
      }

      return {
        canInvite,
        remainingSeconds,
        label,
        count: entry.count,
      };
    },
    [cooldowns]
  );

  return {
    triggerInvite,
    getInviteStatus,
  };
}
