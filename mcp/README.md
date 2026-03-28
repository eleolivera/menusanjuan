# MenuSanJuan MCP Server

MCP server that gives AI agents direct access to the MenuSanJuan database, R2 image storage, and Google Places API.

## Setup

```bash
cd mcp
npm install
```

Create `mcp/.env` with credentials (see main project `.env` — this file is gitignored).

## Add to Claude Code

In Claude Code settings (`~/.claude/settings.json` or project settings):

```json
{
  "mcpServers": {
    "menusanjuan": {
      "command": "npx",
      "args": ["tsx", "/Users/eleolivera/Desktop/manu-san-juan/mcp/server.ts"]
    }
  }
}
```

## Available Tools

### Restaurant Management
| Tool | Description |
|------|-------------|
| `list_restaurants` | List all restaurants (name, slug, rating, itemCount) |
| `get_restaurant` | Full details + menu by slug or ID |
| `create_restaurant` | Create with placeholder owner (inactive by default) |
| `update_restaurant` | Update any fields (name, phone, rating, etc.) |
| `activate_restaurant` | Set active + rating |

### Menu Management
| Tool | Description |
|------|-------------|
| `add_menu_category` | Add category to a restaurant (name + emoji) |
| `add_menu_item` | Add item to a category (name, price, description, image) |
| `import_pedidosya_menu` | Bulk import a PedidosYa menu JSON into a restaurant |

### Images
| Tool | Description |
|------|-------------|
| `upload_image_from_url` | Download image → upload to R2 → return permanent URL |
| `set_restaurant_image` | Download + upload + set as logo or cover |
| `fetch_google_cover` | Search Google Places → download photo → set as cover |

### Database
| Tool | Description |
|------|-------------|
| `run_sql` | Execute raw SQL for anything the tools don't cover |
