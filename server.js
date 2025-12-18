const express = require('express');
const path = require('path');
const proxyRouter = require('./src/routes/proxy');
const logsRouter = require('./src/routes/logs');
const mappingsRouter = require('./src/routes/mappings');
const headerGroupsRouter = require('./src/routes/headerGroups');
const mappingService = require('./src/services/mappingService');

const app = express();
const PORT = process.env.PORT || 3030;

// 判断是否是代理请求（映射路径）
function isProxyRequest(req) {
  const match = mappingService.matchPath(req.path);
  return match !== null;
}

// 解析JSON请求体（仅对非代理请求）
app.use((req, res, next) => {
  if (isProxyRequest(req)) {
    return next();
  }
  express.json()(req, res, next);
});

app.use((req, res, next) => {
  if (isProxyRequest(req)) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});

// 静态文件服务（管理页面）
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api/logs', logsRouter);
app.use('/api/mappings', mappingsRouter);
app.use('/api/header-groups', headerGroupsRouter);

// 管理页面入口
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 根路径重定向到管理页面
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// 代理路由 - 放在最后，处理映射请求
app.use(proxyRouter);

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  本地HTTP代理服务已启动`);
  console.log(`========================================`);
  console.log(`  管理页面: http://localhost:${PORT}/admin`);
  console.log(`  代理示例: http://localhost:${PORT}/{key}`);
  console.log(`           配置 key -> 目标URL 的映射`);
  console.log(`========================================\n`);
});
