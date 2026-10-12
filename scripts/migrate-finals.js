/**
 * Convert the publish-ready Blogger HTML posts in the old repo's finals/
 * directory into Astro content-collection Markdown.
 *
 * Usage:
 *   FINALS_DIR=/path/to/blog_posts/finals node scripts/migrate-finals.js
 *
 * Only the posts listed in META below go online; their titles, dates and
 * tags are recorded there because the raw HTML files carry no frontmatter.
 */
import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';

const FINALS_DIR = process.env.FINALS_DIR || 'C:/Papers/blog_posts/finals';
const OUTPUT_DIR = './src/content/blog';

const META = {
  'image-generation-in-few-seconds-using-cpu': {
    title: 'Image Generation in Few Seconds Using CPU',
    pubDate: '2026-10-08T16:36:17+02:00',
    tags: ['AI', 'Image Generation', 'CPU'],
  },
  'testing-audio-cpp-for-music-generation-in-cpu': {
    title: 'Testing audio.cpp for Music Generation in CPU',
    pubDate: '2026-10-08T16:36:17+02:00',
    tags: ['AI', 'CPU'],
  },
  'filtering-cpu-generated-music-with-spectral-denoising': {
    title: 'Filtering CPU Generated Music with Spectral Denoising',
    pubDate: '2026-10-09T12:01:13+02:00',
    tags: ['AI', 'CPU'],
  },
};

if (!fs.existsSync(FINALS_DIR)) {
  console.error(`Error: finals directory not found: ${FINALS_DIR}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  keep: ['audio'],
});

// Turndown only fences <pre> elements wrapped in <code>; the Blogger cell
// cards use <pre class="code">, so convert any <pre> to a fenced block from
// its raw text content.
turndown.addRule('fencedPre', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (content, node) =>
    `\n\`\`\`\n${node.textContent.replace(/\n+$/, '')}\n\`\`\`\n`,
});

// Keep the cell card header line visible as bold text.
turndown.addRule('cellHeader', {
  filter: (node) =>
    node.nodeName === 'DIV' && (node.getAttribute('class') || '').includes('cell-header'),
  replacement: (content) => `\n**${content.trim()}**\n\n`,
});

// Preserve the Blogger audio players; turndown's keep option drops elements
// that contain child elements such as <source>.
turndown.addRule('audioRaw', {
  filter: (node) => node.nodeName === 'AUDIO',
  replacement: (content, node) => {
    const source = node.querySelector('source');
    const src = source ? source.getAttribute('src') : '';
    const type = source ? source.getAttribute('type') || 'audio/mpeg' : 'audio/mpeg';
    return `\n\n<audio controls preload="none"><source src="${src}" type="${type}" />Your browser does not support audio playback.</audio>\n\n`;
  },
});

function extractDescription(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!match) return '';
  const text = match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}...` : text;
}

let postCount = 0;

for (const [slug, meta] of Object.entries(META)) {
  const htmlPath = path.join(FINALS_DIR, `${slug}.html`);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`Skipping ${slug}: ${htmlPath} not found.`);
    continue;
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');

  // The Blogger <style> block is replaced by src/styles/global.css.
  html = html.replace(/<style>[\s\S]*?<\/style>/g, '');

  // Repo-relative image paths become Astro assets; relative paths from
  // src/content/blog/ into src/images/ resolve through the assets pipeline.
  // Only rewrite actual <img src> attributes, not prose mentioning paths.
  html = html.replace(/(<img[^>]*src=")(?:\.\.\/)?experiments\//g, '$1../../images/');

  const description = extractDescription(html);
  const markdownContent = turndown.turndown(html);

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(meta.title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${JSON.stringify(new Date(meta.pubDate).toISOString())}`,
    `tags: ${JSON.stringify(meta.tags)}`,
    'draft: false',
    '---',
    '',
    markdownContent,
    '',
  ].join('\n');

  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.md`), frontmatter, 'utf-8');
  postCount++;
  console.log(`Converted ${slug}.html -> ${OUTPUT_DIR}/${slug}.md`);
}

console.log(`Successfully migrated ${postCount} posts to ${OUTPUT_DIR}`);
