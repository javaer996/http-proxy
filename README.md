# HTTP 代理服务

[English](./README_EN.md) | 中文

一个本地 HTTP 代理服务，支持请求转发、请求/响应修改、Mock 响应和请求日志记录。

## 功能特性

- **路径映射**: 配置 `/{key}` 到目标 URL 的映射
- **请求分组**: 修改请求头和请求体
- **响应分组**: 修改响应头、响应体和状态码，支持 Mock 模式
- **请求日志**: 记录所有代理请求，支持查看完整请求/响应详情
- **Web 管理界面**: 可视化管理所有配置

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
node server.js
```

访问 http://localhost:3030/admin 进入管理界面。

## 使用方式

### 1. 创建路径映射

在管理界面点击"添加映射"，配置：
- **映射 Key**: 访问路径，如 `api`
- **目标 URL**: 转发目标，如 `https://api.example.com/v1`

**示例：** 配置 Key 为 `openai`，目标为 `https://api.openai.com/v1/chat/completions`

- `http://localhost:3030/openai` → `https://api.openai.com/v1/chat/completions`
- `http://localhost:3030/openai/xxx` → `https://api.openai.com/v1/chat/completions`

**注意：** Key 后面的路径会被忽略，始终转发到配置的目标 URL。

### 2. 请求分组

用于修改发出的请求，在映射中关联后生效：

| 功能 | 说明 |
|-----|------|
| 请求头操作 | 添加/覆盖/删除请求头 |
| 请求体处理 | 脚本修改或直接替换 |

### 3. 响应分组

用于修改收到的响应，在映射中关联后生效：

| 功能 | 说明 |
|-----|------|
| Mock 模式 | 不发起实际请求，直接返回配置的响应 |
| 状态码 | 修改响应状态码 |
| 响应头操作 | 添加/覆盖/删除响应头 |
| 响应体处理 | 脚本修改或直接替换 |

## Body 处理方式

### 直接替换
完全替换为你输入的内容，原内容被丢弃。

### 脚本修改
通过 JavaScript 脚本处理，脚本接收 `body` 参数，必须 `return` 结果。

**body 参数说明：**
- 如果原始内容是**有效 JSON**，`body` 是解析后的 JavaScript 对象
- 如果原始内容**不是 JSON**（如纯文本、HTML），`body` 是原始字符串
- 脚本执行出错时，保留原始内容不做修改

## 脚本示例

### 添加字段
```javascript
return { ...body, timestamp: Date.now() };
```

### 删除字段
```javascript
delete body.password;
delete body.token;
return body;
```

### 修改字段
```javascript
body.username = body.username.toUpperCase();
return body;
```

### 解构删除多个字段
```javascript
const { password, secret, ...rest } = body;
return rest;
```

### 修改嵌套结构
```javascript
body.data.items = body.data.items.filter(item => item.active);
body.data.count = body.data.items.length;
return body;
```

### 处理非 JSON 内容
```javascript
if (typeof body === 'string') {
  return body.replace('old', 'new');
}
return body;
```

### Mock 响应
在响应分组中开启 Mock 模式，Body 选择"直接替换"，输入：
```json
{"code": 0, "message": "success", "data": {"id": 123}}
```

## 配置文件

配置存储在 `config/` 目录：

```
config/
├── mappings.json        # 路径映射
├── request-groups.json  # 请求分组
├── response-groups.json # 响应分组
└── logs.json           # 请求日志
```

## API 接口

| 接口 | 说明 |
|-----|------|
| GET /api/mappings | 获取所有映射 |
| POST /api/mappings | 创建映射 |
| PUT /api/mappings/:id | 更新映射 |
| DELETE /api/mappings/:id | 删除映射 |
| GET /api/request-groups | 获取所有请求分组 |
| POST /api/request-groups | 创建请求分组 |
| PUT /api/request-groups/:id | 更新请求分组 |
| DELETE /api/request-groups/:id | 删除请求分组 |
| GET /api/response-groups | 获取所有响应分组 |
| POST /api/response-groups | 创建响应分组 |
| PUT /api/response-groups/:id | 更新响应分组 |
| DELETE /api/response-groups/:id | 删除响应分组 |
| GET /api/logs | 获取请求日志 |
| DELETE /api/logs | 清空日志 |
| POST /api/shutdown | 关闭服务 |

## 环境变量

| 变量 | 默认值 | 说明 |
|-----|-------|------|
| PORT | 3030 | 服务端口 |
