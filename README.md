# michaelchapman.github.io

Source for [michaelchapman.me](https://michaelchapman.me), built with Jekyll
and served by GitHub Pages' native Jekyll build (no custom Actions workflow).

## Structure

- `_config.yml` — site settings and the `minima` theme configuration
- `index.md`, `about.md`, `writing.md`, `contact.md` — top-level pages
- `_posts/` — blog posts (`YYYY-MM-DD-title.md`), listed on `/writing/`
- `assets/css/style.scss` — theme overrides on top of `minima`
- `CNAME` — custom domain config; do not edit, DNS is already set up

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

Push to `main`. GitHub Pages detects `_config.yml` and builds the site with
Jekyll automatically — no workflow file needed. Changes are usually live
within a minute or two at https://michaelchapman.me.
