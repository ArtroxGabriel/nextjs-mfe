import json,sys
for l in open(sys.argv[1]):
    r=json.loads(l)
    h=r.get('headers') or ''
    if h: h=list(h.items())[0][0]
    print(f"{r['id']:3} {r['method'][:4]:4} {str(r['status']):3} {str(r['ct'])[:9]:9} {str(r['ra'] or ''):1} {r['mark'][:14]:14} {r['target'][:62]} {h} {r['loc'] or ''} {'ZONESAW='+str(r['zoneSaw']) if r['zoneSaw'] else ''}")
