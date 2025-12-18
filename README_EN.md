# HTTP Proxy Service

English | [中文](./README.md)

A local HTTP proxy service that supports request forwarding, request/response modification, mock responses, and request logging.

## Features

- **Path Mapping**: Configure `/{key}` to target URL mapping
- **Request Groups**: Modify request headers and body
- **Response Groups**: Modify response headers, body, and status code, with Mock mode support
- **Request Logs**: Record all proxy requests with full request/response details
- **Web Admin Panel**: Visual management interface for all configurations

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

Visit http://localhost:3030/admin to access the admin panel.

## Usage

### 1. Create Path Mapping

Click "Add Mapping" in the admin panel and configure:
- **Mapping Key**: Access path, e.g., `api`
- **Target URL**: Forwarding target, e.g., `https://api.example.com/v1`

**Example:** Configure Key as `openai`, target as `https://api.openai.com/v1/chat/completions`

- `http://localhost:3030/openai` → `https://api.openai.com/v1/chat/completions`
- `http://localhost:3030/openai/xxx` → `https://api.openai.com/v1/chat/completions`

**Note:** The path after the Key is ignored; requests are always forwarded to the configured target URL.

### 2. Request Groups

Used to modify outgoing requests, effective when associated with a mapping:

| Feature | Description |
|---------|-------------|
| Header Actions | Add/Override/Delete request headers |
| Body Processing | Script modification or direct replacement |

### 3. Response Groups

Used to modify incoming responses, effective when associated with a mapping:

| Feature | Description |
|---------|-------------|
| Mock Mode | Skip actual request, return configured response directly |
| Status Code | Modify response status code |
| Header Actions | Add/Override/Delete response headers |
| Body Processing | Script modification or direct replacement |

## Body Processing Methods

### Direct Replacement
Completely replace with your input content; original content is discarded.

### Script Modification
Process through JavaScript script. The script receives a `body` parameter and must `return` the result.

**body Parameter:**
- If original content is **valid JSON**, `body` is the parsed JavaScript object
- If original content is **not JSON** (e.g., plain text, HTML), `body` is the original string
- If script execution fails, original content is preserved

## Script Examples

### Add Fields
```javascript
return { ...body, timestamp: Date.now() };
```

### Delete Fields
```javascript
delete body.password;
delete body.token;
return body;
```

### Modify Fields
```javascript
body.username = body.username.toUpperCase();
return body;
```

### Destructure to Delete Multiple Fields
```javascript
const { password, secret, ...rest } = body;
return rest;
```

### Modify Nested Structures
```javascript
body.data.items = body.data.items.filter(item => item.active);
body.data.count = body.data.items.length;
return body;
```

### Handle Non-JSON Content
```javascript
if (typeof body === 'string') {
  return body.replace('old', 'new');
}
return body;
```

### Mock Response
Enable Mock mode in response group, select "Direct Replacement" for Body, and enter:
```json
{"code": 0, "message": "success", "data": {"id": 123}}
```

## Configuration Files

Configurations are stored in the `config/` directory:

```
config/
├── mappings.json        # Path mappings
├── request-groups.json  # Request groups
├── response-groups.json # Response groups
└── logs.json           # Request logs
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/mappings | Get all mappings |
| POST /api/mappings | Create mapping |
| PUT /api/mappings/:id | Update mapping |
| DELETE /api/mappings/:id | Delete mapping |
| GET /api/request-groups | Get all request groups |
| POST /api/request-groups | Create request group |
| PUT /api/request-groups/:id | Update request group |
| DELETE /api/request-groups/:id | Delete request group |
| GET /api/response-groups | Get all response groups |
| POST /api/response-groups | Create response group |
| PUT /api/response-groups/:id | Update response group |
| DELETE /api/response-groups/:id | Delete response group |
| GET /api/logs | Get request logs |
| DELETE /api/logs | Clear logs |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3030 | Server port |
