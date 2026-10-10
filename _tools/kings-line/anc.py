# walk up from the monarchs through every recorded father/mother on Wikidata
import json,sys
from wd import sparql,q
QID=json.load(open('qid.json'))
old=json.load(open('old.json'))
start=[QID[m[0]] for m in old['M']]
P={}   # qid -> {name,desc,born,died,par:[[qid,unsure]]}
def batch(xs):
    vals=' '.join('wd:'+x for x in xs)
    d=sparql(f'''SELECT ?x ?xLabel ?xDescription ?b ?d ?prop ?y ?circ WHERE {{ VALUES ?x {{{vals}}}
      OPTIONAL {{ ?x wdt:P569 ?b }} OPTIONAL {{ ?x wdt:P570 ?d }}
      OPTIONAL {{ VALUES ?prop {{p:P22 p:P25}} ?x ?prop ?st. ?st ?ps ?y. FILTER(?ps IN (ps:P22, ps:P25))
        ?st wikibase:rank ?r. FILTER(?r != wikibase:DeprecatedRank) OPTIONAL {{ ?st pq:P1480 ?circ }} }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,fr,es,it,da,sv,pl,hu,ru". }} }}''')
    for b in d:
        x=q(b['x']['value']);p=P.setdefault(x,{'name':b['xLabel']['value'],'desc':b.get('xDescription',{}).get('value',''),'born':None,'died':None,'par':{}})
        for k,key in (('b','born'),('d','died')):
            if k in b and b[k]['value'][:1] in '-0123456789':
                try:
                    y=int(b[k]['value'].lstrip('+').split('-')[0] if not b[k]['value'].startswith('-') else '-'+b[k]['value'][1:].split('-')[0])
                    p[key]=y if p[key] is None else min(p[key],y)
                except ValueError:pass
        if 'y' in b:
            y=q(b['y']['value']);u=p['par'].setdefault(y,{'prop':q(b['prop']['value']),'circ':set()})
            if 'circ' in b:u['circ'].add(q(b['circ']['value']))
    for x in xs:P.setdefault(x,{'name':x,'desc':'','born':None,'died':None,'par':{}})
frontier=list(dict.fromkeys(start));gen=0
while frontier:
    for i in range(0,len(frontier),120):batch(frontier[i:i+120])
    nxt=[]
    for x in frontier:
        p=P[x];yr=p['born'] if p['born'] is not None else p['died']
        if yr is not None and yr<700:continue  # stop climbing before ~700
        for y in p['par']:
            if y not in P and y not in nxt:nxt.append(y)
    gen+=1;print('gen',gen,'frontier',len(frontier),'total',len(P),flush=True)
    frontier=nxt
for p in P.values():
    p['par']={y:{'prop':v['prop'],'circ':sorted(v['circ'])} for y,v in p['par'].items()}
json.dump(P,open('anc.json','w'))
