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

## Install on Codex GUI

### Step 1: Add the repo as Market Place

#### 1. 

Open plugins

![](/doc_images/affinity-mcp/01.png)

#### 2. 

On far right top you can see a `+` button with dropdown icon. click the **dropdown icon**.

![](/doc_images/affinity-mcp/02.png)

#### 3. 

On dropdown menu click the **"Add Marketplace"**

![](/doc_images/affinity-mcp/03.png)

#### 4.

- On Source Add `deba33/codex-plugins-by-deba33`
- Leave others blank and click **"Add Marketplace"**

![](/doc_images/affinity-mcp/04.png)

#### 5.

Now on Market place screen/page switch to personal. You can see a new section **"Codex Plugins by deba33"**

![](/doc_images/affinity-mcp/05.png)

### Step 2

Install the Affinity MCP Plugin by clicking on install here.

![](/doc_images/affinity-mcp/06.1.png)

Or click on the icon to go to details page and install it there.

![](/doc_images/affinity-mcp/06.2.png)

## Affinity Setup

1. Open Affinity.
2. Open settings.
![](/doc_images/affinity-mcp/07.png)
3. Go to `Model Context Protocol`.
4. Enable `Affinity MCP`.
5. Enable only the permissions you are comfortable granting.
![](/doc_images/affinity-mcp/08.png)
6. Keep Affinity open while using the plugin.

### Useful Affinity permission toggles include:

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

## Removing the plugin

- On Market place screen/page switch to personal. 
- Under the **"Codex Plugins by deba33"** section find the plugin.
- Click the 3 dots menu on right side of plugin card and click "uninstall" and cofirm.

## License

MIT. See `LICENSE`.
