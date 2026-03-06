"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useState } from "react";
import PlansModal from "./PlansModal";
import styles from "./PlanGate.module.css";

interface PlanGateProps {
  locked: boolean;
  reason: string;
  planName?: string | null;
  hasPlan?: boolean;
  children?: React.ReactNode;
  /** When true, renders only the overlay (no children to blur). Use for modal-style gate. */
  asModal?: boolean;
  /** When provided, shows "Close" instead of "Go Back" and calls this instead of router.back() */
  onClose?: () => void;
}

export function PlanGate({ locked, reason, planName, hasPlan = false, children, asModal, onClose }: PlanGateProps) {
  const router = useRouter();
  const [plansModalOpen, setPlansModalOpen] = useState(false);

  if (!locked) return <>{children}</>;

  const title = hasPlan ? "Upgrade your plan" : "This feature requires a plan";
  const subtitle = hasPlan
    ? `Your ${planName || "current"} plan doesn't include this feature. Upgrade to unlock it.`
    : reason;
  const primaryBtn = hasPlan ? "View Upgrade Options" : "View Plans";

  return (
    <div className={`${styles.wrapper} ${asModal ? styles.wrapperModal : ""}`}>
      {!asModal && <div className={styles.blurredContent}>{children}</div>}
      <div className={styles.backdrop} />
      <div className={styles.overlayCard}>
        <Lock size={32} className={styles.lockIcon} />
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.gradientBtn}
            onClick={() => setPlansModalOpen(true)}
          >
            {primaryBtn}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => (onClose ? onClose() : router.back())}
          >
            {onClose ? "Close" : "← Go Back"}
          </button>
        </div>
      </div>
      {plansModalOpen && (
        <PlansModal
          onClose={() => setPlansModalOpen(false)}
          currentPlanName={planName}
        />
      )}
    </div>
  );
}
