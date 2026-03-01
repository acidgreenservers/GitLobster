const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const nacl = require("tweetnacl");
const { encodeBase64 } = require("tweetnacl-util");

// Override GIT_PROJECT_ROOT for testing
const TEST_ROOT = path.join(__dirname, "../storage/test-merge-env");
if (fs.existsSync(TEST_ROOT))
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
fs.mkdirSync(TEST_ROOT, { recursive: true });

process.env.GIT_PROJECT_ROOT = TEST_ROOT;
process.env.GITLOBSTER_STORAGE_DIR = TEST_ROOT; // Just in case

// Import Worker (after setting env)
// Note: We need to point to the correct path relative to script execution (root)
const {
  processMergeProposal,
} = require("../registry-server/src/workers/merge-worker");

// --- Helpers ---
function createAgent(name) {
  const keyPair = nacl.sign.keyPair();
  return {
    name,
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
}

function sign(proposalId, verdict, agent) {
  const message = `${proposalId}:${verdict}`;
  const sig = nacl.sign.detached(Buffer.from(message), agent.secretKey);
  return {
    agent_id: agent.publicKey,
    role: "REVIEWER",
    verdict: verdict,
    signature: encodeBase64(sig),
  };
}

// --- Setup Repo ---
const repoName = "automerge-test.git";
const repoPath = path.join(TEST_ROOT, repoName);

console.log("--- Setting up Test Repo ---");
// Create bare repo
execFileSync("git", ["init", "--bare", repoName], { cwd: TEST_ROOT });

// Clone to create content
const clonePath = path.join(TEST_ROOT, "client-clone");
execFileSync("git", ["clone", repoPath, clonePath]);

// Create Main (Base)
const baseManifest = {
  permissions: { network: { outbound: ["google.com"] } },
  version: "1.0.0",
};
fs.writeFileSync(
  path.join(clonePath, "manifest.json"),
  JSON.stringify(baseManifest),
);
execFileSync("git", ["add", "."], { cwd: clonePath });
execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: clonePath });
execFileSync("git", ["push", "origin", "master"], { cwd: clonePath }); // using master as default often

// Create Feature (Head)
execFileSync("git", ["checkout", "-b", "feature/add-openai"], {
  cwd: clonePath,
});
const headManifest = {
  permissions: { network: { outbound: ["google.com", "openai.com"] } },
  version: "1.1.0",
};
fs.writeFileSync(
  path.join(clonePath, "manifest.json"),
  JSON.stringify(headManifest),
);
execFileSync("git", ["add", "."], { cwd: clonePath });
execFileSync("git", ["commit", "-m", "Add OpenAI"], { cwd: clonePath });
execFileSync("git", ["push", "origin", "feature/add-openai"], {
  cwd: clonePath,
});

// --- Prepare Proposal ---
const alice = createAgent("Alice");
const bob = createAgent("Bob");
const charlie = createAgent("Charlie");

// This is a HIGH risk change (network added), so we need 3 signatures
const proposal = {
  id: "prop-test-1",
  target: {
    package: "@test/pkg",
    base_ref: "refs/heads/master",
    head_ref: "refs/heads/feature/add-openai",
  },
  endorsements: [
    sign("prop-test-1", "APPROVE", alice),
    sign("prop-test-1", "APPROVE", bob),
    sign("prop-test-1", "APPROVE", charlie),
  ],
};

// --- Run Test ---
console.log("\n--- Running Auto-Merge Worker ---");

(async () => {
  try {
    const result = await processMergeProposal(repoName, proposal);

    console.log("\nResult:", result);

    if (result.status === "MERGED") {
      console.log("✅ Merge Successful!");

      // Verify commit graph
      execFileSync("git", ["pull", "origin", "master"], { cwd: clonePath });
      const log = execFileSync("git", ["log", "--oneline", "-n", "1"], {
        cwd: clonePath,
      }).toString();
      console.log("HEAD Log:", log.trim());

      if (log.includes(`Merge Proposal ${proposal.id}`)) {
        console.log("✅ Merge Commit Verified");
      } else {
        console.log("❌ Merge Commit NOT found");
      }
    } else {
      console.log("❌ Merge Failed:", result.reason);
    }
  } catch (e) {
    console.error("Test Failed:", e);
  } finally {
    // Cleanup if needed
    // fs.rmSync(TEST_ROOT, { recursive: true });
  }
})();
