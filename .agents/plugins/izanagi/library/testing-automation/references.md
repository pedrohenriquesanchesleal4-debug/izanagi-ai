# References — Testing Automation

> Curadoria (2026) para testar automações: unitários, integração, E2E e dry-run com pytest.

## Docs canônicas
- [pytest docs](https://docs.pytest.org) — fixtures, parametrize, monkeypatch, tmp_path
- [Playwright for Python](https://playwright.dev/python/docs/intro) — E2E de browser headless
- [responses (mock HTTP)](https://github.com/getsentry/responses) — mock de chamadas httpx/requests

## Referências e inspiração
- [pytest-mock](https://pytest-mock.readthedocs.io) — monkeypatch de alto nível
- [coverage.py](https://coverage.readthedocs.io) — métrica de cobertura por linha/branch
- [Test doubles (Martin Fowler)](https://martinfowler.com/bliki/TestDouble.html) — fake vs stub vs mock

## Comunidade / tutoriais
- [Real Python: testing with pytest](https://realpython.com/pytest-python-testing/)
- [Test pyramid (Google)](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html) — unit > integração > E2E
- [pytest: how to test I/O](https://docs.pytest.org/en/stable/how-to/monkeypatch.html) — substituir sistemas externos
