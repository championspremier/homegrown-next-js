"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { sendProgramOffer } from "@/app/actions/offer-spot";
import styles from "./users.module.css";

const DOCSEND_VIDEO_URL = "https://docsend.com/view/p5taz9wn9zbtn3qf";
const DOCSEND_DOC_URL = "https://docsend.com/view/5kwang35vqyadijn";

const MESSAGE_TEMPLATES = [
  {
    id: "standard",
    label: "Standard Offer",
    text: "We'd love to have you join Champions Premier. Please review our program information and reach out to accept your spot.",
  },
  {
    id: "trial",
    label: "Trial Offer",
    text: "We're offering you a trial spot in Champions Premier. Take a look at what we offer and let us know if you're interested.",
  },
  {
    id: "custom",
    label: "Custom",
    text: "",
  },
] as const;

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface OfferSpotModalProps {
  player: Profile;
  programId: string;
  programName: string;
  parentIds: string[];
  adminId: string;
  onClose: () => void;
  onSuccess: (playerName: string) => void;
}

function getDisplayName(p: Profile): string {
  if (p.first_name || p.last_name) return `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return p.full_name || p.email || "—";
}

export function OfferSpotModal({
  player,
  programId,
  programName,
  parentIds,
  adminId,
  onClose,
  onSuccess,
}: OfferSpotModalProps) {
  const [templateId, setTemplateId] = useState<"standard" | "trial" | "custom">("standard");
  const [customMessage, setCustomMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [sending, setSending] = useState(false);

  const selectedTemplate = MESSAGE_TEMPLATES.find((t) => t.id === templateId)!;
  const messagePreview =
    templateId === "custom" ? customMessage : selectedTemplate.text;

  async function handleSendOffer() {
    setSending(true);
    const personalMessage =
      templateId === "custom" ? customMessage.trim() || null : selectedTemplate.text;
    const result = await sendProgramOffer({
      playerId: player.id,
      programId,
      offeredBy: adminId,
      personalMessage,
      expiresAt,
      programName,
      parentIds,
    });
    setSending(false);
    if (result.ok) {
      onSuccess(getDisplayName(player));
      onClose();
    } else {
      alert(result.error || "Failed to send offer");
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Offer Spot — {getDisplayName(player)}</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalSection}>
          <div className={styles.formField}>
            <span className={styles.formLabel}>Program Information</span>
            <div className={styles.docsendLinks}>
              <a
                href={DOCSEND_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.docsendBtn}
              >
                ▶ Watch Video
              </a>
              <a
                href={DOCSEND_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.docsendBtn}
              >
                📄 Read DocSend
              </a>
            </div>
            <p className={styles.docsendNote}>Password: Champion</p>
          </div>

          <div className={styles.formField}>
            <span className={styles.formLabel}>Select a template</span>
            <div className={styles.templateSelector}>
              {MESSAGE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.templatePill} ${templateId === t.id ? styles.templatePillActive : ""}`}
                  onClick={() => setTemplateId(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {templateId === "custom" ? (
              <textarea
                className={styles.formInput}
                rows={4}
                placeholder="Enter your custom message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
            ) : (
              <div className={styles.messagePreview}>{messagePreview}</div>
            )}
          </div>

          <div className={styles.formField}>
            <span className={styles.formLabel}>Offer expires on</span>
            <input
              type="date"
              className={styles.formInput}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className={styles.offerInfoBanner}>
            An offer email will be sent to {player.email || "the player"} when Resend is configured. For now the offer
            will be recorded and the player will receive an in-app notification with the DocSend links.
          </div>

          <div className={styles.sectionActions}>
            <button
              className={styles.gradientBtn}
              onClick={handleSendOffer}
              disabled={sending}
              type="button"
            >
              {sending ? "Sending..." : "Send Offer"}
            </button>
            <button className={styles.deactivateBtn} onClick={onClose} type="button" style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
