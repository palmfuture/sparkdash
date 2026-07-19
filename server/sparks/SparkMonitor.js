import { SystemCollector } from "../collectors/SystemCollector.js";
import { LlmProbe } from "../collectors/LlmProbe.js";
import { sshTest } from "../collectors/ssh.js";
import {
  POLL_INTERVAL_GPU,
  POLL_INTERVAL_CPU,
  POLL_INTERVAL_NETWORK,
  POLL_INTERVAL_STORAGE,
  POLL_INTERVAL_LLM,
  POLL_INTERVAL_BANDWIDTH,
  LLM_PORT,
} from "../config.js";

const ONLINE_GRACE_MS = 10000;

/**
 * SparkMonitor — one per Spark. Owns collectors + rate state + poll loop.
 * Exposes snapshot() for WebSocket pushed payload.
 */
export class SparkMonitor {
  constructor(spark) {
    this.spark = spark;
    this.collector = new SystemCollector(spark);
    this.llmProbe = new LlmProbe(spark, this._llmPort());

    // Online status from dedicated liveness checks (not metric poll success)
    this.online = false;
    this.lastOnlineOk = 0;

    // Cached metrics per domain — never null objects for UI safety
    this._metrics = {
      gpu: this.collector._defaultGpu(),
      cpu: this.collector._defaultCpu(),
      ram: this.collector._defaultRam(),
      storage: [],
      network: this.collector._defaultNetwork(),
      unifiedMemory: this.collector._defaultUnifiedMemory(),
      llm: this.llmProbe._defaultLlm(),
    };
    this._lastUpdate = {};

    // Timers
    this._intervals = [];
    this._running = false;
    /** @type {Record<string, boolean>} in-flight domain guards */
    this._inflight = {};
  }

  /** Hot-update config without tearing down poll loops / rate baselines. */
  updateConfig(spark) {
    this.spark = spark;
    this.collector.spark = spark;
    this.llmProbe.spark = spark;
    this.llmProbe.setPort(this._llmPort());
  }

  _llmPort() {
    const n = Number(this.spark?.llmPort);
    if (Number.isInteger(n) && n >= 1 && n <= 65535) return n;
    return LLM_PORT;
  }

  /** Start background polling. */
  start() {
    if (this._running) return;
    this._running = true;
    this._poll();
    this._intervals.push(setInterval(() => this._pollDomain("gpu"), POLL_INTERVAL_GPU));
    this._intervals.push(setInterval(() => this._pollDomain("cpu"), POLL_INTERVAL_CPU));
    this._intervals.push(setInterval(() => this._pollDomain("network"), POLL_INTERVAL_NETWORK));
    this._intervals.push(setInterval(() => this._pollDomain("storage"), POLL_INTERVAL_STORAGE));
    this._intervals.push(setInterval(() => this._pollDomain("ram"), POLL_INTERVAL_CPU));
    this._intervals.push(setInterval(() => this._pollDomain("memory"), POLL_INTERVAL_BANDWIDTH));
    this._intervals.push(setInterval(() => this._pollDomain("llm"), POLL_INTERVAL_LLM));
    // Liveness on a slightly slower cadence
    this._intervals.push(setInterval(() => this._checkOnline(), 5000));
    console.log(`[SparkMonitor] ${this.spark.id} started`);
  }

  /** Stop background polling. */
  stop() {
    this._running = false;
    for (const id of this._intervals) clearInterval(id);
    this._intervals = [];
    this._inflight = {};
    console.log(`[SparkMonitor] ${this.spark.id} stopped`);
  }

  /** Return a full snapshot of this Spark's metrics. */
  snapshot() {
    return {
      id: this.spark.id,
      name: this.spark.name,
      online: this.online,
      disabledDevices: this.spark.disabledDevices || [],
      disabledInterfaces: this.spark.disabledInterfaces || [],
      storagePollDisabled: Boolean(this.spark.storagePollDisabled),
      llmPort: this._llmPort(),
      hardware: this._getHardwareSummary(),
      metrics: {
        timestamp: Date.now(),
        gpu: this._metrics.gpu,
        cpu: this._metrics.cpu,
        ram: this._metrics.ram,
        storage: this._metrics.storage,
        network: this._metrics.network,
        unifiedMemory: this._metrics.unifiedMemory,
        llm: this._metrics.llm,
      },
    };
  }

  // ─── Liveness ─────────────────────────────────────────────
  async _checkOnline() {
    if (!this._running || this._inflight.online) return;
    this._inflight.online = true;
    try {
      if (this.spark.isLocal) {
        await this.collector.pingHost();
      } else {
        const result = await sshTest(this.spark);
        if (!result.ok) throw new Error(result.message);
      }
      if (!this._running) return;
      this.online = true;
      this.lastOnlineOk = Date.now();
    } catch {
      if (!this.lastOnlineOk || Date.now() - this.lastOnlineOk > ONLINE_GRACE_MS) {
        this.online = false;
      }
    } finally {
      this._inflight.online = false;
    }
  }

  // ─── Polling ──────────────────────────────────────────────
  async _poll() {
    if (!this._running) return;
    await Promise.all([
      this._checkOnline(),
      this._pollDomain("gpu"),
      this._pollDomain("cpu"),
      this._pollDomain("network"),
      this._pollDomain("storage"),
      this._pollDomain("ram"),
      this._pollDomain("memory"),
      this._pollDomain("llm"),
    ]);
  }

  async _pollDomain(domain) {
    if (!this._running || this._inflight[domain]) return;
    // Skip storage auto-poll when disabled for this spark
    if (domain === "storage" && this.spark.storagePollDisabled) return;
    this._inflight[domain] = true;
    try {
      switch (domain) {
        case "gpu":
          this._metrics.gpu = await this.collector.collectGpu();
          break;
        case "cpu":
          this._metrics.cpu = await this.collector.collectCpu();
          break;
        case "ram":
          this._metrics.ram = await this.collector.collectRam();
          break;
        case "network":
          this._metrics.network = await this.collector.collectNetwork();
          break;
        case "storage":
          this._metrics.storage = await this.collector.collectStorage();
          break;
        case "memory":
          this._metrics.unifiedMemory = await this.collector.collectUnifiedMemory();
          break;
        case "llm":
          this._metrics.llm = await this.llmProbe.probe();
          break;
      }
      if (this._running) this._lastUpdate[domain] = Date.now();
    } catch (err) {
      console.error(`[SparkMonitor] ${this.spark.id} ${domain} poll error:`, err.message);
    } finally {
      this._inflight[domain] = false;
    }
  }

  /** Manually refresh a single domain, bypassing auto-poll guards. */
  async refreshDomain(domain) {
    if (this._inflight[domain]) return;
    this._inflight[domain] = true;
    try {
      switch (domain) {
        case "storage":
          this._metrics.storage = await this.collector.collectStorage();
          break;
        default:
          // Fall back to _pollDomain for other domains
          this._inflight[domain] = false;
          return this._pollDomain(domain);
      }
      if (this._running) this._lastUpdate[domain] = Date.now();
    } catch (err) {
      console.error(`[SparkMonitor] ${this.spark.id} ${domain} refresh error:`, err.message);
    } finally {
      this._inflight[domain] = false;
    }
  }

  // ─── Hardware summary (cached, computed once) ─────────────
  _getHardwareSummary() {
    return {
      device: "NVIDIA DGX Spark",
      cpuModel: "GB10",
      cpuCores: 20,
      totalMemoryGB: 128,
      gpuChip: "GB10",
      cudaDriver: null,
      storageModel: null,
    };
  }
}
