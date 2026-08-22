#!/usr/bin/env node
"use strict";

/**
 * Biblioteca de anti-racionalização do Izanagi AI — por categoria.
 *
 * Cada entrada é técnica, específica do domínio e alinhada às leis do
 * framework (zero stubs, TDD, anti AI-slop, entrega completa, erros nunca
 * silenciados). NADA aqui é genérico o suficiente para servir a dois
 * domínios diferentes: se uma racionalização couber em outra categoria,
 * ela está mal escrita — corrija-a, não reutilize-a.
 *
 * Formato:
 *   rationalizations: [{ says: "<o que o dev pensa/diz>", truth: "<por que é falso + custo real>" }]
 *   redFlags:        [string] — sinais observáveis no código/processo.
 */

export const CATEGORIES = [
  "engineering",
  "testing",
  "security",
  "design",
  "docs",
  "devops",
  "data",
  "ai",
];

export const CATEGORY_LABELS_PT = {
  engineering: "Engenharia",
  testing: "Testes & QA",
  security: "Segurança",
  design: "Design & UI",
  docs: "Documentação & Comunicação",
  devops: "DevOps & Operação",
  data: "Dados",
  ai: "IA & Agentes",
};

export const RATIONALIZATIONS = {
  engineering: {
    rationalizations: [
      {
        says: "É só um protótipo, refatoro depois.",
        truth:
          "Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.",
      },
      {
        says: "Compila (ou rodou uma vez), então funciona.",
        truth:
          "Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.",
      },
      {
        says: "Caso extremo nunca vai acontecer.",
        truth:
          "Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.",
      },
      {
        says: "Abstraio agora que depois fica fácil trocar.",
        truth:
          "Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.",
      },
      {
        says: "Copiei de um projeto que funcionava, deve servir.",
        truth:
          "Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.",
      },
      {
        says: "Sem tempo para tratar erro, lanço exceção genérica.",
        truth:
          "`except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.",
      },
    ],
    redFlags: [
      "Arquivo único gigante misturando I/O, regra de negócio e apresentação.",
      "Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.",
      "Stub, `TODO` ou função que retorna valor fixo em caminho de produção.",
      "Credencial, token ou path sensível hardcoded no fonte.",
      "Sucesso assumido sem verificar o resultado esperado da operação.",
      "Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).",
    ],
  },

  testing: {
    rationalizations: [
      {
        says: "Escrevo os testes depois que o código estabiliza.",
        truth:
          "'Depois' significa nunca — e o teste escrito após a implementação só confirma o que o código faz, não o que deveria fazer. TDD é lei: teste antes, veja falhar, código mínimo, refactor.",
      },
      {
        says: "Mockei tudo, suite verde, tá coberto.",
        truth:
          "Quando todo dependente é mock, o teste valida o mock contra ele mesmo. Integração real (API, banco, arquivo) precisa de pelo menos um teste que atravesse a borda verdadeira.",
      },
      {
        says: "Cobertura 90% prova qualidade.",
        truth:
          "Cobertura mede execução, não asserção. Linha percorrida sem expectativa forte é teatro. Métrica boa é teste que falha quando o comportamento quebra.",
      },
      {
        says: "Esse teste é flaky, vou dar skip pra destravar o pipeline.",
        truth:
          "Skip silencioso ensina a suíte a mentir. Flakiness tem causa (sleep fixo, ordem, rede) — investigue e conserte; `skip` sem issue aberta é falha escondida.",
      },
      {
        says: "QA vai pegar os bugs na revisão.",
        truth:
          "QA valida, não adivinha. Empurrar verificação para frente multiplica o custo de cada defeito e viola a autoavaliação obrigatória antes de entregar.",
      },
      {
        says: "Rodei localmente uma vez, comportamento confirmado.",
        truth:
          "Uma execução manual não é regressão. Sem teste automatizado, o mesmo bug volta no próximo refactor e ninguém percebe até produção.",
      },
    ],
    redFlags: [
      "Suíte verde com asserções fracas (`assert result != null`).",
      "Sleep/timeout fixo no lugar de espera condicional (flakiness programada).",
      "Testes que dependem de ordem de execução ou estado global compartilhado.",
      "Bug corrigido sem teste de regressão que o reproduza.",
      "Mock da própria unidade sob teste (testa a simulação, não o código).",
      "Snapshot/expectativa gerada do output atual sem revisão humana.",
      "Casos de teste pulados via skip/disable sem registro do motivo.",
    ],
  },

  security: {
    rationalizations: [
      {
        says: "Input interno é confiável, validação é para API pública.",
        truth:
          "A fronteira interna de hoje é a integração exposta de amanhã. Validar na fronteira onde o dado entra custa pouco; sanitizar após incidente custa caro.",
      },
      {
        says: "Estamos atrás de firewall/rede privada, estamos seguros.",
        truth:
          "Network perimeter falha comum: SSRF, credencial vazada e supply chain ignoram firewall. Camadas independentes (defense in depth) existem porque qualquer camada isolada falha sozinha.",
      },
      {
        says: "Logue tudo para facilitar debug, incluindo o payload.",
        truth:
          "Payload contém token, PII e credencial. Log é arquivo de leak esperando auditoria. Logging estruturado com redação é obrigação, não refinamento.",
      },
      {
        says: "Segurança agora trava o sprint; compensamos depois.",
        truth:
          "'Depois' em segurança é pós-incidente. OWASP Top 10 é lista de erros conhecidos e baratos de evitar na escrita, caríssimos de corrigir em produção.",
      },
      {
        says: "Valido no frontend, backend confia.",
        truth:
          "Frontend é sugestão, backend é contrato. Qualquer requisição pode ser forjada fora da UI; validação server-side é a única que existe de fato.",
      },
      {
        says: "Secrets em variável de código é temporário até o .env ficar pronto.",
        truth:
          "Temporário em código versionado é permanente no histórico do Git. Rotação de chave pós-leak dói muito mais que 10 minutos de configuração.",
      },
    ],
    redFlags: [
      "SQL/comando montado por concatenação de input.",
      "Token, cookie ou segredo aparecendo em log, URL ou mensagem de erro.",
      "Stacktrace cru retornado ao usuário (fingerprint da aplicação).",
      "Dependência sem verificação de CVE na atualização.",
      "Permissão/privilégio amplo demais 'para simplificar' (viola menor privilégio).",
      "Endpoint mutante sem autenticação, rate limit ou idempotency key.",
      "Criptografia caseira ou hash fraco (MD5/SHA1) para credencial.",
    ],
  },

  design: {
    rationalizations: [
      {
        says: "Design system a gente monta depois do launch.",
        truth:
          "Sem tokens decididos antes, cada componente nasce com escala própria e o 'depois' vira reescrita total. Direção de design primeiro é HARD-GATE do framework, não preferência.",
      },
      {
        says: "Inter serve, é neutra.",
        truth:
          "Inter default é o tell nº 1 de 'cara de IA'. Tipografia é decisão de identidade; neutra aqui significa sem intenção — e sem intenção é proibido.",
      },
      {
        says: "Responsivo eu ajusto no final, primeiro o desktop.",
        truth:
          "Layout pensado só em desktop quebra estruturalmente no mobile: grid, hierarquia e touch targets não se 'ajustam', se redesenham. Mobile-first é mais barato desde a primeira linha.",
      },
      {
        says: "Acessibilidade a gente adiciona quando tiver demanda.",
        truth:
          "Contraste, foco visível e ARIA são requisitos WCAG, não feature request. Retrofitar acessibilidade custa ordens de magnitude mais que nascer com ela.",
      },
      {
        says: "O cliente pediu hero com 3 cards, é isso que ele conhece.",
        truth:
          "O cliente pediu resultado, não template estatístico. Cabe ao craft traduzir o pedido em composição com identidade — hero+3cards+gradiente roxo é anti-padrão explícito do framework.",
      },
      {
        says: "Animação entra no fim, se sobrar tempo.",
        truth:
          "Motion signature decide-se no design, não decorase no deploy. Animação adicionada tarde é ornamento; planejada cedo é comunicação de hierarquia e estado.",
      },
    ],
    redFlags: [
      "Hero centralizado + fileira de 3 cards idênticos (composição estatística de IA).",
      "Gradiente roxo-azul como identidade visual principal.",
      "border-radius uniforme em todos os elementos, sem hierarquia formal.",
      "Contraste abaixo de WCAG AA em texto primário.",
      "Sem estados hover/focus/loading/error definidos nos componentes interativos.",
      "Tipografia default sem escolha declarada (peso, escala, par de fontes).",
      "Motion decorativo aleatório em vez de 1–2 momentos-chave com assinatura.",
    ],
  },

  docs: {
    rationalizations: [
      {
        says: "Código limpo se auto-documenta, comentário é redundância.",
        truth:
          "Código mostra o COMO, nunca o PORQUÊ nem o contrato de uso. README com instalação/execução/configuração é parte da entrega, não cortesia.",
      },
      {
        says: "README eu escrevo antes do publish.",
        truth:
          "Antes do publish é depois do esquecimento. Documentação escrita junto à implementação captura decisões que em 3 dias já não estão mais na memória.",
      },
      {
        says: "Doc envelhece rápido, então melhor nem escrever.",
        truth:
          "Doc desatualizada é corrigível; doc ausente é institucionalizada ignorância. O framework exige limitações conhecidas documentadas — honestidade sobre o que falta é conteúdo, não fraqueza.",
      },
      {
        says: "Só eu uso esse projeto, documento é overhead.",
        truth:
          "'Eu daqui a 6 meses' também é outro desenvolvedor. Handoff sem documentação transforma toda manutenção futura em arqueologia.",
      },
      {
        says: "Coloquei um exemplo genérico no README, serve.",
        truth:
          "Exemplo que não roda é pior que nenhum: ensina errado com autoridade. Todo comando documentado precisa ter sido executado de fato (zero falsificação).",
      },
      {
        says: "Referência eu completo depois, agora é só chute razoável.",
        truth:
          "URL inventada é alucinação documentada. Nunca entregue referência não verificada — pesquise ou declare explicitamente que não verificou.",
      },
    ],
    redFlags: [
      "README sem comando exato de instalação e execução testado.",
      "`.env.example` ausente num projeto que exige configuração.",
      "Documentação divergente do comportamento real do código.",
      "Seção 'Limitações' vazia ou omitida (finge completude).",
      "Link/referência citada sem verificação (risco de alucinação).",
      "Termo de domínio usado sem definição numa base nova.",
    ],
  },

  devops: {
    rationalizations: [
      {
        says: "Funciona na minha máquina, o problema é o ambiente.",
        truth:
          "Ambiente é parte do sistema. Sem IaC/container reproduzível, 'funciona aqui' é sintoma de config drift não diagnosticado — não é explicação, é o bug.",
      },
      {
        says: "Deploy manual hoje, pipeline depois que estabilizar.",
        truth:
          "Processo manual não estabiliza, fossiliza. Cada deploy manual adiciona um passo não versionado que o pipeline futuro terá que adivinhar.",
      },
      {
        says: "Monitoramento a gente implanta quando escalar.",
        truth:
          "Sem métrica baseline antes de escalar, degradação é invisível até o outage. Observabilidade é pré-condição de mudança, não resposta a incidente.",
      },
      {
        says: "Rollback nunca precisamos, pra que testar?",
        truth:
          "A primeira necessidade de rollback é sempre a pior hora possível. Deploy sem caminho de volta verificado é aposta, não release.",
      },
      {
        says: "CI tá lento, vou pular os checks só dessa vez.",
        truth:
          "'Só dessa vez' define o novo padrão do time. Checks pulados = gate inexistente; se o gate está errado, corrija o gate, não o contorne.",
      },
      {
        says: "Alerta demais incomoda, melhor só o essencial depois.",
        truth:
          "Sem alerta acionável, o primeiro sinal de incidente é o usuário. SLI/SLO definido antes evita tanto o silêncio quanto o spam de alerta.",
      },
    ],
    redFlags: [
      "Pipeline sem etapa obrigatória de build+teste antes do deploy.",
      "Secrets impressos no log de CI (mesmo mascarados tardiamente).",
      "Serviço sem healthcheck/readiness probe configurado.",
      "Infra alterada direto no console, fora do código versionado (drift).",
      "Single point of failure sem redundância nem plano documentado.",
      "Backup existente mas nunca restaurado em teste.",
      "Rollout sem estratégia gradual (canary/feature flag) em mudança de risco.",
    ],
  },

  data: {
    rationalizations: [
      {
        says: "Dados de produção são limpos, validação em lote é paranoia.",
        truth:
          "Produção contém vazio, duplicado, formato legado e outlier desde o primeiro dia. Validação de schema ANTES da carga é o mínimo; assumir limpeza é exportar o bug para o destino.",
      },
      {
        says: "Registro duplicado é raro, trato se aparecer.",
        truth:
          "Raro em volume alto é frequente em absoluto. Upsert por ID natural/idempotency key é design padrão, não otimização defensiva.",
      },
      {
        says: "Migro essa base na mão, é uma vez só.",
        truth:
          "'Uma vez só' executada sob pressão, sem dry-run e sem rollback, é o cenário clássico de perda irreversível. Migração na mão é migração sem verificação.",
      },
      {
        says: "Índice a gente cria quando a query ficar lenta.",
        truth:
          "Sem índice, a lentidão chega em produção no pico de uso e o índice de emergência trava a tabela justamente no horário crítico. Modelagem inclui acesso previsto.",
      },
      {
        says: "ETL falhou no meio, rodo do zero que resolve.",
        truth:
          "Recomeçar do zero reprocessa efeito colateral e pode duplicar tudo. Checkpoint é obrigatório: falhou no 643 de 1000, retoma do 644.",
      },
      {
        says: "PII nesse dataset tá ok porque é ambiente interno.",
        truth:
          "Ambiente interno é o vetor clássico de vazamento (acesso amplo, sem auditoria). Minimização e tratamento de PII aplicam-se onde o dado está, não onde ele 'deveria' estar.",
      },
    ],
    redFlags: [
      "DELETE/UPDATE sem WHERE em script operacional (ou com WHERE 'óbvio' não conferido).",
      "Migração sem path de rollback testado.",
      "Pipeline batch sem checkpoint — falha no fim recomeça tudo.",
      "Contagem de registros origem vs destino nunca reconciliada.",
      "Retry automático em operação não-idempotente sem idempotency key.",
      "Schema do destino aceitando qualquer coisa (validação adiada indefinidamente).",
      "PII em log, export ou ambiente compartilhado sem tratamento.",
    ],
  },

  ai: {
    rationalizations: [
      {
        says: "Modelo moderno entende sozinho, prompt detalhado é desperdício.",
        truth:
          "Sem few-shot, formato de saída estrito e guardrails, o output é probabilístico e imprevisível. Prompt engineering é especificação de comportamento — não decoração.",
      },
      {
        says: "Resposta plausível, então tá correto.",
        truth:
          "Plausibilidade é o produto, não a prova. Sem avaliação (dataset, critério, comparação), você está validando retórica — hallucinação apresentada como fato é falha classificada do framework.",
      },
      {
        says: "Embedding/recuperação ruim? Troco o modelo maior.",
        truth:
          "Trocar modelo mascara problema de chunking, consulta e qualidade de dados — e multiplica custo. Diagnostique o pipeline RAG antes de escalar o modelo.",
      },
      {
        says: "Jogo tudo no contexto, janela hoje é gigante.",
        truth:
          "Contexto inflado custa dinheiro, latência e atenção do modelo (lost in the middle). Economia de tokens é disciplina: contexto mínimo, cache, janela deslizante.",
      },
      {
        says: "Tool call retornou algo, sigo em frente.",
        truth:
          "Output de tool sem schema validado é dado não confiável entrando no raciocínio. Validar resposta é o mesmo anti-falhas de qualquer integração — LLM não é exceção.",
      },
      {
        says: "Prompt injection é teórico, meu caso é fechado.",
        truth:
          "Todo texto que entra pelo usuário/documento recuperado é superfície de injection. Fechado significa menos vetores, não zero — defesa custa uma instrução e um filtro.",
      },
    ],
    redFlags: [
      "Feature de LLM sem dataset/critério de avaliação (qualidade não medida).",
      "RAG respondendo sem citação/rastreabilidade da fonte recuperada.",
      "Tool/MCP exposto sem schema de entrada validado nem limite de escopo.",
      "Chamada de modelo sem timeout, retry criterioso ou budget de custo.",
      "Output do modelo parseado com confiança cega (sem validação estrutural).",
      "Instrução de sistema concatenada com input de usuário sem isolamento.",
      "Agente com efeito real no mundo sem dry-run nem confirmação de ação irreversível.",
    ],
  },
};

/** Fallback honesto de Verification Steps, específico por categoria. */
export const FALLBACK_VERIFICATION = {
  engineering: [
    "Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).",
    "Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).",
    "Confirmar que nenhum Red Flag listado está presente no artefato produzido.",
    "Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.",
  ],
  testing: [
    "Rodar a suíte de testes relevante e registrar contagem passed/failed (evidência, não afirmação).",
    "Confirmar que cada passo do Step-by-Step Workflow foi aplicado ao caso real.",
    "Verificar que nenhum Red Flag (asserção fraca, skip silencioso, mock excessivo) persiste no resultado.",
    "Corrigido um bug, provar regressão: teste que reproduz o defeito passa após o fix.",
  ],
  security: [
    "Executar varredura de segredos/CVE no artefato tocado pela skill e registrar o resultado.",
    "Confirmar que cada fluxo modificado valida input na fronteira onde entra.",
    "Conferir que nenhum Red Flag listado aparece no diff final.",
    "Registrar evidência da verificação (comando executado + saída resumida), nunca apenas a intenção.",
  ],
  design: [
    "Comparar o artefato com a direção de design acordada (paleta, tipografia, layout, motion) item a item.",
    "Executar auditoria anti-AI-slop: zero tells da lista de Red Flags presentes.",
    "Verificar estados interativos (hover/focus/error/loading) e contraste WCAG AA nos componentes tocados.",
    "Registrar screenshots/evidência do estado final para revisão.",
  ],
  docs: [
    "Executar literalmente cada comando documentado e confirmar que funciona como escrito (zero falsificação).",
    "Conferir que instalação, configuração (.env.example), execução e limitações estão presentes e corretas.",
    "Verificar que nenhuma referência foi citada sem verificação de URL/conteúdo.",
    "Pedir a uma pessoa externa (ou sessão fresca) que siga o documento e registre onde travou.",
  ],
  devops: [
    "Provar o pipeline ponta a ponta em ambiente de teste antes de produção.",
    "Confirmar healthcheck, rollback e alertas acionáveis configurados para o que foi alterado.",
    "Verificar que nenhum secret aparece em logs/manifestos gerados.",
    "Registrar versão, timestamp de deploy e resultado dos checks (rastreabilidade).",
  ],
  data: [
    "Rodar --dry-run sobre amostra real e comparar o que seria feito com o esperado, linha a linha nas bordas.",
    "Reconciliar contagens origem → destino (processados, ignorados, falhas com motivo).",
    "Provar reexecução segura: segunda passada não duplica nem altera resultado.",
    "Confirmar que nenhum Red Flag (WHERE ausente, PII em log, checkpoint ausente) persiste no pipeline entregue.",
  ],
  ai: [
    "Avaliar o output contra critério/dataset definido antes da execução (não 'pareceu bom').",
    "Confirmar validação estrutural de todo output/tool call consumido pela skill.",
    "Verificar presença das salvaguardas: timeout, retry criterioso, budget e isolamento contra prompt injection.",
    "Registrar exemplos de entrada/saída e taxa de falha observada na amostra testada.",
  ],
};
