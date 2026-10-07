import json
F = 'lib/decisao-proxy.ts'; R = 'repos/erp-shell'
CHAMADA = "    if (ehFragmento(caminho)) return { acao: 'nao-encontrado' }\n"
ESTAT = "    if (caminho.toLowerCase().startsWith(zona.prefixoEstatico)) {"
COOKIE_FIM = "    if (!temCookieSessao) {\n      return { acao: 'redirecionar-login', destino: paraLogin(caminho) }\n    }\n\n    return prosseguirComRenovacao(contexto, renovar, nonce)\n  }"
REGEX = "const FRAGMENTO = /^\\/[^/]+\\/_fragmento(?:\\/|$)/i"
DEC = "try { decodificado = decodeURIComponent(caminho) } catch { /* `%` solto: fica como veio */ }"
m = [
 dict(id='S1', nota='exigida: remover a chamada', antes=CHAMADA, depois=''),
 dict(id='S2', nota='exigida: tirar o /i', antes=REGEX, depois=REGEX[:-1]),
 dict(id='S3', nota='exigida: tirar o decodeURIComponent', antes=DEC, depois=''),
 dict(id='S4a', nota='exigida: mover para depois da sonda', antes=CHAMADA, depois='', antes2=ESTAT, depois2=CHAMADA + ESTAT),
 dict(id='S4b', nota='exigida: mover para depois do cookie', antes=CHAMADA, depois='', antes2=COOKIE_FIM,
      depois2=COOKIE_FIM.replace("    return prosseguirComRenovacao", CHAMADA + "    return prosseguirComRenovacao")),
 dict(id='S4c', nota='variante: mover para depois do corte de estatico', antes=CHAMADA, depois='', antes2="    if (!temCookieSessao) {\n      return { acao: 'redirecionar-login', destino: paraLogin(caminho) }\n    }\n\n    return prosseguirComRenovacao(contexto, renovar, nonce)\n  }",
      depois2=CHAMADA + "    if (!temCookieSessao) {\n      return { acao: 'redirecionar-login', destino: paraLogin(caminho) }\n    }\n\n    return prosseguirComRenovacao(contexto, renovar, nonce)\n  }"),
 dict(id='S5a', nota='variante: sem a ancora de fim de segmento', antes=REGEX, depois="const FRAGMENTO = /^\\/[^/]+\\/_fragmento/i"),
 dict(id='S5b', nota='variante: _fragmento em qualquer segmento', antes=REGEX, depois="const FRAGMENTO = /\\/_fragmento(?:\\/|$)/i"),
 dict(id='S5c', nota='variante: testa o caminho cru, decodificado ignorado', antes="  return FRAGMENTO.test(decodificado)", depois="  return FRAGMENTO.test(caminho)"),
 dict(id='S5d', nota='variante: decodeURI no lugar de decodeURIComponent', antes="decodificado = decodeURIComponent(caminho)", depois="decodificado = decodeURI(caminho)"),
 dict(id='S5e', nota='variante: % solto vira "nao e fragmento"', antes="catch { /* `%` solto: fica como veio */ }", depois="catch { return false }"),
 dict(id='S5f', nota='variante: so o prefixo exato /zona2', antes=REGEX, depois="const FRAGMENTO = /^\\/zona2\\/_fragmento(?:\\/|$)/i"),
 dict(id='S5g', nota='variante: guarda devolve prosseguir', antes="return { acao: 'nao-encontrado' }\n", depois="return { acao: 'prosseguir', nonce }\n"),
]
for x in m: x.update(repo=R, arquivo=F, modos=['unit'])
json.dump(m, open('shell_unit.json', 'w'), ensure_ascii=False, indent=1)
