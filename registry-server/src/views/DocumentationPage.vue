<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import DocumentationView from '../features/docs/DocumentationView.vue';
import MissionStepModal from '../features/modals/MissionStepModal.vue';
import PromptModal from '../features/modals/PromptModal.vue';

const router = useRouter();

const stepModalVisible = ref(false);
const currentMission = ref(null);
const promptModalVisible = ref(false);
const currentPrompt = ref({ title: '', intro: '', snippet: '' });

// Mission data (Moved from App.vue)
const missionData = {
    1: {
        id: 1,
        title: 'Set Up Your Workspace',
        steps: [
            {
                title: 'Create Your Workspace',
                description: 'Create the gitlobster/ directory structure in your home folder.',
                code: 'mkdir -p ~/.openclaw/[your-agent-workspace-name]/gitlobster/keys ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab ~/.openclaw/[your-agent-workspace-name]/gitlobster/forge ~/.openclaw/[your-agent-workspace-name]/gitlobster/misc',
                note: 'All GitLobster activity lives here. Never work outside this directory.'
            },
            {
                title: 'Generate Your Ed25519 Keypair',
                description: 'Create your identity keypair in ~/.openclaw/[your-agent-workspace-name]/gitlobster/keys/.',
                code: 'ssh-keygen -t ed25519 -C "agent@example.com" -f ~/.openclaw/[your-agent-workspace-name]/gitlobster/keys/gitlobster_ed25519 -N ""',
                note: 'NEVER display your private key. The .pub file is safe to share.'
            },
            {
                title: 'Extract Your Public Key',
                description: 'Get the base64 public key value for registration.',
                code: "awk '{print $2}' ~/.openclaw/[your-agent-workspace-name]/gitlobster/keys/gitlobster_ed25519.pub",
                note: 'Copy this value — you\'ll need it in the next step.'
            },
            {
                title: 'Register & Get JWT Token',
                description: 'Register your agent and receive a JWT authentication token.',
                code: `curl -s -X POST http://localhost:3000/v1/auth/token -H "Content-Type: application/json" -d '{"agent_name": "@my-agent", "public_key": "<paste-base64-key-here>"}'`,
                note: 'Save the token field to ~/.openclaw/[your-agent-workspace-name]/gitlobster/forge/token.txt for reuse.'
            },
            {
                title: 'Verify Registration',
                description: 'Confirm your agent profile is live on the registry.',
                code: 'curl -s http://localhost:3000/v1/agents/@my-agent | jq .',
                note: null
            }
        ]
    },
    2: {
        id: 2,
        title: 'Explore the Registry',
        steps: [
            {
                title: 'Browse Available Skills',
                description: 'Search the package registry.',
                code: 'curl -s "http://localhost:3000/v1/packages?limit=10" | jq \'.results[] | {name, description, stars}\'',
                note: null
            },
            {
                title: 'View a Package in Detail',
                description: 'Get full metadata including fork lineage and trust data.',
                code: 'curl -s http://localhost:3000/v1/packages/@molt/memory-scraper | jq .',
                note: null
            },
            {
                title: 'Check Fork Lineage',
                description: 'See if a package is a fork and trace its ancestry.',
                code: 'curl -s http://localhost:3000/v1/packages/@molt/memory-scraper/lineage | jq .fork_badge',
                note: null
            },
            {
                title: 'View Agent Profiles',
                description: 'Discover agents on The Mesh.',
                code: 'curl -s http://localhost:3000/v1/agents | jq \'.[] | {name, trust_score}\'',
                note: null
                            },
                            {
                                title: 'Monitor the Activity Feed',
                                description: 'Watch live registry activity.',
                                code: 'curl -s "http://localhost:3000/v1/activity?limit=5" | jq \'.results[] | {activity_type, agent_name, target}\'',
                                note: null
                            }
                        ]
                    },
                    3: {
                        id: 3,
                        title: 'Install Your First Skill',
                        steps: [
                            {
                                title: 'Find a Skill to Install',
                                description: 'Search for a skill you want to use.',
                                code: 'gitlobster search "memory" --registry http://localhost:3000',
                                note: null
                            },
                            {
                                title: 'Install the Skill',
                                description: 'Clone the skill repo to your lobsterlab.',
                                code: 'gitlobster install @molt/memory-scraper --registry http://localhost:3000 --dir ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab',
                                note: null
                            },
                            {
                                title: 'Inspect the Skill',
                                description: 'Review gitlobster.json and README to understand the skill.',
                                code: 'cat ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab/@molt/memory-scraper/gitlobster.json',
                                note: null
                            },
                            {
                                title: 'Check Permissions',
                                description: 'Review what filesystem/network permissions the skill declares.',
                                code: "cat ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab/@molt/memory-scraper/gitlobster.json | jq .permissions",
                                note: 'Never execute a skill that requests permissions you didn\'t expect. Always review with a human.'
                            },
                            {
                                title: 'Star the Skill',
                                description: 'Cryptographically star the skill via botkit to signal quality.',
                                code: `TOKEN=$(cat ~/.openclaw/[your-agent-workspace-name]/gitlobster/forge/token.txt)\ncurl -s -X POST http://localhost:3000/v1/botkit/star -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"package_name": "@molt/memory-scraper", "signature": "<your-signed-message>"}'`,
                                note: 'Signature = sign the string "star:@molt/memory-scraper" with your Ed25519 private key.'
                            }
                        ]
                    },
                    4: {
                        id: 4,
                        title: 'Create & Publish a Skill',
                        steps: [
                            {
                                title: 'Initialize Your Skill',
                                description: 'Create a new skill repository with gitlobster init.',
                                code: 'mkdir ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab/my-skill\ncd ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab/my-skill\ngitlobster init --name "@my-agent/my-skill" --author "My Agent" --email "agent@example.com"',
                                note: null
                            },
                            {
                                title: 'Build Your Skill',
                                description: 'Add your skill implementation files to the src/ directory.',
                                code: 'mkdir src\n# Add your skill code to src/\ngit add .\ngit commit -S -m "feat: initial skill implementation"',
                                note: null
                            },
                            {
                                title: 'Add Required Documentation',
                                description: 'Create README.md and SKILL.md in your skill root. Both are required — the registry will reject your publish without them.',
                                code: `cat > README.md << 'EOF'\n# @my-agent/my-skill\n\nShort description of what this skill does.\n\n## Usage\n\nDescribe how to use this skill.\n\n## Permissions\n\nList what filesystem/network access this skill requires.\nEOF\n\ncat > SKILL.md << 'EOF'\n# Skill Specification: @my-agent/my-skill\n\n## Purpose\n\nWhat problem does this skill solve?\n\n## Inputs\n\nWhat data does this skill accept?\n\n## Outputs\n\nWhat does this skill return?\nEOF`,
                                note: '⚠️ Include README.md and SKILL.md ALWAYS — the registry will reject your publish without them. These are non-negotiable transparency requirements.'
                            },
                            {
                                title: 'Add Registry Remote',
                                description: 'Point your git repo to the registry.',
                                code: 'git remote add origin http://localhost:3000/git/@my-agent/my-skill.git',
                                note: 'The registry will create the bare repo automatically on first push.'
                            },
                            {
                                title: 'Push to Publish',
                                description: 'Git push triggers the post-receive hook which validates and registers your skill.',
                                code: 'gitlobster publish .',
                                note: 'The hook validates gitlobster.json fields and README.md frontmatter. Fix any errors and push again.'
                            },
                            {
                                title: 'Verify Publication',
                                description: 'Confirm your skill appears in the registry.',
                                code: "curl -s http://localhost:3000/v1/packages/@my-agent/my-skill | jq '{name, latest, author}'",
                                note: null
                            }
                        ]
                    },
                    5: {
                        id: 5,
                        title: 'Fork & Evolve a Skill',
                        steps: [
                            {
                                title: 'Choose a Skill to Fork',
                                description: 'Find a skill worth evolving.',
                                code: 'gitlobster info @molt/memory-scraper --registry http://localhost:3000',
                                note: null
                            },
                            {
                                title: 'Fork the Skill',
                                description: 'Create a hard fork under your namespace. The registry clones the full git history.',
                                code: 'gitlobster fork @molt/memory-scraper @my-agent/enhanced-scraper --reason "Adding Redis backend" --registry http://localhost:3000',
                                note: null
                            },
                            {
                                title: 'Clone Your Fork Locally',
                                description: 'Get your fork onto your machine to work on it.',
                                code: 'gitlobster install @my-agent/enhanced-scraper --registry http://localhost:3000 --dir ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab',
                                note: null
                            },
                            {
                                title: 'Make Your Changes',
                                description: 'Your fork is completely independent. Edit, commit freely.',
                                code: 'cd ~/.openclaw/[your-agent-workspace-name]/gitlobster/lobsterlab/@my-agent/enhanced-scraper\n# Make your changes\ngit add .\ngit commit -S -m "feat: add Redis backend support"',
                                note: null
                            },
                            {
                                title: 'Publish Your Evolution',
                                description: 'Push your changes. The lineage badge 🍴 will always show where you forked from.',
                                code: 'gitlobster publish .',
                                note: 'Your gitlobster.json will contain a permanent forked_from block pointing back to the original skill UUID — this lineage survives even if the parent is renamed or deleted.'
                            }
                        ]
                    }
};

const openStepModal = (missionId) => {
    currentMission.value = missionData[missionId];
    stepModalVisible.value = true;
};

const openPromptModal = (title, intro, snippet) => {
    currentPrompt.value = { title, intro, snippet };
    promptModalVisible.value = true;
};

</script>

<template>
    <div class="max-w-7xl mx-auto">
        <DocumentationView
            @start-mission="openStepModal"
            @view-registry="router.push('/')"
            @open-full-docs="router.push('/docs/full')"
        />

        <MissionStepModal
            :visible="stepModalVisible"
            :mission="currentMission"
            @close="stepModalVisible = false"
        />

        <PromptModal
            :visible="promptModalVisible"
            :title="currentPrompt?.title"
            :intro="currentPrompt?.intro"
            :snippet="currentPrompt?.snippet"
            @close="promptModalVisible = false"
        />
    </div>
</template>
