import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceRegistry,
  inferEvidenceType,
  SOURCE_TRUST,
} from '../research/evidence.js';

test('evidence: inferência de tipo por texto e confiança', () => {
  assert.equal(inferEvidenceType('acho que isso funciona', 0.9), 'ASSUMPTION');
  assert.equal(inferEvidenceType('portanto, há N+1 no query', 0.9), 'INFERENCE');
  assert.equal(inferEvidenceType('a documentação oficial diz X', 0.9), 'FACT');
  assert.equal(inferEvidenceType('spec duvidosa', 0.4), 'UNKNOWN');
});

test('evidence: add com type implícito e confiança clampada', () => {
  const r = new EvidenceRegistry();
  const c = r.add({ claim: 'acho que o cache ajuda', confidence: 1.5, sourceType: 'community' });
  assert.equal(c.type, 'ASSUMPTION');
  assert.equal(c.confidence, 1);
  assert.ok(c.id);
});

test('evidence: verificação promove claim a FACT com fonte primária', () => {
  const r = new EvidenceRegistry();
  const c = r.add({ claim: 'acho que Prisma suporta this', confidence: 0.7, sourceType: 'community' });
  const verified = r.verify(c.id, 'official-docs');
  assert.equal(verified?.type, 'FACT');
  assert.equal(verified?.verified, true);
  assert.equal(verified?.confidence, SOURCE_TRUST['official-docs']);
});

test('evidence: score combina confiança e confiabilidade da fonte', () => {
  const r = new EvidenceRegistry();
  const weak = r.add({ claim: 'x', confidence: 0.9, sourceType: 'community' });
  const strong = r.add({ claim: 'y', confidence: 0.6, sourceType: 'source-code' });
  assert.ok(r.score(strong) > r.score(weak));
});

test('evidence: critical aponta UNKNOWN e confiança baixa', () => {
  const r = new EvidenceRegistry();
  r.add({ claim: 'spec incerta', confidence: 0.3, sourceType: 'community' });
  r.add({ claim: 'fato verificado', confidence: 0.95, sourceType: 'official-docs' });
  const critical = r.critical();
  assert.equal(critical.length, 1);
  assert.ok(critical[0].type === 'UNKNOWN' || r.score(critical[0]) < 0.6);
});

test('evidence: ingest aceita strings cruas e objetos em lote', () => {
  const r = new EvidenceRegistry();
  const n = r.ingest(['claim crua', { claim: 'estruturado', confidence: 0.8, sourceType: 'tests' }, 42]);
  assert.equal(n, 2);
  assert.equal(r.all().length, 2);
});

test('evidence: search por claim, source e tag', () => {
  const r = new EvidenceRegistry();
  r.add({ claim: 'JWT expira em 1h', confidence: 0.9, sourceType: 'official-docs', source: 'jsonwebtoken docs', tags: ['auth'] });
  assert.equal(r.search('jwt').length, 1);
  assert.equal(r.search('jsonwebtoken').length, 1);
  assert.equal(r.search('auth').length, 1);
  assert.equal(r.search('inexistente').length, 0);
});

test('evidence: relatório agrega tipos, fontes e melhores fontes', () => {
  const r = new EvidenceRegistry();
  r.add({ claim: 'per spec: endpoint suporta GET', confidence: 0.95, sourceType: 'official-docs' });
  r.add({ claim: 'acho que o rate limit é 60/min', confidence: 0.7, sourceType: 'community' });
  const report = r.report();
  assert.equal(report.total, 2);
  assert.equal(report.byType.FACT, 1);
  assert.equal(report.byType.ASSUMPTION, 1);
  assert.equal(report.bySourceType['official-docs'], 1);
  assert.equal(report.bestSources.length, 2);
  assert.equal(report.bestSources[0].sourceType, 'official-docs');
  assert.ok(report.critical.length >= 0);
});

test('evidence: toArtifact produz artefato research válido', () => {
  const r = new EvidenceRegistry();
  r.add({ claim: 'x', confidence: 0.9, sourceType: 'official-docs' });
  const art = r.toArtifact();
  assert.equal(art.kind, 'research');
  assert.ok(typeof art.content.total === 'number');
});