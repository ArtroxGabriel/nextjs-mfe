// Confere quais HTML ativos passam por ehHtmlInerte do @erp/nucleo 0.10.3 instalado na zona 1 (sem mudar o núcleo).
// node --conditions react-server inerte.mjs <caminho do dist/fabricas/fragmento.js>
const { ehHtmlInerte } = await import(process.argv[2])
const casos = [
  ['<script>alert(1)</script>', 'controle: script'],
  ['<img src=x onerror=alert(1)>', 'controle: espaco antes de on'],
  ['<img/onerror=alert(1) src=x>', 'barra no lugar do espaco'],
  ['<svg/onload=alert(1)>', 'svg com barra'],
  ['<svg onload=alert(1)>', 'controle: svg com espaco'],
  ['<body/onload=alert(1)>', 'body com barra'],
  ['<img src=x\nonerror=alert(1)>', 'quebra de linha (\\s casa)'],
  ['<img src="x"onerror=alert(1)>', 'aspas coladas, sem espaco'],
  ["<img src='x'onerror=alert(1)>", 'aspas simples coladas'],
  ['<details/open/ontoggle=alert(1)>', 'details ontoggle'],
  ['<a href="jav&#x61;script:alert(1)">x</a>', 'entidade em javascript:'],
  ['<a href="java\tscript:alert(1)">x</a>', 'tab dentro de javascript:'],
  ['<a href=" javascript:alert(1)">x</a>', 'controle: javascript: com espaco'],
  ['<form action="javascript&colon;alert(1)"><button>x</button></form>', 'entidade &colon;'],
  ['<math><maction actiontype="statusline" xlink:href="javascript:alert(1)">x</maction></math>', 'controle: javascript: literal'],
  ['<svg><animate onbegin=alert(1) attributeName=x dur=1s>', 'controle: onbegin com espaco'],
  ['<svg><set/onbegin=alert(1) attributename=x to=1>', 'set onbegin com barra'],
  ['<style>@import url(//evil)</style>', 'style (nao e script, mas e CSS externo)'],
  ['<link rel=stylesheet href=//evil>', 'link stylesheet'],
  ['<meta http-equiv=refresh content="0;url=//evil">', 'meta refresh'],
  ['<base href=//evil>', 'base href'],
  ['<form action=//evil><input name=x></form>', 'form para fora'],
  ['<img src=//evil/pixel>', 'imagem externa (vaza Referer)'],
]
for (const [html, nome] of casos) console.log(`${ehHtmlInerte(html) ? 'PASSA (inerte)' : 'recusado      '}  ${nome}: ${JSON.stringify(html)}`)
