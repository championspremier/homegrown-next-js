import { switchActiveProfileAction } from "@/app/actions/account";
import type { LinkedProfile } from "@/app/actions/account";
import styles from "./layout/layout.module.css";

interface AccountSwitcherProps {
  activeProfile: LinkedProfile;
  self: LinkedProfile;
  linked?: LinkedProfile[];
}

export function AccountSwitcher({ activeProfile, self, linked = [] }: AccountSwitcherProps) {
  const currentActiveId = activeProfile?.id ?? self?.id ?? "";
  const linkedSafe = Array.isArray(linked) ? linked : [];
  const actingLabel = activeProfile?.full_name ?? activeProfile?.email ?? activeProfile?.id ?? "—";

  return (
    <div className={styles.accountSwitcher}>
      <span className={styles.accountSwitcherLabel}>
        Acting as: {actingLabel} ({activeProfile?.role ?? "—"})
      </span>
      <form action={switchActiveProfileAction}>
        <select
          name="profileId"
          defaultValue={currentActiveId}
          className={styles.accountSwitcherSelect}
          aria-label="Choose account to switch to"
        >
          <option value={self?.id}>
            My account ({self?.full_name ?? self?.email ?? self?.id ?? "—"})
          </option>
          {linkedSafe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email ?? p.id} ({p.role})
            </option>
          ))}
        </select>
        <button type="submit" className={styles.accountSwitcherButton}>
          Switch
        </button>
      </form>
    </div>
  );
}
