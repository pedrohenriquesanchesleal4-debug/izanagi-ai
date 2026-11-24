# References — Automation Engineer

Curadoria canônica para automação profissional. URLs verificadas — **nunca invente URLs além destas**. Pesquise na web antes de implementar padrões conhecidos.

## Documentação oficial por domínio

| Domínio | Recurso | URL |
|---|---|---|
| Dados/planilhas | pandas docs | https://pandas.pydata.org/docs |
| Planilhas Excel | openpyxl docs | https://openpyxl.readthedocs.io |
| HTTP | httpx docs | https://www.python-httpx.org |
| HTTP | requests docs | https://requests.readthedocs.io |
| Browser automation | Playwright Python | https://playwright.dev/python/docs/intro |
| Browser automation | Selenium | https://www.selenium.dev/documentation/ |
| Scraping | BeautifulSoup | https://www.crummy.com/software/BeautifulSoup/bs4/doc/ |
| Validação | Pydantic | https://docs.pydantic.dev |
| ORM | SQLAlchemy | https://docs.sqlalchemy.org |
| Variáveis de ambiente | python-dotenv | https://github.com/theskumar/python-dotenv |
| Testes | pytest | https://docs.pytest.org |
| Testes E2E | pytest-playwright | https://playwright.dev/python/docs/test-runners |

## Padrões de arquitetura de automação

- **API-first**: sempre preferir API oficial a browser automation (docs oficiais da API do serviço alvo).
- **Idempotência**: checkpoints e estado para reexecução segura — ver `error-recovery` skill.
- **Retries com backoff**: `tenacity` (https://tenacity.readthedocs.io) — retry com expoencial e jitter, apenas para erros recuperáveis.
- **ETL**: pipeline de extração → transformação → carga com validação em cada etapa — ver `data-engineering` skill.
- **12-Factor App — Config**: configuração via variáveis de ambiente (https://12factor.net/config).
- **Logging estruturado**: módulo `logging` do Python com formato JSON quando útil — ver `logging-expert` skill.

## Anti-padrões a evitar

- `except: pass` — nunca silenciar erros.
- Credenciais hardcoded no código ou em arquivos versionados.
- Browser automation quando existe API.
- Clicar 1 registro por vez quando a API aceita lote.
- Sem validação de resultado após ações (assumir sucesso sem verificar).

## Como usar

- Consultar este skill sempre que a tarefa envolver automação de dados, browser, API ou ETL.
- Pesquisar na web a documentação oficial atualizada do serviço/ferramenta alvo antes de implementar.
