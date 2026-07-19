import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SETTINGS_PATH =
  process.env.SETTINGS_JSON_PATH || path.join(ROOT, "config", "settings.json");

const DEFAULTS = Object.freeze({
  pollIntervalMs: 2000,
  defaultLlmPort: 8888,
  autoHideOffline: false,
});

/** @type {typeof DEFAULTS} */
let _settings = { ...DEFAULTS };

function _clampSettings(settings) {
  const s = { ...settings };
  // Clamp poll interval to 1000ms minimum
  if (typeof s.pollIntervalMs !== "number" || s.pollIntervalMs < 1000) {
    s.pollIntervalMs = 1000;
  }
  // Clamp LLM port to 1–65535
  if (typeof s.defaultLlmPort !== "number" || s.defaultLlmPort < 1 || s.defaultLlmPort > 65535) {
    s.defaultLlmPort = DEFAULTS.defaultLlmPort;
  }
  // Ensure autoHideOffline is boolean
  s.autoHideOffline = Boolean(s.autoHideOffline);
  return s;
}

/** Load settings from disk, falling back to defaults. */
export function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    _settings = _clampSettings({ ...DEFAULTS, ...parsed });
  } catch (err) {
    if (err.code === "ENOENT") {
      _settings = { ...DEFAULTS };
      saveSettings();
    } else {
      console.error("[settings] Failed to load settings.json:", err.message);
      _settings = { ...DEFAULTS };
    }
  }
  return { ..._settings };
}

/** Persist current settings to disk. */
export function saveSettings() {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(_settings, null, 2) + "\n", "utf-8");
  } catch (err) {
    console.error("[settings] Failed to save settings.json:", err.message);
  }
}

/** Get current settings (clamped). */
export function getSettings() {
  return { ..._settings };
}

/**
 * Apply a partial patch, persist, and return the new settings.
 * @param {Partial<typeof DEFAULTS>} patch
 * @returns {typeof DEFAULTS}
 */
export function updateSettings(patch) {
  const merged = _clampSettings({ ..._settings, ...patch });
  _settings = merged;
  saveSettings();
  return { ..._settings };
}
