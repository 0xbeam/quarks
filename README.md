# ⚛️ quarks — slack threads → agent instructions

> Converts Slack threads into structured instruction markdown for AI agents. Blockers, revisions, approvals, and open questions — auto-categorized so nothing falls through the cracks.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![Slack API](https://img.shields.io/badge/Slack-Bot%20API-4A154B?logo=slack&logoColor=white)](https://api.slack.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

| Feature | Description |
|---------|-------------|
| **Thread → markdown** | Full thread with messages, images, reactions converted to structured `.md` |
| **Auto-categorization** | Messages classified as blocker, revision, question, approval, or context |
| **Batch scraping** | Scrape N threads from a channel, or everything since a date |
| **Image download** | Attached images saved locally alongside the markdown |
| **Agent-ready output** | Frontmatter, checklists, collapsible thread — optimized for LLM consumption |
| **Emoji-aware** | Reactions like :octagonal_sign: and :white_check_mark: influence categorization |

## Quick Start

```bash
git clone https://github.com/0xbeam/quarks.git && cd quarks
npm install
cp .env.example .env   # add SLACK_BOT_TOKEN
```

## CLI Commands

| Command | Example | Description |
|---------|---------|-------------|
| `scrape` | `npx thread2md scrape "https://slack.com/.../p170..."` | Convert a single thread to markdown |
| `scrape --project` | `npx thread2md scrape "URL" --project myapp --output ./out` | Tag output with a project name |
| `batch` | `npx thread2md batch C0123ABC --limit 10` | Last N threads with replies from a channel |
| `batch --since` | `npx thread2md batch C0123ABC --since 2026-03-01` | All threads since a date |

## Output Format

```
output/
├── project-1710000000-000000.md
└── images/
    ├── dashboard-v2-light.png
    └── safari-bug-recording.png
```

Each markdown file contains:

| Section | Content |
|---------|---------|
| **Frontmatter** | Source URL, project, timestamp, message count |
| **Context** | Original post with reference images |
| **Blockers** | Critical issues — fix before shipping |
| **Required Changes** | Specific revision requests |
| **Open Questions** | Things to clarify before proceeding |
| **Approvals** | Confirmed sign-offs |
| **Full Thread** | Collapsible complete conversation |
| **Agent Instructions** | Actionable checklist with checkboxes |

## Feedback Categorization

| Category | Keywords | Emoji |
|----------|----------|-------|
| Blocker | "blocker", "broken", "critical" | :octagonal_sign: :no_entry: |
| Revision | "change", "fix", "should be", "instead" | :memo: :warning: |
| Question | "why", "how", "what if", "?" | :question: :thinking_face: |
| Approval | "lgtm", "looks good", "ship it" | :white_check_mark: :+1: |
| Context | Everything else | — |

## Required Slack Bot Scopes

`channels:history` · `groups:history` · `files:read` · `users:read`

Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).

## Stack

Node.js · Slack Bot API · Markdown

## License

MIT
