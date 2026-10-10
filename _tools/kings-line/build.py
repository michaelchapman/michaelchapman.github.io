# merge the hand-checked tree with Wikidata ancestors, keep only what the page needs, write tree.js
import json,sys,re
from collections import deque,defaultdict
old=json.load(open('old.json'));QID=json.load(open('qid.json'));A=json.load(open('anc.json'))
MON=[m[0] for m in old['M']];OLDPAR=old['PAR'];OLDN=old['N']
ID={v:k for k,v in QID.items()}                 # qid -> page id
pid=lambda qd:ID.get(qd,qd)
names={m[0]:m[1] for m in old['M']};names.update({k:v[0] for k,v in OLDN.items()})
def yr(qd):
    p=A.get(qd);return None if not p else (p['born'],p['died'])
def sane(child,par,prop):
    c,p=yr(child),yr(par)
    if not c or not p:return True
    cb,_=c;pb,pd=p
    rough=lambda y:y is not None and y%100 in (0,1)
    if cb is None or rough(cb):return True
    if pb is not None and not rough(pb) and not (8<=cb-pb<=(90 if prop=='P22' else 60)):return False
    if pd is not None and not rough(pd) and pd<cb-(2 if prop=='P22' else 0)-3:return False
    return True
sex={}
for x,p in A.items():
    for y,v in p['par'].items():sex[y]=v['prop']
PAR={};UNS=set();OLDE=set()
for c,ps in OLDPAR.items():
    PAR[c]=list(ps);OLDE.update(f'{c}>{p}' for p in ps)
for e in ['elizgrey>richardgrey','cnutmother>mieszko1']:UNS.add(e)
dropped=[]
ROOTS={'egbert','rollo','gorm','godwin'}
# Wikidata links reviewed by hand: BLOCK are wrong, DOUBT are disputed by historians
BLOCK={('Q68366','Q18357561'),  # Siward is not a son of Beorn Estrithson
       ('Q2746341','Q242670')}  # Ælfthryth, Edgar's queen, was Ordgar's daughter, not Ealhswith's   # Siward, Earl of Northumbria is not a son of Beorn Estrithson (a saga legend; Beorn was younger)
DOUBT={('Q56285208','Q68366'),  # Suthen, mother of Malcolm III, is called Siward's kinswoman, not securely his daughter
       ('Q2826477','Q28468'),    # the origin of Agatha, wife of Edward the Exile, is unknown; Mieszko II is one of several theories
       ('Q3495067','Q103560123'),  # the parentage of Ealdgyth, wife of Edmund Ironside, is not recorded
       ('Q259114','Q2162436'),     # Olaf Cuaran's mother is unknown; Edith of Polesworth is a late tradition
       ('Q13563381','Q333359'),       # Fressenda, wife of Tancred of Hauteville, as a daughter of Richard I of Normandy is a later claim
       ('Q4959926','Q312594')}     # this Christina as a daughter of William the Lion is doubtful  # the parentage of Ealdgyth, wife of Edmund Ironside, is not recorded   # Suthen, mother of Malcolm III, is called Siward's kinswoman, not securely his daughter  # hand-checked starting points: earlier generations are semi-legendary
NONAME=re.compile(r'^(Q\d+|unnamed|unknown|NN\b|N\.N\.)',re.I)
for x,p in A.items():
    c=pid(x)
    if not re.match(r'^Q\d+$',x):continue
    if c in ROOTS or NONAME.match(p['name']):continue
    have=PAR.setdefault(c,[])
    filled={sex.get(QID.get(h,h)) for h in have}
    slots=defaultdict(list)
    for y,v in p['par'].items():
        if (x,y) in BLOCK:continue
        if not re.match(r'^Q\d+$',y) or NONAME.match(A.get(y,{}).get('name','Q')):continue
        if c in names and y in ID and f'{c}>{ID[y]}' not in OLDE:continue  # links between hand-entered people come from the hand-checked tree only
        bad=not sane(x,y,v['prop'])
        if bad:dropped.append((names.get(c,p['name']),A.get(y,{}).get('name',y)))
        slots[v['prop']].append((y,dict(v,bad=bad)))
    for prop,lst in slots.items():
        if c in OLDPAR and (len(OLDPAR[c])>=2 or None in filled or prop in filled or any(pid(y) in have for y,_ in lst)):continue  # hand-checked wins
        for y,v in lst:
            e=f'{c}>{pid(y)}'
            if pid(y) in have:continue
            have.append(pid(y))
            if len(lst)>1 or v['circ'] or v['bad'] or (x,y) in DOUBT:UNS.add(e)
print('implausible links flagged:',len(dropped),dropped[:15],file=sys.stderr)
# break cycles
state={};
def dfs(x):
    st=[(x,iter(PAR.get(x,[])))];state[x]=1
    while st:
        n,it=st[-1]
        for p in it:
            if state.get(p)==1:PAR[n].remove(p);print('cycle cut',n,p,file=sys.stderr);break
            if p not in state:state[p]=1;st.append((p,iter(list(PAR.get(p,[]))) ));break
        else:state[n]=2;st.pop()
for x in list(PAR):
    if x not in state:dfs(x)
# drop everyone born (or estimated born, 30 years a generation) before 700: earlier pedigrees are largely legendary
CUT=700
CH0=defaultdict(list)
for c,ps in PAR.items():
    for p in ps:CH0[p].append(c)
est={}
def estimate(x):
    st=[x]
    while st:
        n=st[-1]
        if n in est:st.pop();continue
        a=A.get(QID.get(n,n),{});b=a.get('born');d=a.get('died')
        if b is not None:est[n]=b;st.pop();continue
        if d is not None:est[n]=d-50;st.pop();continue
        todo=[c for c in CH0[n] if c not in est]
        if todo:st.extend(todo);continue
        est[n]=min((est[c] for c in CH0[n]),default=9999)-30;st.pop()
    return est[x]
allp=set(PAR)|{p for ps in PAR.values() for p in ps}
gone={x for x in allp if estimate(x)<CUT and x not in names}
for c in list(PAR):
    if c in gone:del PAR[c]
    else:PAR[c]=[p for p in PAR[c] if p not in gone]
print('dropped as before',CUT,len(gone),file=sys.stderr)
nodes=set(PAR)|{p for ps in PAR.values() for p in ps}
CH=defaultdict(list)
for c,ps in PAR.items():
    for p in ps:CH[p].append(c)
def up(s,sure=False):
    d={s:0};via={};q=deque([s])
    while q:
        x=q.popleft()
        for p in PAR.get(x,[]):
            if sure and f'{x}>{p}' in UNS:continue
            if p not in d:d[p]=d[x]+1;via[p]=x;q.append(p)
    return d,via
UP={m:up(m) for m in MON};UPS={m:up(m,True) for m in MON}
keep=set(MON)|set(names)
# between monarchs: descendants of a monarch that are ancestors of a monarch
anc_of_any=set().union(*[set(UP[m][0]) for m in MON])
desc=set();q=deque(MON)
while q:
    x=q.popleft()
    for c in CH[x]:
        if c not in desc:desc.add(c);q.append(c)
B=desc&anc_of_any
# the line the page follows: at each step the parent whose ancestry reaches back earliest, then the fewest generations
far={}
def reach(x):
    st=[x]
    while st:
        n=st[-1];ps=[p for p in PAR.get(n,[]) if f'{n}>{p}' not in UNS]
        todo=[p for p in ps if p not in far]
        if todo:st.extend(todo);continue
        far[n]=min([(far[p][0],far[p][1]+1) for p in ps] or [(estimate(n),1)]);st.pop()
    return far[x]
for n in nodes:reach(n)
for c in PAR:
    o=OLDPAR.get(c,[])  # hand-checked parents keep their curated order, ahead of Wikidata's
    PAR[c].sort(key=lambda p:(o.index(p) if p in o else len(o),f'{c}>{p}' in UNS,far[p]))
for m in MON:
    x=m
    while x:keep.add(x);x=(PAR.get(x) or [None])[0]
# nearest shared ancestors for every pair, as the page computes them
def down(via,to,c):
    p=[c];x=c
    while x!=to:x=via[x];p.append(x)
    return p
for i,S in enumerate(MON):
    dS,vS=UP[S]
    for X in MON:
        if X==S:continue
        dX,vX=UP[X];best=None
        common=sorted(dX.keys()&dS.keys())
        for c in common:
            if True:
                sc=(-1000 if c==S else 0)+dS[c]+dX[c]
                if best is None or sc<best[0]:best=(sc,c)
        if not best:continue
        c=best[1];pS=down(vS,S,c);pX=down(vX,X,c)
        # also every shared ancestor tied for nearest (the other parent of a couple)
        for c2 in common:
            if dS[c2]==dS[c] and dX[c2]==dX[c]:keep.add(c2)
        keep.update(pS);keep.update(pX)
        for n in (pS[1:2]+pX[1:2]):keep.update(PAR.get(n,[]))
        # shortest ancestor route
        if X in dS:
            p=down(vS,S,X);keep.update(p)
            dS2,vS2=UPS[S]
            if X in dS2:keep.update(down(vS2,S,X))
ROUTES={}
for S in MON:
    dS=UP[S][0];memo={S:1}
    def cnt(x):
        st=[x]
        while st:
            n=st[-1]
            if n in memo:st.pop();continue
            kids=[c for c in CH[n] if c in dS]
            todo=[c for c in kids if c not in memo]
            if todo:st.extend(todo);continue
            memo[n]=sum(memo[c] for c in kids);st.pop()
        return memo[x]
    ROUTES[S]={A_:cnt(A_) for A_ in MON if A_!=S and A_ in dS}
print('max routes',max((v,s_,a) for s_,d in ROUTES.items() for a,v in d.items()),file=sys.stderr)
print('nodes total',len(nodes),'kept',len(keep),file=sys.stderr)
out_par={c:[p for p in PAR.get(c,[]) if p in keep] for c in sorted(keep) if PAR.get(c)}
out_par={c:ps for c,ps in out_par.items() if ps}
def note(x):
    if x in OLDN:return OLDN[x][1]
    p=A.get(QID.get(x,x),{});d=p.get('desc','') or ''
    d=d[0].upper()+d[1:] if d else ''
    d=re.sub(r'\s*\(\s*-?\d+\s*[–-]\s*-?\d*\s*\)\s*$','',d)
    if len(d)>60:d=''
    yd=p.get('died');return (d+(', ' if d and yd else '')+(f'd. {yd}' if yd else '')) if (d or yd) else ''
outN={}
for x in sorted(keep):
    if x in MON:continue
    nm=names.get(x) or A.get(x,{}).get('name',x)
    outN[x]=[nm,note(x)]
wd={x:QID[x] for x in sorted(keep) if x in QID}
U=sorted(e for e in UNS if e.split('>')[0] in out_par and e.split('>')[1] in out_par[e.split('>')[0]])
js='// generated by the tree build from Wikidata and the hand-checked links; do not edit by hand\n'
js+='const N='+json.dumps(outN,ensure_ascii=False,separators=(',',':'))+';\n'
js+='const PAR='+json.dumps(out_par,ensure_ascii=False,separators=(',',':'))+';\n'
js+='const UNSURE=new Set('+json.dumps(U,separators=(',',':'))+');\n'
js+='const WDQ='+json.dumps(wd,separators=(',',':'))+';\n'
js+='const ROUTES='+json.dumps(ROUTES,separators=(',',':'))+';\n'
js+='const OLDLINK=new Set('+json.dumps(sorted(e for e in OLDE),separators=(',',':'))+');\n'
open('tree.js','w').write(js)
print('size',len(js.encode()),'people',len(outN)+len(MON),'unsure',len(U),file=sys.stderr)
if '--lines' in sys.argv:
    for m in ['charles3','william1','alfred','henry2','elizabeth1']:
        x=m;ch=[]
        while x:ch.append(x);x=(out_par.get(x) or [None])[0]
        print(m,len(ch),' < '.join(f"{(outN.get(y,[names.get(y,y)])[0])}({(A.get(QID.get(y,y)) or {}).get('born')})" for y in ch[-12:]))
