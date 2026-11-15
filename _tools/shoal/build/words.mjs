// The dictionary. Every word here is classed as one of:
//   ''      accepted: SCOWL up to size 70, common-to-all English plus British spellings
//   'us'    American-only spelling
//   'block' rude or sensitive
//   'ghost' only in the 274k word-list package (mostly Scrabble-only words)
// Accepted words are the game's dictionary. The generator refuses any board on which a blocked word, an American
// spelling or a familiar-looking ghost word could be formed, so the game never has to reject a real word.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const w = require('wordlist-english');
const naughty = require('naughty-words');
const tiers = [10,20,35,40,50,55,60,70];
const ok = s => /^[a-z]+$/.test(s) && s.length >= 4 && s.length <= 12;
const seen = new Map();
for (const t of tiers) for (const k of [`english/${t}`, `english/british/${t}`]) for (const x of w[k]) if (ok(x) && !seen.has(x)) seen.set(x, t);
const usOnly = new Set(); for (const t of tiers) for (const x of w[`english/american/${t}`]) if (ok(x) && !seen.has(x)) usOnly.add(x);
const extra = `arse arses bollock bollocks bugger buggers shit shits crap craps piss pissed pisses turd turds wank wanks wanker
twat twats cunt cock cocks dick dicks tits titty boob boobs nipple nipples penis penises vagina vaginas anus anal semen sperm sperms pube pubes pubic
rape raped rapes rapist rapists raping incest pedo paedo whore whores slut sluts hooker hookers pimp pimps porn porno horny sexy erotic orgy orgies
nazi nazis hitler slave slaves coon coons spic spics dago dagos gook gooks wogs kike kikes dyke dykes fags faggot homo homos paki pakis nigger negro negroes
retard retards spaz spastic cripple cripples midget midgets lesbo tranny gypsy gypsies jews jewess heil suicide suicides genocide lynch lynched lynching
kill kills killed killer killers murder murders corpse corpses bomb bombs bombed
sodom sodomy bitch bitches bastard bastards damn damned pussy pussies blowjob fuck
nude nudes naked stripper rectum feces faeces urine puke vomit vomits herpes syphilis cancer cancers tumour tumours
heroin cocaine opium meth
ting tings ares frat frats dork dorks hobo hobos jock jocks john johns puss shes feds mike bates peed lewd kink kinks kinky goon goons gals nuke nukes
fart farts farted farting bums dope dopes babe babes sissy harem bras lite decal decals chino chinos racist racists racism suicidal
gunman gunmen gunshot gunshots shotgun shotguns slavery drug drugs drugged holocaust massacre massacres terrorist terrorists terrorism molest molested
pervert perverts prostitute prostitutes prostitution abortion abortions abuser abusers abuse abused abuses torture tortured tortures hostage hostages
assault assaults sadist sadism fetish fetishes pedophile paedophile
cum cums gonna wanna gotta outta kinda sorta dunno lemme gimme yall dang darn goddamn jizz tosser tossers minge nonce nonces
terf terfs kcal cain etna cree pinko pinkos commie commies`.split(/\s+/).filter(Boolean);
// Only single-word entries from the naughty list: splitting its phrases would block words like DATE, COME and LOVE.
const block = new Set([...naughty.en.map(s => s.toLowerCase()).filter(s => /^[a-z]+$/.test(s)), ...extra]);
for (const b of [...block]) if (b.length > 2) for (const e of ['s','es','ed','ing','er','ers']) block.add(b+e);
for (const x of `butter butters buttered buttering spices spiced titer titers asses assed passes classes tartan mastered tarted hellos tinged bombing
  strip strips hell crack tart tarts bloody cocker cockers dicker homer homers coons sucker suckers suckered sucks sucked sucking domination
  dominations screwing screwed screws balls balled balling ballers baller hardcore hooked brass danger dangers tinge tinges tinging
  darning escort escorts escorted escorting snatch snatched snatches snatching fingering spicing sexes cocked cocking damning`.split(/\s+/)) block.delete(x);
// Exact words only (no endings added): names in disguise, slurs with an innocent twin, and words that read badly alone.
for (const x of `matt matts wales wale leas ponce ponces senile wench wenches bani yous thru macs mads reals debs gens gees quin quins
  stoner stoners toke tokes toked snot snots hots dumbo dumbos hick hicks veep veeps pees bonk bonks bonked coked gash lube lubes nips`.split(/\s+/)) block.add(x);
const out = [];
for (const [x,t] of seen) out.push([x, t, block.has(x) ? 'block' : '']);
for (const x of usOnly) out.push([x, 70, 'us']);
const have = new Set([...seen.keys(), ...usOnly]);
for (const x of fs.readFileSync('../node_modules/word-list/words.txt','utf8').split('\n')) if (ok(x) && !have.has(x)) out.push([x, 99, block.has(x) ? 'block' : 'ghost']);
for (const x of block) if (ok(x) && !have.has(x) && !out.some(o => o[0] === x)) out.push([x, 99, 'block']);
fs.writeFileSync('tiers.json', JSON.stringify(out));
const n = f => out.filter(o => o[2] === f).length;
console.log('accepted', n(''), 'us', n('us'), 'blocked', n('block'), 'ghost', n('ghost'));
console.log(['colour','centre','grey','tyre','color','center','gray','date','come','love','call','deep','eats','ones','butter','spices','kill','arse'].map(x => x+':'+((out.find(o => o[0] === x)||[])[2] ?? 'missing')).join(' '));
console.log('blocked words in SCOWL up to 40:', out.filter(o => o[2] === 'block' && o[1] <= 40).map(o => o[0]).sort().join(' '));
