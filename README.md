# Geometry and more — Astro site

Static blog built with [Astro](https://astro.build), migrated from the old
Blogger workflow. Lives at <https://fingerprinthuman.github.io/blog_posts>.

## Structure

- `src/content/blog/` — posts as Markdown with frontmatter (title, description,
  pubDate, updatedDate, tags, draft).
- `src/content.config.ts` — collection schema.
- `src/images/` — post images, referenced from Markdown with relative paths.
- `scripts/migrate-blogger.js` — converts a Blogger XML export
  (`BLOGGER_XML_PATH`) to Markdown.
- `scripts/migrate-finals.js` — converts the publish-ready HTML posts from the
  old repo's `finals/` directory (`FINALS_DIR`) to Markdown.
- `scripts/publish-post.js` — publishes a new post via the GitHub REST API.
- `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages on every
  push to `main`.

## Local commands

```bash
npm install
npm run dev      # local preview
npm run build    # static build into dist/
```

## Publishing

Via the API client (requires a fine-grained token with Contents: read/write):

```bash
GITHUB_TOKEN=... GITHUB_REPO=fingerprinthuman/blog_posts \
  node scripts/publish-post.js "Post Title" "Markdown body" "tag1,tag2"
```

Or drop a Markdown file into `src/content/blog/` and push to `main`; the
workflow rebuilds and deploys the site.

GitHub Pages must be able to build from a **public** repository (Pages is not
available for private repos on the free plan). The deploy job enables Pages
automatically with build type "GitHub Actions"; no manual settings step is
needed.
