import json,re,collections
from lemminflect import getAllLemmas
raw=json.load(open('freq.json'))
tier={w:t for w,t,z in raw}; freq={w:z for w,t,z in raw}
common={w for w,t,z in raw if t<=40 and z>=3.0}
vocab=set(tier)
PRE=['un','re','dis','mis','pre','non','over','under','out','up','in','im','il','ir','de','anti','fore','sub','super','inter','semi','counter','co','en','em','be','a']
SUF=['s','es','ed','d','ing','er','ers','r','rs','est','st','ly','y','ness','ment','ments','ful','fully','less','lessly','able','ably','ible','ish','ship','ships','ism','ist','ists','al','ally','ion','ions','or','ors','en','ens','ened','ening','ity','ies','ier','iest','ily','ily','ous','ive','ives','ise','ised','ises','ising','ize','hood','like','ward','wards','th','ty','man','men']
pairs=[]
for W in vocab:
    n=len(W)
    for i in range(0,n):
        for j in range(i+4,n+1):
            if j-i==n: continue
            w=W[i:j]
            if w not in vocab: continue
            p=W[:i]; q=W[j:]
            if p and p not in PRE: continue
            # allow doubled final consonant before suffix
            q2=q
            if q and q[0]==w[-1] and w[-1] not in 'aeiou' and q[1:] in SUF: q2=q[1:]
            if q2 and q2 not in SUF: continue
            pairs.append((W,w,p,q))
print(len(pairs))
json.dump(pairs,open('cand.json','w'))
def lem(W):
    s=set()
    for k,v in getAllLemmas(W).items(): s|=set(v)
    return s
print({w:lem(w) for w in ['bills','number','early','shower','forest','chased','stopped','biggest','evening','pants']})
