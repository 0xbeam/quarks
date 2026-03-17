import { resolveUser, resolveUserMentions } from "./slack-client.js";

// Feedback categories and their signal patterns
const FEEDBACK_SIGNALS = {
  approval: {
    emoji: ["white_check_mark", "+1", "thumbsup", "heavy_check_mark", "100", "fire", "heart", "tada", "rocket"],
    keywords: ["looks good", "lgtm", "approved", "love it", "ship it", "perfect", "great", "nice", "awesome", "solid", "good to go", "yes"],
  },
  revision: {
    emoji: ["x", "warning", "thinking_face", "eyes", "memo"],
    keywords: [
      "change", "update", "fix", "adjust", "move", "swap", "replace",
      "instead", "should be", "needs to", "can we", "could you", "try",
      "make it", "switch", "tweak", "modify", "redo", "rework",
    ],
  },
  question: {
    emoji: ["question", "thinking_face"],
    keywords: ["why", "how", "what if", "is this", "are we", "should we", "can we", "?"],
  },
  blocker: {
    emoji: ["octagonal_sign", "no_entry", "rotating_light", "x"],
    keywords: [
      "blocker", "blocked", "can't ship", "don't ship", "stop", "hold",
      "critical", "breaking", "broken", "bug", "issue", "wrong",
    ],
  },
};

// Categorize a single message
function categorizeMessage(text, reactions) {
  const lower = (text || "").toLowerCase();
  const scores = { approval: 0, revision: 0, question: 0, blocker: 0, context: 0 };

  // Score based on text keywords
  for (const [category, signals] of Object.entries(FEEDBACK_SIGNALS)) {
    for (const kw of signals.keywords) {
      if (lower.includes(kw)) scores[category]++;
    }
  }

  // Score based on reactions
  if (reactions) {
    for (const reaction of reactions) {
      for (const [category, signals] of Object.entries(FEEDBACK_SIGNALS)) {
        if (signals.emoji.includes(reaction.name)) {
          scores[category] += reaction.count;
        }
      }
    }
  }

  // Pick highest score, default to "context"
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : "context";
}

// Extract image/file attachments from a message
function extractAttachments(message) {
  const attachments = [];

  if (message.files) {
    for (const file of message.files) {
      const isImage = file.mimetype?.startsWith("image/");
      attachments.push({
        type: isImage ? "image" : "file",
        name: file.name,
        title: file.title || file.name,
        mimetype: file.mimetype,
        url: file.url_private,
        thumb: file.thumb_480 || file.thumb_360 || file.thumb_160,
        permalink: file.permalink,
      });
    }
  }

  return attachments;
}

// Process the full thread into structured feedback
export async function extractFeedback(client, messages) {
  const parentMessage = messages[0];
  const replies = messages.slice(1);

  // Build structured entries
  const entries = [];

  for (const msg of messages) {
    const userName = await resolveUser(client, msg.user);
    const resolvedText = await resolveUserMentions(client, msg.text);
    const category = msg === parentMessage ? "context" : categorizeMessage(msg.text, msg.reactions);
    const attachments = extractAttachments(msg);

    entries.push({
      user: userName,
      userId: msg.user,
      text: resolvedText,
      category,
      attachments,
      reactions: msg.reactions || [],
      timestamp: msg.ts,
      isParent: msg === parentMessage,
    });
  }

  // Summary stats
  const categories = {};
  for (const entry of entries) {
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  }

  const allAttachments = entries.flatMap((e) => e.attachments);
  const imageCount = allAttachments.filter((a) => a.type === "image").length;

  return {
    parent: entries[0],
    replies: entries.slice(1),
    allEntries: entries,
    stats: {
      totalMessages: messages.length,
      totalReplies: replies.length,
      categories,
      imageCount,
      fileCount: allAttachments.length - imageCount,
    },
  };
}
