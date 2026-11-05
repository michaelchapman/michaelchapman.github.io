# Lists stem pairs on the final boards that the lemmatiser did not vouch for, for a human read-through.
import json,re,html as H
from lemminflect import getAllLemmas
t=open('../../../shoal/index.html').read()
raw=json.loads(re.search(r'__SHOAL_STEMS__=(".*?");</script>',t,re.S).group(1))
def lem(W):
    s=set()
    for v in getAllLemmas(W).values(): s|=set(v)
    return s
bad=[];n=0
for e in raw.split(' '):
    W,l=e.split(':')
    for w in l.split(','):
        n+=1
        if not (W==w+'s' or W==w+'es') and w not in lem(W): bad.append(f'{w}>{W}')
print(n,'pairs',len(bad),'not lemma/plural'); print(' '.join(sorted(bad)))
