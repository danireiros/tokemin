# Promptmin

Comprime prompts y contextos para gastar menos tokens. Todo corre en tu máquina: no hay servidor, no hay claves y el texto no sale del dispositivo.

Cursor **no** recorta solo cada mensaje que escribes. El ahorro aparece cuando llamas a las tools `compress` o `compress_context` **antes** de reenviar un tocho a un subagente, un `Task` o un dump de contexto.

## Requisitos

- Node 18 o superior
- Cursor (para el MCP)

```bash
git clone https://github.com/danireiros/promptmin.git
cd promptmin
npm install
```

## Instalar en Cursor (MCP)

Añade el servidor en la config de MCP de **usuario** (`~/.cursor/mcp.json` en macOS/Linux). Usa la ruta absoluta de **tu** clone:

```json
{
  "mcpServers": {
    "promptmin": {
      "command": "node",
      "args": ["/ruta/absoluta/a/promptmin/mcp/server.js"]
    }
  }
}
```

Si ya tienes otros servidores, pega solo el bloque `"promptmin": { ... }` junto a ellos. Sin `env` ni tokens.

Reinicia Cursor o recarga los MCP. En el chat deberían aparecer las tools:

- `compress` — mensaje, system o chat (`mode`, `aggressiveness`, `budget_tokens`, `query`)
- `compress_context` — documentos o dumps respecto a una pregunta, hasta un presupuesto de tokens

La ruta tiene que ser absoluta. Un `.cursor/mcp.json` del repo con ruta relativa suele fallar si abres otro workspace.

## Regla para que el agente lo use

Pega esto en una user rule o en las reglas del proyecto:

> Si vas a reenviar a un `Task`, subagente o al modelo un contexto de más de ~800 tokens (docs, logs, dumps, historial), llama antes a Promptmin (`compress` o `compress_context`) y usa el texto recortado. No comprimas mensajes cortos: el ahorro es residual.

## CLI

```bash
npm run cli -- compress --mode context --budget 800 archivo.txt
```

También lee stdin:

```bash
pbpaste | npm run cli -- compress --mode message --aggressiveness medium
```

Opciones: `--mode message|system|context|chat`, `--aggressiveness soft|medium|hard|budget`, `--budget N`, `--query "…"`, `--short`, `--dense`.

## Web local

En la raíz del repo:

```bash
python3 -m http.server 8765
```

Abre `http://127.0.0.1:8765`. El recorte es el mismo motor; no hay red hacia fuera.

## Tests

```bash
npm test
```
