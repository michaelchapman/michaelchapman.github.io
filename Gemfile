source "https://rubygems.org"

# The deploy workflow (.github/workflows/pages.yml) builds from this Gemfile,
# so the live site uses exactly the versions in Gemfile.lock.
# We pin jekyll/minima directly rather than the `github-pages` gem because
# that gem drags in an ancient `eventmachine` that won't compile against
# modern Xcode/OpenSSL.
gem "jekyll", "~> 4.4"
gem "minima", "~> 2.5"
gem "jekyll-feed", "~> 0.17"
gem "jekyll-seo-tag", "~> 2.8"
gem "jekyll-sitemap", "~> 1.4"

# Ruby 3+ dropped webrick from the standard library; Jekyll's local server needs it.
gem "webrick", "~> 1.8"
