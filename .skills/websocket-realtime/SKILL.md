---
name: "websocket-realtime"
description: "Comunicação em tempo real via WebSocket, SSE, Socket.IO e WebRTC, com padrões de canais, escalabilidade e segurança. Use ao implementar chat, notificações push ou streaming ao vivo. Gatilhos de ativação: skill websocket & real-time — izanagi; protocolos; implementacao; arquitetura."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill WebSocket & Real-Time — Izanagi

> Migrado deterministicamente de `skills/websocket-realtime/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Comunicação em tempo real via WebSocket, SSE, Socket.IO e WebRTC, com padrões de canais, escalabilidade e segurança.
- **Ativar quando:** Use ao implementar chat, notificações push ou streaming ao vivo.
- **Escopo canônico:** Skill WebSocket & Real-Time — Izanagi
- **Seções do corpo original:** Protocolos · Implementacao · Arquitetura · Seguranca · Casos de Uso no Izanagi
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: WebSocket

```
Client → Upgrade Request → 101 Switching Protocols → Bidirectional Messages
```

- **Handshake**: HTTP Upgrade request (GET /ws)
- **Mensagens**: Text frames (JSON) ou Binary frames (protobuf, msgpack)
- **Conexao**: full-duplex, persistente
- **Porta**: mesma do HTTP (via proxy upgrade)

### Passo 2 — Aplicar: SSE (Server-Sent Events)

```
Client → EventSource → Server → text/event-stream → Client
```

- **Unidirectional**: servidor → cliente
- **Protocolo**: HTTP simples (sem upgrade)
- **Auto-reconnect**: nativo no browser
- **Quando usar**: notificacoes, feeds, updates de status

---

### Passo 3 — Aplicar: WebSocket Nativo

```tsx
const ws = new WebSocket("wss://api.enterprise.com/api/ws");

ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // handle message
};
ws.onclose = () => reconnect();
```

### Passo 4 — Aplicar: Socket.IO (Node.js)

```tsx
// Server
import { Server } from "socket.io";

const io = new Server(httpServer, {
  cors: { origin: "https://api.enterprise.com" },
});

io.on("connection", (socket) => {
  socket.join(`user:${userId}`);
  socket.emit("notification", { title: "Nova mensagem" });
});

// Client
import { io } from "socket.io-client";
const socket = io("wss://api.enterprise.com");
```

---

### Passo 5 — Aplicar: Channels

```
/ws/
├── notifications/    # Notificacoes do usuario
├── chat/             # Chat ao vivo
├── admin/            # Eventos do painel admin
└── radio/            # Streaming de radio
```

### Passo 6 — Aplicar: Escalabilidade

- **Redis adapter** para Socket.IO (multi-instance)
- **Sticky sessions** ou **Redis pub/sub** para broadcast
- **Rate limiting** por conexao (max N msg/sec)
- **Heartbeat**: ping/pong a cada 30s, timeout 10s

---

### Passo 7 — Aplicar: Seguranca

- **Authentication**: JWT token na query string ou header na conexao
- **Authorization**: verificar permissoes do usuario para cada channel
- **Origin check**: validar `Origin` header no upgrade request
- **Rate limit**: limitar mensagens por usuario/segundo
- **Timeout**: desconectar apos N segundos de inatividade
- **Message validation**: Zod schema para cada tipo de mensagem

---

### Passo 8 — Aplicar: Casos de Uso no Izanagi

| Caso | Protocolo | Channel |
|------|-----------|---------|
| Notificacoes push | SSE ou WebSocket | `notifications/{userId}` |
| Chat ao vivo | WebSocket (Socket.IO) | `chat/{ticketId}` |
| Atualizacoes admin | WebSocket | `admin/events` |
| Radio streaming | HLS ou WebSocket | `radio/stream` |

### Passo 9 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Skill WebSocket & Real-Time — Izanagi

## Protocolos

### WebSocket
```
Client → Upgrade Request → 101 Switching Protocols → Bidirectional Messages
```

- **Handshake**: HTTP Upgrade request (GET /ws)
- **Mensagens**: Text frames (JSON) ou Binary frames (protobuf, msgpack)
- **Conexao**: full-duplex, persistente
- **Porta**: mesma do HTTP (via proxy upgrade)

### SSE (Server-Sent Events)
```
Client → EventSource → Server → text/event-stream → Client
```

- **Unidirectional**: servidor → cliente
- **Protocolo**: HTTP simples (sem upgrade)
- **Auto-reconnect**: nativo no browser
- **Quando usar**: notificacoes, feeds, updates de status

---

## Implementacao

### WebSocket Nativo
```tsx
const ws = new WebSocket("wss://api.enterprise.com/api/ws");

ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // handle message
};
ws.onclose = () => reconnect();
```

### Socket.IO (Node.js)
```tsx
// Server
import { Server } from "socket.io";

const io = new Server(httpServer, {
  cors: { origin: "https://api.enterprise.com" },
});

io.on("connection", (socket) => {
  socket.join(`user:${userId}`);
  socket.emit("notification", { title: "Nova mensagem" });
});

// Client
import { io } from "socket.io-client";
const socket = io("wss://api.enterprise.com");
```

---

## Arquitetura

### Channels
```
/ws/
├── notifications/    # Notificacoes do usuario
├── chat/             # Chat ao vivo
├── admin/            # Eventos do painel admin
└── radio/            # Streaming de radio
```

### Escalabilidade
- **Redis adapter** para Socket.IO (multi-instance)
- **Sticky sessions** ou **Redis pub/sub** para broadcast
- **Rate limiting** por conexao (max N msg/sec)
- **Heartbeat**: ping/pong a cada 30s, timeout 10s

---

## Seguranca

- **Authentication**: JWT token na query string ou header na conexao
- **Authorization**: verificar permissoes do usuario para cada channel
- **Origin check**: validar `Origin` header no upgrade request
- **Rate limit**: limitar mensagens por usuario/segundo
- **Timeout**: desconectar apos N segundos de inatividade
- **Message validation**: Zod schema para cada tipo de mensagem

---

## Casos de Uso no Izanagi

| Caso | Protocolo | Channel |
|------|-----------|---------|
| Notificacoes push | SSE ou WebSocket | `notifications/{userId}` |
| Chat ao vivo | WebSocket (Socket.IO) | `chat/{ticketId}` |
| Atualizacoes admin | WebSocket | `admin/events` |
| Radio streaming | HLS ou WebSocket | `radio/stream` |

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
