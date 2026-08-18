---
name: websocket-realtime
description: "Comunicação em tempo real via WebSocket, SSE, Socket.IO e WebRTC, com padrões de canais, escalabilidade e segurança. Use ao implementar chat, notificações push ou streaming ao vivo."
---

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

> Gerado pelo Izanagi AI: cópia fiel de `skills/websocket-realtime/SKILL.md` (fonte da verdade).
