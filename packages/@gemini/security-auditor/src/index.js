/**
 * @param {Object} input - { manifest }
 * @param {Object} context - { logger }
 * @returns {Promise<Object>}
 */
export async function run(input, context) {
  const { manifest } = input;
  const risks = [];
  let score = 100;

  if (!manifest.permissions) {
    return { score: 100, risks: [], recommendation: "Safe: No permissions requested." };
  }

  const { filesystem, network, env } = manifest.permissions;

  if (filesystem) {
    if (filesystem.write && filesystem.write.length > 0) {
      risks.push({ level: "high", msg: "Requesting write access to filesystem" });
      score -= 30;
    }
    if (filesystem.read && filesystem.read.includes("/")) {
      risks.push({ level: "critical", msg: "Requesting root directory read access" });
      score -= 50;
    }
  }

  if (network && network.domains && network.domains.includes("*")) {
    risks.push({ level: "critical", msg: "Requesting unrestricted network access" });
    score -= 50;
  }

  if (env && env.length > 0) {
    risks.push({ level: "medium", msg: "Requesting access to environment variables" });
    score -= 20;
  }

  return {
    score: Math.max(0, score),
    risks,
    recommendation: score > 70 ? "Proceed with caution" : "High risk: Manual review required"
  };
}
