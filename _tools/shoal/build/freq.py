import json
from wordfreq import zipf_frequency as z
t=json.load(open('tiers.json'))
out=[[w,tier,round(z(w,'en'),2)] for w,tier in t]
json.dump(out,open('freq.json','w'))
import random
random.seed(3)
for lo,hi in [(4.5,9),(3.8,4.5),(3.3,3.8),(3.0,3.3),(2.7,3.0),(2.3,2.7)]:
    s=[w for w,tier,f in out if lo<=f<hi and tier<=40]
    print(lo,hi,len(s),random.sample(s,18))
print('by tier', {k:sum(1 for w,tier,f in out if tier==k) for k in (10,20,35,40,50,55,60)})
