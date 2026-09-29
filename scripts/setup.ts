/**
 * One-shot project setup, safe to re-run. Called by `bun run dev` (predev).
 *
 * 1. Links the Convex dev deployment (personal team) if `.env.local` is missing,
 *    then pushes functions once so `convex/_generated` exists.
 * 2. Ensures the Convex Auth env vars (JWT_PRIVATE_KEY, JWKS, SITE_URL) are set.
 *
 * Flags:
 *   --rotate-auth-keys   Regenerate JWT_PRIVATE_KEY/JWKS (signs out all sessions).
 */
import { generateKeyPairSync } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"

const CONVEX_TEAM = "ian-conover"
const CONVEX_PROJECT = "scoutapp"
const SITE_URL = "http://localhost:5173"

const rotateAuthKeys = process.argv.includes("--rotate-auth-keys")

function convex(args: string[], options: { quiet?: boolean } = {}) {
  const result = Bun.spawnSync([process.execPath, "x", "convex", ...args], {
    stdin: "inherit",
    stdout: options.quiet ? "pipe" : "inherit",
    stderr: options.quiet ? "pipe" : "inherit",
  })
  if (result.exitCode !== 0) {
    if (options.quiet && result.stderr) process.stderr.write(result.stderr)
    throw new Error(`convex ${args[0]} ${args[1] ?? ""} failed (exit ${result.exitCode})`)
  }
  return result.stdout?.toString() ?? ""
}

function isDeploymentConfigured() {
  return (
    existsSync(".env.local") &&
    /^CONVEX_DEPLOYMENT=/m.test(readFileSync(".env.local", "utf8"))
  )
}

function envVarNames() {
  const output = convex(["env", "list"], { quiet: true })
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.split("=", 1)[0]?.trim())
      .filter((name): name is string => Boolean(name)),
  )
}

function generateAuthKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  const jwk = publicKey.export({ format: "jwk" })
  return {
    JWT_PRIVATE_KEY: pem.trimEnd().replace(/\n/g, " "),
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...jwk }] }),
  }
}

function setEnvVar(name: string, value: string) {
  convex(["env", "set", "--", name, value], { quiet: true })
  console.log(`✔ Set ${name} on Convex deployment`)
}

// 1. Link + push Convex.
if (isDeploymentConfigured()) {
  convex(["dev", "--once"])
} else {
  console.log(`Linking Convex project ${CONVEX_TEAM}/${CONVEX_PROJECT}...`)
  convex([
    "dev",
    "--once",
    "--configure",
    "existing",
    "--team",
    CONVEX_TEAM,
    "--project",
    CONVEX_PROJECT,
    "--dev-deployment",
    "cloud",
  ])
}

// 2. Convex Auth env vars.
const existing = envVarNames()
if (rotateAuthKeys || !existing.has("JWT_PRIVATE_KEY") || !existing.has("JWKS")) {
  const keys = generateAuthKeys()
  setEnvVar("JWT_PRIVATE_KEY", keys.JWT_PRIVATE_KEY)
  setEnvVar("JWKS", keys.JWKS)
}
if (!existing.has("SITE_URL")) setEnvVar("SITE_URL", SITE_URL)

console.log("✔ Setup complete")
