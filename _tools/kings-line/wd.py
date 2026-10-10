import json,urllib.request,urllib.parse,os,hashlib,time
CACHE=os.path.join(os.path.dirname(os.path.abspath(__file__)),'cache');os.makedirs(CACHE,exist_ok=True)
def sparql(q):
    h=hashlib.md5(q.encode()).hexdigest();f=f'{CACHE}/{h}.json'
    if os.path.exists(f):return json.load(open(f))
    url='https://query.wikidata.org/sparql?'+urllib.parse.urlencode({'query':q,'format':'json'})
    for i in range(5):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'KingsLineBuild/1.0 (https://michaelchapman.me/kings-line/)'}),timeout=120)
            d=json.load(r)['results']['bindings'];json.dump(d,open(f,'w'));return d
        except Exception as e:
            print('retry',e);time.sleep(5*(i+1))
    raise SystemExit('sparql failed')
q=lambda u:u.rsplit('/',1)[1]
