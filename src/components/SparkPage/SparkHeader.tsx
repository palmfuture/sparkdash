import type { SparkSnapshot } from "../../api/types";
import { EditIcon } from "../ui/icons";

interface SparkHeaderProps {
  spark: SparkSnapshot;
  onEdit?: () => void;
}

export function SparkHeader({ spark, onEdit }: SparkHeaderProps) {
  const { hardware } = spark;
  const online = spark.online;

  return (
    <div className="spark-header panel flex flex-wrap items-center gap-x-4 gap-y-2 p-5" style={online ? undefined : { opacity: 0.6 }}>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-success dot-glow-success" : "bg-danger"}`}
        title={online ? "Online" : "Offline"}
      />
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-text-strong">{spark.name}</h2>
        <p className="truncate text-xs text-muted">
          {hardware.device} · {hardware.gpuChip}
        </p>
      </div>

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-[11px] text-muted hover:bg-surface-hover hover:text-text transition-colors"
        >
          <EditIcon className="h-3 w-3" />
          Edit
        </button>
      )}
    </div>
  );
}