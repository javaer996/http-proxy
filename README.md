# HTTP 代理服务

一个本地 HTTP 代理服务，支持请求转发、Header 修改、Body 修改和请求日志记录。

## 功能特性

- **路径映射**: 配置 `/{key}` 到目标 URL 的映射，支持随机生成 key
- **Header 分组**: 对请求头进行添加、覆盖、删除操作
- **Body 分组**: 对请求体/响应体进行脚本修改或直接替换
- **请求日志**: 记录所有代理请求，支持查看请求头、请求体、响应头、响应体
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
- **Header 分组**: 可选，关联 Header 修改规则
- **Body 分组**: 可选，关联 Body 修改规则

配置后，访问 `http://localhost:3030/api` 会转发到 `https://api.example.com/v1`。

### 2. Header 分组

创建 Header 分组来修改请求头：

| 操作类型 | 说明 |
|---------|------|
| 添加 | 如果 Header 不存在则添加 |
| 覆盖 | 强制设置 Header 值 |
| 删除 | 删除指定 Header |

### 3. Body 分组

创建 Body 分组来修改请求体或响应体：

| 处理类型 | 说明 |
|---------|------|
| 脚本修改 | 通过 JavaScript 脚本修改 JSON |
| 直接替换 | 完全替换为指定内容 |

**注意**: 响应体配置为"直接替换"时，不会发起实际请求，直接返回配置的内容（Mock 功能）。

## 脚本修改说明

脚本接收 `body` 参数（已解析的 JSON 对象），必须 `return` 处理后的结果。

### 添加字段

```javascript
return { ...body, newField: 'value', timestamp: Date.now() }
```

### 删除字段

```javascript
delete body.password;
delete body.token;
return body;
```

### 修改字段

```javascript
body.name = body.name.toUpperCase();
body.count = body.count + 1;
return body;
```

### 解构删除多个字段

```javascript
const { password, token, secret, ...rest } = body;
return rest;
```

### 修改嵌套结构

```javascript
body.data.items = body.data.items.filter(item => item.active);
body.data.count = body.data.items.length;
return body;
```

### 条件修改

```javascript
if (body.type === 'user') {
  body.role = 'admin';
}
return body;
```

### 复杂示例

```javascript
// 删除敏感字段
const { password, token, ...rest } = body;

// 添加处理信息
return {
  ...rest,
  processed: true,
  processedAt: new Date().toISOString(),
  data: {
    ...rest.data,
    items: rest.data.items.map(item => ({
      ...item,
      id: item.id.toString()
    }))
  }
};
```

### 注意事项

- 脚本必须有 `return` 语句
- `body` 是已解析的 JSON 对象，可直接操作
- 如果原始内容不是有效 JSON，`body` 会是原始字符串
- 脚本执行出错时保留原始内容

## 请求日志

- 自动记录所有代理请求
- 点击日志条目展开查看详情
- 展开详情时自动暂停自动刷新
- 支持全屏查看和复制请求体/响应体

## 配置文件

配置存储在 `config/` 目录：

```
config/
├── mappings.json      # 路径映射
├── header-groups.json # Header 分组
├── body-groups.json   # Body 分组
└── logs.json          # 请求日志
```

## API 接口

| 接口 | 说明 |
|-----|------|
| GET /api/mappings | 获取所有映射 |
| POST /api/mappings | 创建映射 |
| PUT /api/mappings/:id | 更新映射 |
| DELETE /api/mappings/:id | 删除映射 |
| GET /api/header-groups | 获取所有 Header 分组 |
| POST /api/header-groups | 创建 Header 分组 |
| PUT /api/header-groups/:id | 更新 Header 分组 |
| DELETE /api/header-groups/:id | 删除 Header 分组 |
| GET /api/body-groups | 获取所有 Body 分组 |
| POST /api/body-groups | 创建 Body 分组 |
| PUT /api/body-groups/:id | 更新 Body 分组 |
| DELETE /api/body-groups/:id | 删除 Body 分组 |
| GET /api/logs | 获取请求日志 |
| DELETE /api/logs | 清空日志 |

## 环境变量

| 变量 | 默认值 | 说明 |
|-----|-------|------|
| PORT | 3030 | 服务端口 |
