import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import TurndownService from 'turndown';
import slugify from 'slugify';

const XML_FILE = process.env.BLOGGER_XML_PATH;
const OUTPUT_DIR = './src/content/blog';

if (!XML_FILE || !fs.existsSync(XML_FILE)) {
  console.error('Error: Set BLOGGER_XML_PATH to a valid XML file.');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

const xmlData = fs.readFileSync(XML_FILE, 'utf-8');
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const parsed = parser.parse(xmlData);

const entries = parsed.feed.entry || [];
let postCount = 0;

for (const entry of entries) {
  // Blogger entries include settings and comments; filter only actual posts:
  const categories = Array.isArray(entry.category) ? entry.category : [entry.category].filter(Boolean);
  const isPost = categories.some(cat => cat['@_term']?.includes('#post'));
  if (!isPost) continue;

  const title = entry.title?.['#text'] || entry.title || 'Untitled';
  const contentHtml = entry.content?.['#text'] || entry.content || '';
  const published = entry.published;
  const updated = entry.updated;

  // Extract labels/tags
  const tags = categories
    .filter(cat => cat['@_scheme'] === 'http://www.blogger.com/atom/ns#')
    .map(cat => cat['@_term'])
    .filter(Boolean);

  // Derive slug
  let slug = slugify(title, { lower: true, strict: true });
  if (!slug || slug === 'untitled') {
    slug = `post-${new Date(published).getTime()}`;
  }

  const markdownContent = turndown.turndown(contentHtml);

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `pubDate: ${JSON.stringify(new Date(published).toISOString())}`,
    updated ? `updatedDate: ${JSON.stringify(new Date(updated).toISOString())}` : null,
    `tags: ${JSON.stringify(tags)}`,
    'draft: false',
    '---',
    '',
    markdownContent
  ].filter(Boolean).join('\n');

  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.md`), frontmatter, 'utf-8');
  postCount++;
}

console.log(`Successfully migrated ${postCount} posts to ${OUTPUT_DIR}`);
