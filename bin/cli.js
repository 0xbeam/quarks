#!/usr/bin/env node

import { program } from "commander";
import { config } from "dotenv";
import { createSlackClient, parseThreadUrl, fetchThread } from "../src/slack-client.js";
import { extractFeedback } from "../src/feedback-extractor.js";
import { saveInstruction } from "../src/markdown-generator.js";

config();

program
  .name("thread2md")
  .description("Scrape Slack threads and convert them to agent instruction markdown")
  .version("1.0.0");

program
  .command("scrape")
  .description("Scrape a Slack thread and generate instruction markdown")
  .argument("<thread-url>", "Slack thread URL (e.g. https://workspace.slack.com/archives/C123/p456)")
  .option("-p, --project <name>", "Project name to tag the output")
  .option("-o, --output <dir>", "Output directory", process.env.OUTPUT_DIR || "./output")
  .action(async (threadUrl, opts) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      console.error("Error: SLACK_BOT_TOKEN not set. Copy .env.example to .env and add your token.");
      process.exit(1);
    }

    try {
      console.log(`Parsing thread URL...`);
      const { channelId, threadTs } = parseThreadUrl(threadUrl);
      console.log(`  Channel: ${channelId}, Thread: ${threadTs}`);

      const client = createSlackClient(token);

      console.log(`Fetching thread...`);
      const messages = await fetchThread(client, channelId, threadTs);
      console.log(`  Found ${messages.length} messages`);

      console.log(`Extracting feedback...`);
      const feedback = await extractFeedback(client, messages);
      console.log(`  Categories: ${JSON.stringify(feedback.stats.categories)}`);
      console.log(`  Images: ${feedback.stats.imageCount}, Files: ${feedback.stats.fileCount}`);

      console.log(`Generating instruction markdown...`);
      const result = await saveInstruction(client, feedback, opts.output, {
        projectName: opts.project,
        threadUrl,
      });

      console.log(`\nDone!`);
      console.log(`  Markdown: ${result.mdPath}`);
      console.log(`  Images downloaded: ${result.downloaded}/${result.totalImages}`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("batch")
  .description("Scrape multiple threads from a channel within a time range")
  .argument("<channel-id>", "Slack channel ID")
  .option("-p, --project <name>", "Project name to tag the output")
  .option("-o, --output <dir>", "Output directory", process.env.OUTPUT_DIR || "./output")
  .option("--since <date>", "Only include threads after this date (ISO format)", "")
  .option("--limit <n>", "Max number of threads to scrape", "10")
  .action(async (channelId, opts) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      console.error("Error: SLACK_BOT_TOKEN not set.");
      process.exit(1);
    }

    try {
      const client = createSlackClient(token);

      console.log(`Reading channel ${channelId}...`);
      const oldest = opts.since ? String(new Date(opts.since).getTime() / 1000) : undefined;

      const history = await client.conversations.history({
        channel: channelId,
        limit: parseInt(opts.limit),
        oldest,
      });

      // Filter to only threaded messages (those with replies)
      const threads = history.messages.filter((m) => m.reply_count > 0);
      console.log(`Found ${threads.length} threads with replies`);

      for (const thread of threads) {
        console.log(`\nProcessing thread ${thread.ts}...`);
        const messages = await fetchThread(client, channelId, thread.ts);
        const feedback = await extractFeedback(client, messages);
        const result = await saveInstruction(client, feedback, opts.output, {
          projectName: opts.project,
        });
        console.log(`  -> ${result.filename} (${result.downloaded} images)`);
      }

      console.log(`\nBatch complete. ${threads.length} threads processed.`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
