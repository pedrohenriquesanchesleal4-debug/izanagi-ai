# References — Systematic Debugging

> Curadoria (2026) de fontes canônicas para root cause analysis e debugging sistemático.

## Docs canônicas
- [git-bisect (git-scm.com)](https://git-scm.com/docs/git-bisect) — documentação oficial da busca binária por commit que introduziu a regressão (Fase 2 — Isolar)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/) — padrão aberto de instrumentação para tracing distribuído, hoje o principal fio condutor de debugging em sistemas com múltiplos serviços

## Metodologia de causa raiz
- [iSixSigma: Root Cause Analysis — Integrating Ishikawa Diagrams and the 5 Whys](https://www.isixsigma.com/cause-effect/root-cause-analysis-ishikawa-diagrams-and-the-5-whys/) — como combinar as duas técnicas: fishbone para mapear todas as causas candidatas, 5 Whys para aprofundar em cada uma até a causa raiz
- [GoLeanSixSigma: Fishbone Diagram](https://goleansixsigma.com/fishbone-diagram/) — diagrama de Ishikawa (criado por Kaoru Ishikawa nos anos 1960), categorias de causa e como construir um

## Debugging distribuído / observabilidade
- [Apica: Distributed Tracing Guide 2026](https://www.apica.io/blog/what-is-distributed-tracing-how-it-works-and-best-practices/) — como tracing substitui correlação manual de logs quando uma requisição atravessa dezenas de serviços

## Comunidade / tutoriais
- [ModernAnalyst: Root Cause Analysis Using a Fishbone Diagram and the Five Whys](https://www.modernanalyst.com/Resources/Articles/tabid/115/ID/5914/Root-Cause-Analysis-Using-a-Fishbone-Diagram-and-the-Five-Whys.aspx) — walkthrough aplicado das duas técnicas juntas
