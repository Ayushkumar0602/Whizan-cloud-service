import { AlertCircle, CheckCircle2, Clock, Loader2, PauseCircle, XCircle } from "lucide-react";

const CONFIG: Record<
  string,
  { cls: string; label: string; Icon: typeof CheckCircle2 }
> = {
  READY: { cls: "badge-ready", label: "Live", Icon: CheckCircle2 },
  BUILDING: { cls: "badge-building", label: "Building", Icon: Loader2 },
  QUEUED: { cls: "badge-queued", label: "Queued", Icon: Clock },
  FAILED: { cls: "badge-failed", label: "Failed", Icon: XCircle },
  CANCELLED: { cls: "badge-failed", label: "Cancelled", Icon: AlertCircle },
  PAUSED: { cls: "badge-paused", label: "Paused", Icon: PauseCircle },
};

export function StatusBadge({ status }: { status: string }) {
  const c = CONFIG[status] || CONFIG.QUEUED;
  const spinning = status === "BUILDING";
  return (
    <span className={`badge ${c.cls}`}>
      <c.Icon size={12} className={spinning ? "spin-icon" : undefined} />
      {c.label}
    </span>
  );
}
