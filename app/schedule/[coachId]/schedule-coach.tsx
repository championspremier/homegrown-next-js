"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { bookIndividualSession } from "@/app/actions/booking";
import type { LinkedPlayer } from "@/lib/db";
import styles from "../schedule.module.css";

interface SessionType {
  id: string;
  name: string;
  duration_minutes: number;
}

interface Slot {
  id: string;
  slot_date: string;
  slot_time: string;
}

interface ScheduleCoachProps {
  coachId: string;
  coachName: string;
  sessionTypes: SessionType[];
  parentId: string;
  playerId: string;
  linkedPlayers: LinkedPlayer[];
}

export default function ScheduleCoach({
  coachId,
  coachName,
  sessionTypes,
  parentId,
  playerId,
  linkedPlayers,
}: ScheduleCoachProps) {
  const router = useRouter();
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [booking, setBooking] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(playerId);

  useEffect(() => {
    if (!sessionTypeId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    fetch(`/api/schedule/slots?coachId=${coachId}&sessionTypeId=${sessionTypeId}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setSelectedSlot(null);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [coachId, sessionTypeId]);

  async function handleBook() {
    if (!selectedSlot || !sessionTypeId) return;
    setBooking("loading");
    setErrorMessage("");
    const result = await bookIndividualSession(
      coachId,
      selectedPlayerId,
      parentId,
      sessionTypeId,
      selectedSlot.date,
      selectedSlot.time
    );
    if (result.success) {
      setBooking("done");
      router.refresh();
    } else {
      setBooking("error");
      setErrorMessage(result.error);
    }
  }

  if (booking === "done") {
    return (
      <div className={styles.confirmBox}>
        <h2 className={styles.confirmTitle}>Booking confirmed</h2>
        <p className={styles.muted}>Your session with {coachName} is booked.</p>
        <a href="/dashboard/bookings" className={styles.confirmLink}>
          View bookings
        </a>
      </div>
    );
  }

  return (
    <div className={styles.formStack}>
      {linkedPlayers.length > 0 && (
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Book for
          </label>
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className={styles.formSelect}
          >
            {linkedPlayers.map(({ player_id, player }) => (
              <option key={player_id} value={player_id}>
                {player.full_name ?? player.email ?? player_id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Session type
        </label>
        <select
          value={sessionTypeId}
          onChange={(e) => setSessionTypeId(e.target.value)}
          className={styles.formSelect}
        >
          <option value="">Select type</option>
          {sessionTypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} ({st.duration_minutes} min)
            </option>
          ))}
        </select>
      </div>

      {sessionTypeId && (
        <div className={styles.formGroup}>
          <label className={styles.formLabelSpaced}>
            Available slots
          </label>
          {loadingSlots ? (
            <p className={styles.muted}>Loading…</p>
          ) : slots.length === 0 ? (
            <p className={styles.muted}>No available slots.</p>
          ) : (
            <ul className={styles.slotList}>
              {slots.map((slot) => {
                const key = `${slot.slot_date}-${slot.slot_time}`;
                const selected =
                  selectedSlot?.date === slot.slot_date && selectedSlot?.time === slot.slot_time;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSlot({ date: slot.slot_date, time: slot.slot_time })
                      }
                      className={selected ? styles.slotButtonSelected : styles.slotButton}
                    >
                      {slot.slot_date} {slot.slot_time}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {selectedSlot && (
        <div>
          <button
            type="button"
            onClick={handleBook}
            disabled={booking === "loading"}
            className={styles.formSubmit}
          >
            {booking === "loading" ? "Booking…" : "Book this slot"}
          </button>
        </div>
      )}

      {booking === "error" && errorMessage && (
        <p className={styles.formError}>{errorMessage}</p>
      )}
    </div>
  );
}
