# Affinity MCP for Codex

Affinity MCP is a Codex plugin that connects ChatGPT Codex to Affinity by Canva's local Model Context Protocol server.

It lets Codex discover Affinity's SDK docs, list and save Affinity scripts, render document previews, and run Affinity JavaScript through the local MCP server exposed by Affinity.

This connector was completely created by ChatGPT Codex under [deba33](https://github.com/deba33)'s supervision. It is an independent community project and is not an official OpenAI, Canva, or Affinity release.

## What It Can Do

- List saved Affinity scripts.
- Read saved scripts from Affinity's script library.
- Save completed scripts back to Affinity.
- Read Affinity SDK documentation topics.
- Search Affinity SDK hints.
- Execute Affinity JavaScript in the currently open Affinity app.
- Render the current spread or selection so Codex can visually inspect the result.

Because it can execute scripts, it can modify the currently open Affinity document when you ask it to.

## Requirements

- Codex with plugin support.
- Affinity by Canva with Model Context Protocol support.
- Affinity open while using the connector.
- Affinity MCP enabled in Affinity settings.
- Node.js available as `node` on your system PATH.
    - Install Node.js from [nodejs.org](https://nodejs.org/en/download)

By default the connector expects Affinity's local MCP server at:

```text
http://localhost:6767
```

If Affinity uses a different local port in the future, update `AFFINITY_MCP_BASE_URL` in `plugins/affinity-mcp/.mcp.json`.

## How to Install

### Using powershell

#### for stable branch

```powershell
codex plugin marketplace add deba33/codex-plugins-by-deba33 --ref stable
```

#### for testing branch

```powershell
codex plugin marketplace add deba33/codex-plugins-by-deba33 --ref main
```

Then open Codex, find `Affinity MCP` in the plugin directory, install it, and start a new chat.

### Using Codex GUI



## Affinity Setup

1. Open Affinity.
2. Open settings.
3. Go to `Model Context Protocol`.
4. Enable `Affinity MCP`.
5. Enable only the permissions you are comfortable granting.
6. Keep Affinity open while using the plugin.

Useful Affinity permission toggles include:

- Desktop file access, if scripts need to read or save files.
- Network access, if scripts need local or internet requests.
- Saved scripts access, if Codex should read existing scripts.
- Save scripts, if Codex should add scripts to the scripting panel.

## Caution

This plugin can run JavaScript inside Affinity through the `execute_script` MCP tool.

That means it may create, rename, edit, delete, or export content in the open Affinity document when asked. Test on a copy of important files first, keep backups, and review script requests carefully.

The connector talks to a local server on your machine. It does not add a cloud service of its own, but Affinity and Codex may still have their own data-handling behavior. Review the relevant product settings and privacy policies before using it with sensitive work.

This project was built against the Affinity MCP behavior observed on July 4, 2026. Affinity's MCP API may change.

## Troubleshooting

If Codex cannot find the Affinity tools:

- Confirm Affinity is open.
- Confirm Affinity MCP is enabled.
- Confirm `http://localhost:6767/sse` is reachable while Affinity is open.
- Confirm Node.js is installed and `node --version` works in a terminal.
- Restart Codex after installing or updating the plugin.
- Start a new chat after enabling the plugin.

If a script fails:

- Ask Codex to read the Affinity SDK preamble first.
- Ask Codex to render the current spread or selection after each major edit.
- Try the operation on a simple test document before using it on production files.

## Development Notes

The plugin includes a small stdio-to-SSE proxy:

```text
plugins/affinity-mcp/scripts/affinity-mcp-proxy.mjs
```

Codex talks to that proxy over stdio. The proxy connects to Affinity's local MCP server at `localhost:6767`, initializes the Affinity MCP session, reads the SDK preamble, and forwards tool calls.

## License

MIT. See `LICENSE`.
