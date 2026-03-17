// Local test — simulates a Slack thread to verify the full pipeline
import { extractFeedback } from "./src/feedback-extractor.js";
import { generateInstructionMd } from "./src/markdown-generator.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// Mock Slack client that returns names without API calls
const mockClient = {
  users: {
    info: async ({ user }) => ({
      user: {
        profile: { display_name: mockUsers[user] || user },
        real_name: mockUsers[user] || user,
        name: user,
      },
    }),
  },
};

const mockUsers = {
  U001: "Alex (Design Lead)",
  U002: "Jordan (Engineer)",
  U003: "Sam (PM)",
  U004: "Riley (QA)",
  U005: "Casey (Stakeholder)",
};

// Simulated Slack thread: design review with images and mixed feedback
const mockMessages = [
  {
    user: "U001",
    ts: "1710500000.000000",
    text: "Here's the updated dashboard layout for Sanctuary Parc v2. Key changes:\n• Sidebar nav moved to left\n• New card grid for project overview\n• Dark mode support added\nPlease review and share feedback — need sign-off by EOD Friday.",
    files: [
      {
        name: "dashboard-v2-light.png",
        title: "Dashboard V2 — Light Mode",
        mimetype: "image/png",
        url_private: "https://files.slack.com/mock/dashboard-v2-light.png",
        permalink: "https://workspace.slack.com/files/mock/dashboard-v2-light.png",
      },
      {
        name: "dashboard-v2-dark.png",
        title: "Dashboard V2 — Dark Mode",
        mimetype: "image/png",
        url_private: "https://files.slack.com/mock/dashboard-v2-dark.png",
        permalink: "https://workspace.slack.com/files/mock/dashboard-v2-dark.png",
      },
    ],
    reactions: [{ name: "eyes", count: 3 }],
  },
  {
    user: "U002",
    ts: "1710500100.000000",
    text: "Love the new layout! The card grid looks solid. One thing — can we swap the font on the sidebar to match the heading font? Right now it's using the body font and feels inconsistent.",
    reactions: [{ name: "thumbsup", count: 2 }],
  },
  {
    user: "U003",
    ts: "1710500200.000000",
    text: "Looks good overall. Question — are we tracking click-through rates on the project cards? We need analytics hooks before shipping.",
    reactions: [{ name: "thinking_face", count: 1 }],
  },
  {
    user: "U004",
    ts: "1710500300.000000",
    text: "Blocker: the dark mode toggle is broken on Safari. The theme doesn't persist after page refresh. This needs to be fixed before we ship.",
    files: [
      {
        name: "safari-bug-recording.png",
        title: "Safari dark mode bug",
        mimetype: "image/png",
        url_private: "https://files.slack.com/mock/safari-bug.png",
        permalink: "https://workspace.slack.com/files/mock/safari-bug.png",
      },
    ],
    reactions: [{ name: "rotating_light", count: 2 }],
  },
  {
    user: "U005",
    ts: "1710500400.000000",
    text: "Ship it! LGTM :rocket:",
    reactions: [{ name: "white_check_mark", count: 3 }, { name: "rocket", count: 1 }],
  },
  {
    user: "U002",
    ts: "1710500500.000000",
    text: "Also — the spacing between the cards should be 24px instead of 16px. It looks cramped on smaller screens. And make the card hover state more subtle, the current shadow is too aggressive.",
    files: [
      {
        name: "spacing-comparison.png",
        title: "Card spacing — 16px vs 24px",
        mimetype: "image/png",
        url_private: "https://files.slack.com/mock/spacing-comparison.png",
        permalink: "https://workspace.slack.com/files/mock/spacing-comparison.png",
      },
    ],
  },
  {
    user: "U001",
    ts: "1710500600.000000",
    text: "Good catch <@U002>. I'll update the spacing. <@U004> can you file the Safari bug so we can track it?",
    reactions: [{ name: "+1", count: 1 }],
  },
];

async function runTest() {
  console.log("Running local pipeline test...\n");

  // Extract feedback
  const feedback = await extractFeedback(mockClient, mockMessages);

  console.log("Stats:", JSON.stringify(feedback.stats, null, 2));
  console.log("\nCategories per message:");
  for (const entry of feedback.allEntries) {
    console.log(`  [${entry.category.toUpperCase().padEnd(8)}] ${entry.user}: ${entry.text.slice(0, 60)}...`);
  }

  // Generate markdown
  const md = generateInstructionMd(feedback, {
    projectName: "sanctuary-parc",
    threadUrl: "https://spacekayak.slack.com/archives/C0DESIGN/p1710500000000000",
  });

  // Write output
  const outputDir = "./output/test";
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, "sanctuary-parc-test.md");
  await writeFile(outputPath, md, "utf-8");

  console.log(`\nMarkdown written to: ${outputPath}`);
  console.log(`Length: ${md.length} chars, ${md.split("\n").length} lines`);
  console.log("\n--- Preview (first 80 lines) ---\n");
  console.log(md.split("\n").slice(0, 80).join("\n"));
}

runTest().catch(console.error);
