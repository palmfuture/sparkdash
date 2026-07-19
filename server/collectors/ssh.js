/**
 * sshExec — centralized SSH command execution.
 * Supports both key-based and password-based (sshpass) authentication.
 *
 * Uses execFile + argv arrays (no shell interpolation of user/host/cmd).
 * Password auth uses sshpass -e (password via env), not -p on the command line.
 */
import { execFile } from "child_process";
import { execSync } from "child_process";
import { SSH_CONNECT_TIMEOUT } from "../config.js";
import { isAllowedTargetHost, isValidSshUser } from "../validate.js";

// Check if sshpass is available
let _sshpassAvailable = null;
function sshpassAvailable() {
  if (_sshpassAvailable !== null) return _sshpassAvailable;
  try {
    execSync("which sshpass", { stdio: "ignore" });
    _sshpassAvailable = true;
  } catch {
    _sshpassAvailable = false;
  }
  return _sshpassAvailable;
}

/**
 * Execute a command on a remote Spark via SSH.
 *
 * @param {Object} spark - Spark config object
 * @param {string} cmd - Command to execute (passed as a single remote argv via bash -c)
 * @returns {Promise<string>} - Trimmed stdout
 */
export async function sshExec(spark, cmd) {
  const { host, user, auth, password } = spark.ssh || {};
  const targetHost = host || spark.lanIp;

  if (!targetHost || !user) {
    throw new Error(`SSH config missing for ${spark.id}: host=${targetHost}, user=${user}`);
  }

  if (!isAllowedTargetHost(targetHost)) {
    throw new Error(`SSH host not allowed: ${targetHost}`);
  }
  if (!isValidSshUser(user)) {
    throw new Error(`SSH user not allowed: ${user}`);
  }

  if (typeof cmd !== "string" || !cmd) {
    throw new Error("SSH command must be a non-empty string");
  }

  // Base SSH options (no shell metacharacters in argv)
  // accept-new: trust first-seen host key (LAN ops); pin known_hosts for stricter envs
  const baseOpts = [
    "-o",
    `ConnectTimeout=${SSH_CONNECT_TIMEOUT}`,
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];

  const remote = `${user}@${targetHost}`;
  // Remote command as a single argument — ssh does not invoke a local shell for it
  // when using execFile without a shell. `--` stops option parsing before destination.
  let file;
  let args;
  let env = { ...process.env };

  if (auth === "pass") {
    if (!password) {
      throw new Error(
        `SSH password auth selected for ${spark.id} but no password is set (Edit Spark once — passwords are stored encrypted and survive restarts)`
      );
    }
    if (!sshpassAvailable()) {
      throw new Error(`sshpass is not installed. Install it with: sudo apt-get install sshpass`);
    }
    // Password via env (sshpass -e) — never on argv or in process list as -p
    env = { ...env, SSHPASS: password };
    file = "sshpass";
    args = ["-e", "ssh", ...baseOpts, "--", remote, cmd];
  } else {
    // Key-based SSH (default) — BatchMode prevents hanging on missing keys
    file = "ssh";
    args = [...baseOpts, "-o", "BatchMode=yes", "--", remote, cmd];
  }

  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 10000, env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || err.message;
        reject(new Error(`SSH to ${targetHost} failed: ${msg}`));
      } else {
        resolve(String(stdout).trim());
      }
    });
  });
}

/**
 * Test SSH connectivity to a Spark.
 * Returns { ok: boolean, message: string }
 */
export async function sshTest(spark) {
  try {
    const result = await sshExec(spark, "echo ok");
    return { ok: result === "ok", message: result };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Test LLM server connectivity.
 * Returns { ok: boolean, message: string }
 */
export async function llmTest(spark, port = 8888) {
  try {
    const host = spark.lanIp;
    if (!isAllowedTargetHost(host)) {
      return { ok: false, message: `Invalid or disallowed lanIp: ${host}` };
    }
    const url = `http://${host}:${port}/v1/models`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return { ok: res.ok, message: `Model: ${data?.data?.[0]?.id || "unknown"}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
