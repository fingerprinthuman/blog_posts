/**
 * Publish a post to GitHub via the REST API.
 * Usage:
 *   GITHUB_TOKEN=xxx GITHUB_REPO=owner/repo node publish-post.js "My Title" "Post Markdown Content"
 */
import slugify from 'slugify';

const [title, markdownBody, tagsArg] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO;

if (!token || !repo || !title || !markdownBody) {
  console.error('Usage: GITHUB_TOKEN=... GITHUB_REPO=owner/repo node publish-post.js <title> <body> [tags-csv]');
  process.exit(1);
}

const tags = tagsArg ? tagsArg.split(',').map(t => t.trim()) : [];
const date = new Date().toISOString();
const slug = slugify(title, { lower: true, strict: true });
const filePath = `src/content/blog/${slug}.md`;

const postContent = `---
title: ${JSON.stringify(title)}
pubDate: ${JSON.stringify(date)}
tags: ${JSON.stringify(tags)}
draft: false
---

${markdownBody}
`;

const fileContentBase64 = Buffer.from(postContent, 'utf-8').toString('base64');

async function publish() {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `publish: ${title}`,
      content: fileContentBase64,
      branch: 'main',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API Error (${res.status}): ${err}`);
  }

  const data = await res.json();
  console.log(`Post published successfully! Commit: ${data.commit.sha}`);
}

publish().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
