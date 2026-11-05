// Tiers from SCOWL: common-to-all English + British-only spellings. American-only spellings never enter.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const w = require('wordlist-english');
const naughty = require('naughty-words');
const tiers = [10,20,35,40,50,55,60];
const seen = new Map();
for (const t of tiers) for (const k of [`english/${t}`, `english/british/${t}`]) for (const x of w[k]) {
  if (!/^[a-z]+$/.test(x) || x.length < 4 || x.length > 12) continue;
  if (!seen.has(x)) seen.set(x, t);
}
const usOnly = new Set(); for (const t of [...tiers,70]) for (const x of w[`english/american/${t}`]) usOnly.add(x);
const extra = `arse arses bollock bollocks bugger buggers bugger shit shits crap craps piss pissed pisses turd turds wank wanks wanker
twat twats cunt cock cocks dick dicks tits titty boob boobs nipple nipples penis penises vagina vaginas anus anal semen sperm sperms pube pubes pubic
rape raped rapes rapist rapists raping incest pedo paedo whore whores slut sluts tart tarts hooker hookers pimp pimps porn porno horny sexy erotic orgy orgies
nazi nazis hitler slave slaves coon coons spic spics dago dagos gook gooks wogs kike kikes dyke dykes fags faggot homo homos paki pakis nigger negro negroes
retard retards spaz spastic cripple cripples midget midgets lesbo tranny gypsy gypsies jews jewess heil suicide suicides genocide lynch lynched lynching
kill kills killed killer killers murder murders corpse corpses bomb bombs bombed
sodom sodomy bitch bitches bastard bastards damn damned hell pussy pussies bloody blowjob fuck
nude nudes naked strip strips stripper rectum feces faeces urine puke vomit vomits herpes syphilis cancer cancers tumour tumours
heroin cocaine opium crack meth
`.split(/\s+/).filter(Boolean);
const block = new Set([...naughty.en.flatMap(s=>s.toLowerCase().split(/\s+/)), ...extra]);
for(const b of [...block]) if(b.length>2) for(const e of ['s','es','ed','ing','er','ers']) block.add(b+e);
for(const x of 'ting tings ares frat frats dork dorks dorm dorms hobo hobos jock jocks john johns puss shes feds mike bates peed lewd kink kinks kinky goon goons gals nuke nukes fart farts farted farting bums dope dopes babe babes sissy harem bras lite theta zeta decal decals chino chinos racist racists racism suicidal gunman gunmen gunshot gunshots shotgun shotguns slavery drug drugs drugged holocaust massacre massacres terrorist terrorists terrorism molest molested pervert perverts prostitute prostitutes prostitution abortion abortions abuser abusers abuse abused abuses torture tortured tortures hostage hostages assault assaults rapture sadist sadism fetish fetishes pedophile paedophile'.split(' ')) block.add(x);
for(const x of 'cum cums gonna wanna gotta outta kinda sorta dunno lemme gimme ain ya yall dang darn goddamn jizz tosser tossers minge nonce nonces'.split(' ')) block.add(x);
block.delete('strip'); block.delete('strips');block.delete('passes');block.delete('classes');for(const x of ['tartan','mastered','tarted','hellos','tinged','bombing']) block.delete(x); block.delete('hell'); block.delete('crack'); block.delete('tart'); block.delete('tarts'); block.delete('bloody');
const out = [...seen].filter(([x]) => !usOnly.has(x) && !block.has(x));
fs.writeFileSync('tiers.json', JSON.stringify(out));
console.log(out.length, 'british ok:', ['colour','centre','aluminium','theatre','grey','tyre','kerb','plough','color','center','theater','gray','tire','plow','organise','organize','mould','cheque','check','favour'].map(x=>x+':'+(seen.get(x)||'-')+(usOnly.has(x)?'(US)':'')).join(' '));
