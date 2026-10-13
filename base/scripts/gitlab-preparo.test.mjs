import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ler = (caminho) => readFileSync(new URL(`../../${caminho}`, import.meta.url), 'utf8')
test('roteiro exige espelhos na mesma instancia antes de ativar o CI GitLab', () => {
  assert.match(ler('docs/REGISTRO-E-CI.md'), /submódulos precisam estar espelhados na mesma instância\s+GitLab/)
  assert.match(ler('.gitlab-ci.yml'), /GIT_SUBMODULE_STRATEGY: recursive/)
  assert.match(ler('.gitlab-ci.yml'), /GIT_SUBMODULE_FORCE_HTTPS: 'true'/)
})
test('textos novos de preparacao GitLab sem travessao', () => {
  for (const arquivo of ['docs/REGISTRO-E-CI.md', 'docs/CONFIGURACAO.md',
    'docs/adr/0016-registro-compartilhado-e-ci.md', 'docs/superpowers/plans/2026-10-13-gitlab-registro-e-ci.md', '.gitlab-ci.yml']) {
    const texto = ler(arquivo)
    const novo = arquivo === 'docs/CONFIGURACAO.md' ? texto.split('## 7. Registro de pacotes e CI')[1] : texto
    assert.ok(novo && !novo.includes('\u2014'), arquivo)
  }
})
