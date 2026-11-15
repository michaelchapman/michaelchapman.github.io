# Adds a frequency score (zipf, higher is more common) to every word from words.mjs.
import json
from wordfreq import zipf_frequency as z
t=json.load(open('tiers.json'))
out=[[w,tier,round(z(w,'en'),2),flag] for w,tier,flag in t]
json.dump(out,open('freq.json','w'))
import random
random.seed(3)
acc=[o for o in out if o[3]=='']
print('accepted',len(acc))
for lo,hi in [(3.0,9),(2.6,3.0),(2.3,2.6),(2.0,2.3),(1.5,2.0),(0,1.5)]:
    s=[w for w,tier,f,_ in acc if lo<=f<hi and len(w)<=5 and not (tier<=40 and f>=3)]
    print(lo,hi,len(s),' '.join(random.sample(s,min(45,len(s)))))
g=[w for w,tier,f,fl in out if fl=='ghost' and f>=2.8 and len(w)<=6]
print('familiar ghosts',len([1 for o in out if o[3]=='ghost' and o[2]>=2.8]),' '.join(random.sample(g,80)))
