"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import PlayerScheduleClient from "@/app/(player)/player/schedule/schedule-client";
import type { PlayerIndividualSessionType } from "@/app/(player)/player/schedule/page";
import styles from "@/app/(player)/player/schedule/schedule.module.css";

interface ParentScheduleClientProps {
  parentId: string;
  players: { id: string; first_name: string | null; last_name: string | null }[];
  onFieldSessionTypes: string[];
  virtualGroupSessionTypes: string[];
  onFieldIndividualSessionTypes: PlayerIndividualSessionType[];
  virtualIndividualSessionTypes: PlayerIndividualSessionType[];
  coachNames: Record<string, string>;
  coachFullNames: Record<string, string>;
  sessionTypeColors: Record<string, string>;
  coachProfileDetails?: Record<string, { coachRole: string; profilePhotoUrl: string | null; teamLogos: string[] }>;
  onFieldProgramLogoUrl?: string | null;
}

export default function ParentScheduleClient({
  parentId,
  players,
  onFieldSessionTypes,
  virtualGroupSessionTypes,
  onFieldIndividualSessionTypes,
  virtualIndividualSessionTypes,
  coachNames,
  coachFullNames,
  sessionTypeColors,
  coachProfileDetails,
  onFieldProgramLogoUrl,
}: ParentScheduleClientProps) {
  const defaultPlayerId = players.length > 0 ? players[0].id : null;
  const playerCount = players.length;

  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedPlayerIdsForBooking, setSelectedPlayerIdsForBooking] = useState<Set<string>>(new Set());
  const [isIndividualBooking, setIsIndividualBooking] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState(players);
  const [isCancelMode, setIsCancelMode] = useState(false);
  const [cancelReservedPlayers, setCancelReservedPlayers] = useState<
    { playerId: string; playerName: string; reservationId: string }[]
  >([]);
  const resolveRef = useRef<((value: { playerIds: string[]; cancel: boolean }) => void) | null>(null);

  const allLinkedPlayers = useMemo(() => players, [players]);

  const handleBeforeBook = useCallback(
    async (_slot: unknown, excludePlayerIds?: string[]): Promise<{ playerIds: string[]; cancel: boolean }> => {
      const availablePlayers = excludePlayerIds
        ? players.filter((p) => !excludePlayerIds.includes(p.id))
        : players;

      if (availablePlayers.length === 0) {
        return { playerIds: [], cancel: true };
      }

      if (availablePlayers.length === 1) {
        return { playerIds: [availablePlayers[0].id], cancel: false };
      }

      const slot = _slot as { badge: string };
      const isIndividual = slot.badge !== "group";
      setIsIndividualBooking(isIndividual);
      setIsCancelMode(false);
      setFilteredPlayers(availablePlayers);
      setSelectedPlayerIdsForBooking(new Set([availablePlayers[0].id]));
      setShowPlayerModal(true);

      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [players]
  );

  const handleBeforeCancel = useCallback(
    async (
      _slot: unknown,
      reservedPlayers: { playerId: string; playerName: string; reservationId: string }[]
    ): Promise<{ playerIds: string[]; cancel: boolean }> => {
      if (reservedPlayers.length === 0) {
        return { playerIds: [], cancel: true };
      }
      if (reservedPlayers.length === 1) {
        return { playerIds: [reservedPlayers[0].playerId], cancel: false };
      }

      setIsCancelMode(true);
      setIsIndividualBooking(false);
      setCancelReservedPlayers(reservedPlayers);
      setSelectedPlayerIdsForBooking(new Set(reservedPlayers.map((r) => r.playerId)));
      setShowPlayerModal(true);

      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleModalConfirm = useCallback(() => {
    const ids = Array.from(selectedPlayerIdsForBooking);
    setShowPlayerModal(false);
    setIsCancelMode(false);
    setCancelReservedPlayers([]);
    setFilteredPlayers(players);
    resolveRef.current?.({ playerIds: ids, cancel: ids.length === 0 });
    resolveRef.current = null;
  }, [selectedPlayerIdsForBooking, players]);

  const handleModalCancel = useCallback(() => {
    setShowPlayerModal(false);
    setIsCancelMode(false);
    setCancelReservedPlayers([]);
    setFilteredPlayers(players);
    resolveRef.current?.({ playerIds: [], cancel: true });
    resolveRef.current = null;
  }, [players]);

  const togglePlayer = useCallback(
    (id: string) => {
      setSelectedPlayerIdsForBooking((prev) => {
        if (isIndividualBooking) {
          return new Set([id]);
        }
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [isIndividualBooking]
  );

  if (players.length === 0) {
    return (
      <div className={styles.scheduleContainer}>
        <h1 className={styles.pageTitle}>Schedule</h1>
        <p className={styles.emptyState}>
          No linked players found. Add a player from your Profile page to start booking sessions.
        </p>
      </div>
    );
  }

  const modalPlayerList = isCancelMode
    ? cancelReservedPlayers.map((r) => ({
        id: r.playerId,
        first_name: r.playerName.split(" ")[0] || r.playerName,
        last_name: r.playerName.split(" ").slice(1).join(" ") || null,
      }))
    : filteredPlayers;

  const modalTitle = isCancelMode
    ? "Cancel Reservation"
    : isIndividualBooking
      ? "Select Player"
      : "Select Player(s)";

  const modalDescription = isCancelMode
    ? "Choose which player(s) to cancel."
    : isIndividualBooking
      ? "Choose which player to book for this 1-on-1 session."
      : "Choose which player(s) to reserve for this group session.";

  const confirmLabel = isCancelMode
    ? "Cancel Reservation"
    : isIndividualBooking
      ? "Book Session"
      : "Reserve";

  const useCheckboxes = isCancelMode || !isIndividualBooking;

  return (
    <div className={styles.scheduleContainer}>
      <h1 className={styles.pageTitle}>Schedule</h1>

      {defaultPlayerId && (
        <PlayerScheduleClient
          playerId={defaultPlayerId}
          parentId={parentId}
          onFieldSessionTypes={onFieldSessionTypes}
          virtualGroupSessionTypes={virtualGroupSessionTypes}
          onFieldIndividualSessionTypes={onFieldIndividualSessionTypes}
          virtualIndividualSessionTypes={virtualIndividualSessionTypes}
          coachNames={coachNames}
          coachFullNames={coachFullNames}
          sessionTypeColors={sessionTypeColors}
          coachProfileDetails={coachProfileDetails}
          onFieldProgramLogoUrl={onFieldProgramLogoUrl}
          onBeforeBook={playerCount >= 2 ? handleBeforeBook : undefined}
          onBeforeCancel={playerCount >= 2 ? handleBeforeCancel : undefined}
          allLinkedPlayers={playerCount >= 2 ? allLinkedPlayers : undefined}
        />
      )}

      {showPlayerModal && (
        <div className={styles.modalOverlay} onClick={handleModalCancel}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{modalTitle}</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={handleModalCancel}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 16px" }}>
              {modalDescription}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {modalPlayerList.map((player) => {
                const name =
                  [player.first_name, player.last_name].filter(Boolean).join(" ") || "Player";
                const checked = selectedPlayerIdsForBooking.has(player.id);
                return (
                  <label
                    key={player.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      border: `1px solid ${checked ? (isCancelMode ? "#ef4444" : "var(--accent-solid)") : "var(--border)"}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      background: checked
                        ? isCancelMode
                          ? "color-mix(in srgb, #ef4444 6%, var(--background))"
                          : "color-mix(in srgb, var(--accent-solid) 6%, var(--background))"
                        : "var(--background)",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type={useCheckboxes ? "checkbox" : "radio"}
                      name="player-select"
                      checked={checked}
                      onChange={() => togglePlayer(player.id)}
                      style={{ width: 18, height: 18, accentColor: isCancelMode ? "#ef4444" : "var(--accent-solid)" }}
                    />
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{name}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleModalCancel}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                {isCancelMode ? "Keep All" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                disabled={selectedPlayerIdsForBooking.size === 0}
                style={{
                  padding: "10px 20px",
                  background: isCancelMode ? "#ef4444" : "var(--accent)",
                  border: "none",
                  borderRadius: 8,
                  color: isCancelMode ? "white" : "var(--accent-foreground)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  opacity: selectedPlayerIdsForBooking.size === 0 ? 0.5 : 1,
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
