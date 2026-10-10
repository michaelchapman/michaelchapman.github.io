# michaelchapman.github.io

Source for [michaelchapman.me](https://michaelchapman.me), built with Jekyll
and deployed to GitHub Pages by a GitHub Actions workflow.

## Structure

For now the site is two standalone pages, served as-is with no theme layout:

- `index.html` — the Top Banana game, at `/`
- `kings-line/index.html` — The King's Line (monarch ancestry), at `/kings-line/`

Other files:

- `_config.yml` — site settings (Jekyll copies both pages unchanged and adds a `sitemap.xml`)
- `favicon.ico` — the tab icon browsers request automatically
- `.github/workflows/` — build/deploy (`pages.yml`) and link checking (`links.yml`)
- `CNAME` — custom domain config; do not edit, DNS is already set up

The earlier Markdown pages (About, CV, Work, Writing and the first post) and
the `minima` theme were removed while unused; they are in git history before
this change if needed again.

## Local preview

Requires Ruby and Bundler.

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000. `jekyll serve` watches for changes and
rebuilds automatically; stop it with Ctrl-C.

## Deploying

Push to `main`. The `Build and deploy site` workflow builds the site with the
exact Jekyll version in `Gemfile.lock` (the same one `bundle exec jekyll
serve` uses locally) and publishes it. Changes are usually live within a
couple of minutes at https://michaelchapman.me. Pull requests get a build
check but are not deployed.

This needs the repository's Pages source set to **GitHub Actions**
(Settings → Pages → Build and deployment → Source).

The `Check links` workflow checks every link on the built site on each push
and weekly, so a dead external link shows up as a failed run.
