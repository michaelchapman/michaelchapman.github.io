# Builds stems.json: longer word -> shorter words inside it that share its stem.
# Inflections come from a lemmatiser. Derivations and prefixes come from hand-reviewed allow lists.
# Anything unreviewed is left out, so the worst case is a player finding the short word themselves.
import json,collections
from lemminflect import getAllLemmas
pairs=json.load(open('cand.json'))
freq={w:z for w,t,z in json.load(open('freq.json'))}
def lem(W):
    s=set()
    for v in getAllLemmas(W).values(): s|=set(v)
    return s
EXC=set('''cares>caress discus>discuss pant>pants game>gamer base>baser even>evening gent>gently pear>pearly home>homely
matt>matts matt>matting matt>matted leas>leases leas>leasing wast>wasted wast>wasting tens>tenses tens>tensed trad>traded trad>trading
grad>grading sens>sensed sens>senses shad>shaded slid>sliding writ>writing writ>writes shin>shining shin>shined less>unless cove>uncover
sage>sagely mere>merely wont>wonted lech>leched moil>moiled bate>bated hale>haled lave>laved wive>wived vice>viced rare>rared rare>rares
rime>rimed tare>tared dude>duded grit>grits sett>setts sous>sousing curs>cursing lour>loured lour>lours lour>louring ding>dinging fink>finking
cloth>clothes hear>hearth sing>singly must>musty ration>rational face>interface'''.split())
SUFFIX_OK='''
bale>baler bike>biker bite>biter blame>blamer care>carer cause>causer change>changer close>closer dance>dancer decide>decider dine>diner drive>driver
enlarge>enlarger erase>eraser fake>faker file>filer frame>framer free>freer gaze>gazer give>giver grade>grader hate>hater hide>hider hike>hiker
impose>imposer intrude>intruder joke>joker late>later like>liker line>liner lone>loner lose>loser merge>merger mine>miner move>mover pace>pacer pipe>piper
place>placer pose>poser race>racer rate>rater rave>raver receive>receiver ride>rider rise>riser rule>ruler save>saver score>scorer scrape>scraper
serve>server share>sharer size>sizer skate>skater slide>slider strike>striker take>taker tease>teaser teenage>teenager time>timer tone>toner trace>tracer
treasure>treasurer tune>tuner vote>voter wade>wader waste>waster wipe>wiper write>writer
cool>cooler convert>converter deal>dealer develop>developer drink>drinker dump>dumper extend>extender fill>filler find>finder fish>fisher flood>flooder
foreign>foreigner gulp>gulper hack>hacker hang>hanger hawk>hawker heat>heater help>helper hold>holder hunt>hunter join>joiner lead>leader lift>lifter mend>mender
mount>mounter pass>passer point>pointer poison>poisoner raid>raider ranch>rancher read>reader rent>renter riot>rioter roar>roarer scorn>scorner seal>sealer
seed>seeder sell>seller shoot>shooter sign>signer sing>singer surf>surfer talk>talker till>tiller turn>turner wait>waiter walk>walker warm>warmer yawn>yawner
boss>bossy bulk>bulky dust>dusty fault>faulty frost>frosty funk>funky greed>greedy hair>hairy loft>lofty luck>lucky mess>messy might>mighty milk>milky mist>misty
mood>moody mould>mouldy must>musty pick>picky rain>rainy reed>reedy risk>risky rock>rocky silk>silky soot>sooty sulk>sulky touch>touchy discover>discovery
honest>honesty full>fully dull>dully droll>drolly blood>bloody news>newsy
fiction>fictional nation>national notion>notional ration>rational rent>rental lyric>lyrical ethic>ethical botanic>botanical optic>optical orient>oriental
addict>addiction direct>direction elect>election evict>eviction select>selection collect>collector connect>connector detect>detector edit>editor survey>surveyor
defect>defective detect>detective elect>elective select>selective react>reactive enjoy>enjoyment move>movement repay>repayment faith>faithful grace>graceful
help>helpful right>rightful deaf>deafen lead>leaden neat>neaten sick>sicken wood>wooden eleven>eleventh sixteen>sixteenth four>fourth grow>growth humid>humidity
child>childish space>spaceship port>portable urban>urbanise leak>leakier meat>meatier peat>peatier silk>silkier word>wordier thin>thinner snap>snappy grit>gritty
boss>bossily rebel>rebellion level>leveller admit>admitted commit>committed spot>spotted emit>emitter spot>spotter fisher>fishermen true>truest rife>rifest
just>justest swim>swimming stir>stirring clip>clipping trap>trapping slip>slipper trial>trialled confer>conferrer organ>organise
'''.split()
PREFIX_OK='''
activate>reactivate activated>reactivated charge>recharge charges>recharges claim>reclaim design>redesign designs>redesigns dial>redial does>redoes draw>redraw
drew>redrew edit>reedit form>reform formed>reformed fresh>refresh grade>regrade hire>rehire hiring>rehiring house>rehouse laid>relaid name>rename named>renamed
names>renames open>reopen opened>reopened paid>repaid payment>repayment payments>repayments pays>repays place>replace placed>replaced placing>replacing read>reread
sale>resale seed>reseed seeds>reseeds send>resend sets>resets sewn>resewn sews>resews size>resize spray>respray state>restate states>restates string>restring
strings>restrings taking>retaking teach>reteach ties>reties took>retook trial>retrial tries>retries unite>reunite used>reused using>reusing view>review viewing>reviewing
visit>revisit warm>rewarm wind>rewind maps>remaps
appear>disappear credit>discredit like>dislike liked>disliked paid>prepaid view>preview viewing>previewing does>overdoes dose>overdose wear>underwear post>outpost
front>upfront proper>improper capable>incapable finite>infinite able>enable large>enlarge larger>enlarger rich>enrich title>entitle titled>entitled titles>entitles
fold>enfold folding>enfolding case>encase trap>entrap trapping>entrapping wake>awake waken>awaken wakening>awakening form>deform grade>degrade grading>degrading
labour>belabour hold>behold body>embody face>interface
'''.split()
OK=set(SUFFIX_OK)|set(PREFIX_OK)
acc=collections.defaultdict(set); rej=0
for W,w,p,q in pairs:
    key=f'{w}>{W}'
    if key in EXC: continue
    L=lem(W); ok=False
    if key in OK: ok=True
    elif not p:
        if w in L and W not in L: ok=True
        elif q=='s' and not w.endswith('s'): ok=True
        elif q=='es' and w.endswith(('ss','x','z','ch','sh','o')): ok=True
        elif q in('d','ed','ing') or (len(q)>2 and q[0]==w[-1] and q[1:] in('ed','ing')): ok= w in L and (q!='d' or w.endswith('e'))
        elif q=='ly': ok=True
    elif p=='un' and not q: ok=True
    if ok: acc[W].add(w)
    else: rej+=1
# closure through the vocabulary, so RECHARGES finds CHARGE even without RECHARGE on the board
def close(W,seen=None):
    seen=seen if seen is not None else set()
    for w in acc.get(W,()):
        if w not in seen: seen.add(w); close(w,seen)
    return seen
out={W:sorted(close(W)) for W in acc}
json.dump(out,open('stems.json','w'))
print('words with stems',len(out),'rejected',rej)
for t in ['bills','unbelievable','unbelievably','forest','stages','biggest','recharges','staring','stared','singers','hated','early','number','evening','there','during','pictured','stopped','belly']:
    print(t,out.get(t))
