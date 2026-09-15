import json
L=lambda p:[json.loads(l) for l in open(p)]
s,h,u,d=[L(f'variants-{x}.jsonl') for x in ['oracle-sick','oracle-healthy','zone-up','zone-down']]
R=lambda r:'ZONE' if (r['zoneSaw'] or r['mark']=='ZONE-REACHED') else str(r['status'])
print('id  meth target | healthy(zoneSaw) | sick | zone-up (ct,mark) | zone-down')
for i in range(316,len(s)):
  print(f"{i} {s[i]['method']:4} {s[i]['target'][:66]:66} | {R(h[i]):4} {str(h[i]['zoneSaw'] or '')[:40]:40} | {R(s[i])} | {u[i]['status']} {str(u[i]['ct'])[:10]} {u[i]['mark'][:14]} | {d[i]['status']} {str(d[i]['ct'])[:9]}")
