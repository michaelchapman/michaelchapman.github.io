source "https://rubygems.org"

# The deploy workflow (.github/workflows/pages.yml) builds from this Gemfile,
# so the live site uses exactly the versions in Gemfile.lock.
# We pin jekyll directly rather than the `github-pages` gem because that gem
# drags in an ancient `eventmachine` that won't compile against modern
# Xcode/OpenSSL. The site uses its own layouts, so there's no theme gem.
gem "jekyll", "~> 4.4"
gem "jekyll-seo-tag", "~> 2.8"
gem "jekyll-sitemap", "~> 1.4"

# Ruby 3+ dropped webrick from the standard library; Jekyll's local server needs it.
gem "webrick", "~> 1.8"
