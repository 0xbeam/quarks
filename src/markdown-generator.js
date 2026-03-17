import { writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";
import { downloadFile } from "./slack-client.js";

const CATEGORY_LABELS = {
  approval: "Approved",
  revision: "Change Requested",
  question: "Question",
  blocker: "Blocker",
  context: "Context",
};

const CATEGORY_ICONS = {
  approval: "[OK]",
  revision: "[CHANGE]",
  question: "[?]",
  blocker: "[!!]",
  context: "[i]",
};

// Clean Slack mrkdwn to regular markdown
function cleanSlackMarkdown(text) {
  if (!text) return "";
  return (
    text
      // Bold: *text* → **text**
      .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "**$1**")
      // Links: <url|label> → [label](url)
      .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "[$2]($1)")
      // Bare links: <url> → url
      .replace(/<(https?:\/\/[^>]+)>/g, "$1")
      // Channel refs: <#C123|channel> → #channel
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
      // Code blocks
      .replace(/```([^`]+)```/g, "\n```\n$1\n```\n")
  );
}

function formatTimestamp(ts) {
  return new Date(parseFloat(ts) * 1000).toISOString().replace("T", " ").slice(0, 16);
}

// Generate the instruction markdown from extracted feedback
export function generateInstructionMd(feedback, options = {}) {
  const { projectName, threadUrl } = options;
  const { parent, replies, stats } = feedback;
  const lines = [];

  // --- Header ---
  lines.push(`---`);
  lines.push(`source: slack-thread`);
  if (threadUrl) lines.push(`thread_url: ${threadUrl}`);
  lines.push(`scraped_at: ${new Date().toISOString()}`);
  if (projectName) lines.push(`project: ${projectName}`);
  lines.push(`total_messages: ${stats.totalMessages}`);
  lines.push(`images: ${stats.imageCount}`);
  lines.push(`---`);
  lines.push("");

  // --- Title ---
  const title = parent.text?.split("\n")[0]?.slice(0, 80) || "Slack Thread Feedback";
  lines.push(`# ${title}`);
  lines.push("");

  // --- Context (parent message) ---
  lines.push(`## Context`);
  lines.push("");
  lines.push(`**Posted by:** ${parent.user} — ${formatTimestamp(parent.timestamp)}`);
  lines.push("");
  lines.push(cleanSlackMarkdown(parent.text));
  lines.push("");

  // Parent images
  if (parent.attachments.length > 0) {
    lines.push(`### Reference Assets`);
    lines.push("");
    for (const att of parent.attachments) {
      if (att.type === "image") {
        lines.push(`![${att.title}](./images/${att.name})`);
        lines.push(`> ${att.title}`);
      } else {
        lines.push(`- [${att.title}](./images/${att.name})`);
      }
    }
    lines.push("");
  }

  // --- Blockers first ---
  const blockers = replies.filter((r) => r.category === "blocker");
  if (blockers.length > 0) {
    lines.push(`## Blockers`);
    lines.push("");
    for (const b of blockers) {
      lines.push(`> **${CATEGORY_ICONS.blocker} ${b.user}:** ${cleanSlackMarkdown(b.text)}`);
      renderAttachments(lines, b.attachments);
    }
    lines.push("");
  }

  // --- Revisions ---
  const revisions = replies.filter((r) => r.category === "revision");
  if (revisions.length > 0) {
    lines.push(`## Required Changes`);
    lines.push("");
    for (let i = 0; i < revisions.length; i++) {
      const r = revisions[i];
      lines.push(`${i + 1}. **${r.user}:** ${cleanSlackMarkdown(r.text)}`);
      renderAttachments(lines, r.attachments);
    }
    lines.push("");
  }

  // --- Questions ---
  const questions = replies.filter((r) => r.category === "question");
  if (questions.length > 0) {
    lines.push(`## Open Questions`);
    lines.push("");
    for (const q of questions) {
      lines.push(`- **${q.user}:** ${cleanSlackMarkdown(q.text)}`);
    }
    lines.push("");
  }

  // --- Approvals ---
  const approvals = replies.filter((r) => r.category === "approval");
  if (approvals.length > 0) {
    lines.push(`## Approvals`);
    lines.push("");
    for (const a of approvals) {
      const text = cleanSlackMarkdown(a.text);
      lines.push(`- **${a.user}:** ${text || "Approved (via reaction)"}`);
    }
    lines.push("");
  }

  // --- Full Thread (for completeness) ---
  lines.push(`## Full Thread`);
  lines.push("");
  lines.push(`<details>`);
  lines.push(`<summary>Expand full conversation (${stats.totalMessages} messages)</summary>`);
  lines.push("");
  for (const entry of feedback.allEntries) {
    const tag = CATEGORY_ICONS[entry.category] || "";
    lines.push(
      `**${entry.user}** ${tag} — _${formatTimestamp(entry.timestamp)}_`
    );
    lines.push(cleanSlackMarkdown(entry.text));
    renderAttachments(lines, entry.attachments);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  lines.push(`</details>`);
  lines.push("");

  // --- Agent Instructions ---
  lines.push(`## Agent Instructions`);
  lines.push("");
  lines.push(
    `Use this section as your primary directive when working on this feedback.`
  );
  lines.push("");

  if (blockers.length > 0) {
    lines.push(`### Must Fix (Blockers)`);
    lines.push("");
    for (const b of blockers) {
      lines.push(`- [ ] ${cleanSlackMarkdown(b.text)} _(${b.user})_`);
    }
    lines.push("");
  }

  if (revisions.length > 0) {
    lines.push(`### Changes Requested`);
    lines.push("");
    for (const r of revisions) {
      lines.push(`- [ ] ${cleanSlackMarkdown(r.text)} _(${r.user})_`);
    }
    lines.push("");
  }

  if (questions.length > 0) {
    lines.push(`### Clarify Before Proceeding`);
    lines.push("");
    for (const q of questions) {
      lines.push(`- [ ] ${cleanSlackMarkdown(q.text)} _(${q.user})_`);
    }
    lines.push("");
  }

  if (feedback.allEntries.some((e) => e.attachments.length > 0)) {
    lines.push(`### Reference Images`);
    lines.push("");
    lines.push(
      `Review all images in the \`./images/\` folder — they contain visual context for the changes above.`
    );
    lines.push("");
  }

  return lines.join("\n");
}

function renderAttachments(lines, attachments) {
  for (const att of attachments) {
    if (att.type === "image") {
      lines.push(`  ![${att.title}](./images/${att.name})`);
    } else {
      lines.push(`  - Attachment: [${att.title}](./images/${att.name})`);
    }
  }
}

// Save the instruction MD and download images
export async function saveInstruction(client, feedback, outputDir, options = {}) {
  const md = generateInstructionMd(feedback, options);

  // Create output dirs
  await mkdir(outputDir, { recursive: true });
  const imagesDir = join(outputDir, "images");
  await mkdir(imagesDir, { recursive: true });

  // Write markdown
  const ts = feedback.parent.timestamp.replace(".", "-");
  const filename = options.projectName
    ? `${slugify(options.projectName)}-${ts}.md`
    : `thread-${ts}.md`;
  const mdPath = join(outputDir, filename);
  await writeFile(mdPath, md, "utf-8");

  // Download all images
  const allAttachments = feedback.allEntries.flatMap((e) => e.attachments);
  const images = allAttachments.filter((a) => a.type === "image");

  let downloaded = 0;
  for (const img of images) {
    try {
      const buffer = await downloadFile(client, img.url);
      await writeFile(join(imagesDir, img.name), buffer);
      downloaded++;
    } catch (err) {
      console.error(`  Failed to download ${img.name}: ${err.message}`);
    }
  }

  return { mdPath, filename, downloaded, totalImages: images.length };
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
