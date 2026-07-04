---
name: affinity-mcp
description: Use when the user asks to connect Codex to Affinity by Canva, automate Affinity through MCP, list or manage Affinity scripts, read the Affinity SDK documentation, execute Affinity JavaScript, or render Affinity document/spread/selection previews.
---

# Affinity MCP

This plugin connects Codex to Affinity by Canva's local MCP server through the `affinity-by-canva` MCP server.

Before using script-writing or script-execution tools, call `read_sdk_documentation_topic` with `filename: "preamble"`. Then read any relevant SDK topic files and use `search_sdk_hints` for unknown SDK behavior before experimenting.

Important tools exposed by the MCP server:

- `list_library_scripts`: list saved Affinity scripts.
- `read_library_script`: read a saved Affinity script by title.
- `save_script_to_library`: save completed JavaScript to Affinity's script library.
- `list_sdk_documentation`: list available SDK documentation topics.
- `read_sdk_documentation_topic`: read an SDK documentation topic.
- `search_sdk_hints`: search Affinity SDK hints.
- `execute_script`: run JavaScript in Affinity.
- `render_spread` and `render_selection`: inspect Affinity output visually.

If the MCP tools are unavailable, ask the user to confirm Affinity by Canva is open, its Model Context Protocol setting is enabled, and the local server at `http://localhost:6767/sse` is reachable.
