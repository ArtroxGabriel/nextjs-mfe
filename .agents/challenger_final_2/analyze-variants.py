import json, re, collections
L=lambda p:[json.loads(l) for l in open(p)]
m=lambda s: re.sub(r'/_next/data/[A-Za-z0-9_-]{21}/', '/_next/data/<B>/', s)
sick=L('variants-oracle-sick.jsonl'); heal=L('variants-oracle-healthy.jsonl'); up=L('variants-zone-up.jsonl'); down=L('variants-zone-down.jsonl')
f1s=L('../challenger_final_1/variants-oracle-sick.jsonl'); f1h=L('../challenger_final_1/variants-oracle-healthy.jsonl'); f1d=L('../challenger_final_1/variants-zone-down.jsonl')
m26=L('../challenger_m2_6/variants-oracle-sick.jsonl'); m26h=L('../challenger_m2_6/variants-oracle-healthy.jsonl')
key=lambda r:(r['method'], m(r['target']), json.dumps(r.get('headers') or {}, sort_keys=True))
m26k={key(r):r for r in m26}; m26hk={key(r):r for r in m26h}
f1k={key(r):r for r in f1s}; f1hk={key(r):r for r in f1h}
reached=lambda r: bool(r['zoneSaw']) or r['mark']=='ZONE-REACHED'
print('== totals')
print('sick zoneReached', sum(map(reached,sick)), '| healthy zoneReached', sum(map(reached,heal)))
zb=[i for i,r in enumerate(heal) if reached(r)]
print('zone-bound (healthy reached):', len(zb), '; of these in sick -> status', collections.Counter((sick[i]['status'],sick[i]['ct'],sick[i]['ra']) for i in zb))
print('zone-bound in zone-down -> ', collections.Counter((down[i]['status'],down[i]['ct']) for i in zb))
print('zone-down any 500:', [(r['id'],r['target'],r['status'],r['ct']) for r in down if r['status']==500])
print('zone-down bare 500 (no content-type):', sum(1 for r in down if r['status']==500 and r['ct'] is None))
diff=[(i,sick[i]['target'],sick[i]['status'],down[i]['status']) for i in range(len(sick)) if (sick[i]['status'],sick[i]['ct'])!=(down[i]['status'],down[i]['ct'])]
print('sick vs zone-down status/ct differences:', diff)
print('== over-blocking: NOT zone-reached when healthy, but 503 when sick')
ob=[i for i,r in enumerate(heal) if not reached(r) and sick[i]['status']==503]
for i in ob:
  k=key(sick[i]); a=f1k.get(k); b=m26k.get(k)
  print(f"{i:3} ext={int(sick[i]['ext'])} {sick[i]['method']:4} {sick[i]['target'][:70]:70} healthy={heal[i]['status']} {str(heal[i]['ct'])[:9]} up={up[i]['status']} | 90e8319 sick={a['status'] if a else '-'} | 94ccdc2 sick={b['status'] if b else '-'}")
print('count', len(ob), 'ext', sum(1 for i in ob if sick[i]['ext']))
print('== base ids: final_2 sick vs final_1 sick (status changes)')
ch=collections.Counter()
for i in range(316):
  a=f1s[i]; b=sick[i]
  sa='ZONE' if reached(a) else a['status']; sb='ZONE' if reached(b) else b['status']
  if sa!=sb: ch[(sa,sb)]+=1; print(f"  {i:3} {b['method']:4} {b['target'][:70]:70} {sa} -> {sb}")
print(ch)
print('== shell-owned (not reached when healthy) status in sick vs healthy, differences other than ->503')
for i,r in enumerate(heal):
  if not reached(r) and sick[i]['status']!=503 and (sick[i]['status'],sick[i]['ct'])!=(r['status'],r['ct']): print('  ',i,r['target'],r['status'],sick[i]['status'])
