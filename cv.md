---
title: CV
permalink: /cv/
---

<h1>CV</h1>
<p class="lede">A shorter, less formal version of my CV: the career history, without the job-application polish. In the gallery these hang on the wall as certificates.</p>

{% for r in site.data.cv.roles %}
<section class="role" id="{{ r.id }}">
<p class="eyebrow">{{ r.years }}</p>
<h2>{{ r.title }}</h2>
<p class="meta">{{ r.org }}</p>
<p>{{ r.summary }}</p>
</section>
{% endfor %}

<h2>Also currently</h2>
<ul class="boards">
{% for b in site.data.cv.boards %}<li>{{ b }}</li>
{% endfor %}</ul>
