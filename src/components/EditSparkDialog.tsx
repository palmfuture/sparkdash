import { useEffect, useState } from "react";
import {
  deleteSpark,
  fetchSparks,
  setSparkPassword,
  testSpark,
  testSparkConfig,
  updateSpark,
} from "../api/client";
import type { SparkConfig } from "../api/types";

interface EditSparkDialogProps {
  open: boolean;
  sparkId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: (id: string) => void;
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
}

export function EditSparkDialog({ open, sparkId, onClose, onSaved }: EditSparkDialogProps) {
  const [config, setConfig] = useState<SparkConfig | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPasswordNote, setSavedPasswordNote] = useState<string | null>(null);

  useEscape(onClose);

  useEffect(() => {
    if (!open || !sparkId) {
      setConfig(null);
      setPassword("");
      setTestResult(null);
      setError(null);
      setSavedPasswordNote(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSparks()
      .then((res) => {
        if (cancelled) return;
        const found = res.sparks.find((s) => s.id === sparkId) || null;
        setConfig(found);
        if (!found) setError("Spark not found");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sparkId]);

  if (!open) return null;

  const update = (patch: Partial<SparkConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateSsh = (patch: Partial<SparkConfig["ssh"]>) => {
    setConfig((prev) => (prev ? { ...prev, ssh: { ...prev.ssh, ...patch } } : prev));
  };

  const needsPassword =
    config?.ssh.auth === "pass" && !config.ssh.hasPassword && !password;

  /** Persist password immediately (host can be offline). */
  const persistPasswordIfEntered = async () => {
    if (!config || !password) return false;
    await setSparkPassword(config.id, password);
    setConfig((prev) =>
      prev
        ? { ...prev, ssh: { ...prev.ssh, hasPassword: true } }
        : prev
    );
    setSavedPasswordNote("Password saved encrypted (works even while host is offline).");
    setPassword(""); // clear field — keep as stored secret
    return true;
  };

  const handleTest = async () => {
    if (!config) return;
    if (config.ssh.auth === "pass" && !config.ssh.hasPassword && !password) {
      setTestResult({
        ok: false,
        message: "Enter the SSH password first — it will be saved even if the host is down.",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // Always store password before testing so a failed SSH still keeps the secret
      if (password) {
        await setSparkPassword(config.id, password);
        setConfig((prev) =>
          prev ? { ...prev, ssh: { ...prev.ssh, hasPassword: true } } : prev
        );
        setSavedPasswordNote("Password saved.");
      }

      // Prefer registered test (uses stored password); fall back to ephemeral
      const result = password
        ? await testSparkConfig({
            ...config,
            ssh: {
              ...config.ssh,
              host: config.ssh.host || config.lanIp,
              password,
            },
          })
        : await testSpark(config.id);

      const parts: string[] = [];
      if (result.ssh.ok) parts.push("SSH ✓");
      else parts.push(`SSH ✗ ${result.ssh.message}`);
      if (result.llm.ok) parts.push("LLM ✓");
      else parts.push(`LLM ✗ ${result.llm.message}`);
      setTestResult({
        ok: result.ok,
        message: result.ok
          ? "Connection successful"
          : `${parts.join(" | ")} — password is still saved for when the host is back.`,
      });
      if (password) setPassword("");
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    if (config.ssh.auth === "pass" && !config.ssh.hasPassword && !password) {
      setError("Password required for password-auth Sparks (saved encrypted, host can be offline).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Save password first so it is never lost if the rest of the update fails
      if (password) {
        await persistPasswordIfEntered();
      }

      const patch: Partial<SparkConfig> = {
        name: config.name,
        lanIp: config.lanIp,
        cx7Ip: config.cx7Ip,
        isLocal: config.isLocal,
        ssh: {
          host: config.ssh.host || config.lanIp,
          user: config.ssh.user,
          auth: config.ssh.auth,
        },
      };
      await updateSpark(config.id, patch);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    if (!confirm(`Remove Spark "${config.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSpark(config.id);
      onDeleted?.(config.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-md p-6">
        <h2 className="mb-4 text-sm font-semibold text-text-strong">Edit Spark</h2>

        {loading && <p className="text-xs text-muted">Loading…</p>}

        {config && !loading && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => update({ name: e.target.value })}
                className="w-full rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">LAN IP</label>
              <input
                type="text"
                value={config.lanIp}
                onChange={(e) => update({ lanIp: e.target.value })}
                className="w-full rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">CX7 IP (optional)</label>
              <input
                type="text"
                value={config.cx7Ip || ""}
                onChange={(e) => update({ cx7Ip: e.target.value || null })}
                className="w-full rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={config.isLocal}
                onChange={(e) => update({ isLocal: e.target.checked })}
                className="rounded border-border"
              />
              This host (local collectors — no SSH for metrics)
            </label>

            {!config.isLocal && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted">SSH User</label>
                  <input
                    type="text"
                    value={config.ssh.user}
                    onChange={(e) => updateSsh({ user: e.target.value })}
                    className="w-full rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted">SSH Auth</label>
                  <select
                    value={config.ssh.auth}
                    onChange={(e) => updateSsh({ auth: e.target.value as "key" | "pass" })}
                    className="w-full rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
                  >
                    <option value="key">Key</option>
                    <option value="pass">Password</option>
                  </select>
                </div>

                {config.ssh.auth === "pass" && (
                  <div>
                    <label className="mb-1 block text-xs text-muted">
                      SSH Password
                      {config.ssh.hasPassword
                        ? " (leave blank to keep stored secret)"
                        : " (required — saved even if host is offline)"}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
                      autoComplete="new-password"
                      placeholder={config.ssh.hasPassword ? "••••••••" : "Enter password"}
                    />
                    {config.ssh.hasPassword ? (
                      <p className="mt-1 text-[10px] text-muted">
                        Password is stored encrypted on this server. Offline Sparks still keep it
                        and reconnect automatically when back up.
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-warning">
                        Enter once and Save (or Test). Stored encrypted — host does not need to be
                        online.
                      </p>
                    )}
                    {savedPasswordNote && (
                      <p className="mt-1 text-[10px] text-success">{savedPasswordNote}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {testResult && (
          <div
            className={`mt-3 rounded px-3 py-2 text-xs ${
              testResult.ok ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
            }`}
          >
            {testResult.message}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded bg-danger/20 px-3 py-2 text-xs text-danger">{error}</div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || loading || !config}
            className="rounded border border-danger/40 bg-surface-elevated px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {saving ? "Removing…" : "Remove"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || loading || !config?.lanIp || needsPassword}
              className="rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted hover:bg-surface-hover disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !config?.name || !config?.lanIp || needsPassword}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
