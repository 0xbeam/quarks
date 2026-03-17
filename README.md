# ⚛️ Quarks

> Converts Slack threads into structured instruction markdown for AI agents.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Slack API](https://img.shields.io/badge/Slack-Bot%20API-4A154B?logo=slack&logoColor=white)](https://api.slack.com/)

Quarks reads a Slack thread — messages, images, reactions, the whole thing — and spits out a structured `.md` file your AI agent can actually act on. Blockers, revisions, approvals, and open questions are auto-categorized so nothing falls through the cracks.

## Install

```bash
git clone https://github.com/anthropics/Quarks.git && cd Quarks
npm install
cp .env.example .env
```

Add your Slack Bot Token to `.env`. The bot needs these scopes:

- `channels:history` — public channel messages
- `groups:history` — private channel messages
- `files:read` — download images/files
- `users:read` — resolve user names

Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).

## Usage

### Single thread

```bash
# Basic — just give it a thread URL
npx thread2md scrape "https://yourworkspace.slack.com/archives/C0123ABC/p1710000000000000"

# Tag it with a project name
npx thread2md scrape "https://..." --project sanctuary-parc --output ./output
```

### Batch scrape

```bash
# Last 10 threads with replies from a channel
npx thread2md batch C0123ABC --project spacekayak --limit 10

# Everything since a specific date
npx thread2md batch C0123ABC --since 2026-03-01 --project spacekayak
```

## Output Format

Each thread produces a markdown file + downloaded images:

```
output/
├── sanctuary-parc-1710000000-000000.md
└── images/
    ├── dashboard-v2-light.png
    └── safari-bug-recording.png
```

The generated markdown is structured for agent consumption:

| Section | What's in it |
|---------|-------------|
| **Frontmatter** | Source URL, project, timestamp, message count |
| **Context** | Original post with reference images |
| **Blockers** | Critical issues — fix before shipping |
| **Required Changes** | Specific revision requests |
| **Open Questions** | Things to clarify before proceeding |
| **Approvals** | Confirmed sign-offs |
| **Full Thread** | Collapsible complete conversation |
| **Agent Instructions** | Actionable checklist with checkboxes |

### Feedback categorization

Messages are auto-categorized based on keywords and emoji reactions:

| Category | Keywords | Emoji |
|----------|----------|-------|
| Blocker | "blocker", "broken", "critical" | :octagonal_sign: :no_entry: |
| Revision | "change", "fix", "should be", "instead" | :memo: :warning: |
| Question | "why", "how", "what if", "?" | :question: :thinking_face: |
| Approval | "lgtm", "looks good", "ship it" | :white_check_mark: :+1: |
| Context | Everything else | — |

## License

MIT
