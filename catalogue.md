---
title: Card catalogue
permalink: /catalogue/
---

{% assign bays = site.data.gallery.bays %}
<h1>Card catalogue</h1>
<p class="lede">Everything in the gallery, drawer by drawer, in the order you'd pass it walking along.</p>

{% for b in bays %}
<section class="drawer" id="{{ b.id }}">
<h2>{{ b.title }}</h2>
{% if b.blurb %}<p>{{ b.blurb }}</p>{% endif %}
{% assign objs = site.objects | where: "bay", b.id | sort: "year" | reverse %}
{% if b.template == 'frame-wall' %}
<ul class="cards">
{% for r in site.data.cv.roles %}<li><a href="{{ '/cv/' | relative_url }}#{{ r.id }}">{{ r.title }}</a> <span class="meta">{{ r.org }} · {{ r.years }}</span></li>
{% endfor %}</ul>
{% elsif objs.size > 0 %}
<ul class="cards">
{% for o in objs %}<li><a href="{{ o.url | relative_url }}">{{ o.title }}</a> <span class="meta">{% if o.publisher %}{{ o.publisher }}{% endif %}{% if o.year %} · {{ o.year }}{% endif %}</span></li>
{% endfor %}</ul>
{% endif %}
</section>
{% endfor %}
