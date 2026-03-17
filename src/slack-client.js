import { WebClient } from "@slack/web-api";

export function createSlackClient(token) {
  return new WebClient(token);
}

// Parse a Slack thread URL into channel_id + message_ts
// Supports: https://workspace.slack.com/archives/C123ABC/p1234567890123456
export function parseThreadUrl(url) {
  const match = url.match(
    /archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})(?:\?.*thread_ts=(\d+\.\d+))?/
  );
  if (!match) {
    throw new Error(
      `Invalid Slack thread URL: ${url}\nExpected format: https://workspace.slack.com/archives/CHANNEL_ID/pTIMESTAMP`
    );
  }

  const channelId = match[1];
  // Slack timestamps are "seconds.microseconds" — the URL encodes it without the dot
  const threadTs = match[4] || `${match[2]}.${match[3]}`;

  return { channelId, threadTs };
}

// Fetch all messages in a thread
export async function fetchThread(client, channelId, threadTs) {
  const messages = [];
  let cursor;

  do {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 200,
      cursor,
    });
    messages.push(...result.messages);
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);

  return messages;
}

// Resolve user IDs to display names (cached)
const userCache = new Map();

export async function resolveUser(client, userId) {
  if (userCache.has(userId)) return userCache.get(userId);

  try {
    const result = await client.users.info({ user: userId });
    const name =
      result.user.profile.display_name ||
      result.user.real_name ||
      result.user.name;
    userCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

// Resolve all user mentions in a message text
export async function resolveUserMentions(client, text) {
  if (!text) return "";
  const mentionPattern = /<@([A-Z0-9]+)>/g;
  const matches = [...text.matchAll(mentionPattern)];

  let resolved = text;
  for (const match of matches) {
    const name = await resolveUser(client, match[1]);
    resolved = resolved.replace(match[0], `@${name}`);
  }
  return resolved;
}

// Download a file's content as a buffer (for images)
export async function downloadFile(client, fileUrl) {
  const response = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${client.token}` },
  });
  if (!response.ok) throw new Error(`Failed to download: ${fileUrl}`);
  return Buffer.from(await response.arrayBuffer());
}
