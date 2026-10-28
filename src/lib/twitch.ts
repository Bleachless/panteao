"use client";

// Lê o chat público de um canal da Twitch pelo IRC em WebSocket, como visitante anônimo (só leitura,
// sem login nem chave). Cada mensagem chega como { user, text }.

export interface ChatMessage {
  user: string;
  text: string;
}

export type ChatStatus = "conectando" | "conectado" | "caiu";

export function connectTwitch(channel: string, onMessage: (m: ChatMessage) => void, onStatus: (s: ChatStatus) => void): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: number | undefined;

  const open = () => {
    onStatus("conectando");
    socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    socket.onopen = () => {
      socket!.send("CAP REQ :twitch.tv/tags");
      socket!.send("PASS SCHMOOPIIE");
      socket!.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      socket!.send(`JOIN #${channel}`);
    };
    socket.onmessage = (event) => {
      for (const line of String(event.data).split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) socket!.send(line.replace("PING", "PONG"));
        else if (line.includes(" 366 ")) onStatus("conectado");
        else {
          const m = parsePrivmsg(line);
          if (m) onMessage(m);
        }
      }
    };
    socket.onclose = () => {
      if (closed) return;
      onStatus("caiu");
      retry = window.setTimeout(open, 3000);
    };
  };
  open();
  return () => {
    closed = true;
    window.clearTimeout(retry);
    socket?.close();
  };
}

/** "@tags :fulano!fulano@fulano.tmi.twitch.tv PRIVMSG #canal :texto" → { user: "fulano", text: "texto" } */
export function parsePrivmsg(line: string): ChatMessage | null {
  const match = /(?:^@\S+ )?:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.*)$/.exec(line);
  return match ? { user: match[1].toLowerCase(), text: match[2] } : null;
}
