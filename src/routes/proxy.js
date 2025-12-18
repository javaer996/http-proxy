const express = require('express');
const router = express.Router();
const proxyService = require('../services/proxyService');
const mappingService = require('../services/mappingService');

/**
 * 代理中间件
 * 访问 /iflow 会根据映射转发到配置的目标URL
 */
router.all('*', (req, res, next) => {
  console.log(`[DEBUG] 收到请求: ${req.method} ${req.path}`);

  // 查找匹配的映射
  const mapping = mappingService.matchPath(req.path);
  console.log(`[DEBUG] 匹配结果:`, mapping ? `key=${mapping.key}, target=${mapping.targetUrl}` : '无匹配');

  if (!mapping) {
    return next();
  }

  // 验证目标URL
  try {
    new URL(mapping.targetUrl);
  } catch (e) {
    console.log(`[DEBUG] 目标URL无效: ${mapping.targetUrl}`, e.message);
    return res.status(500).json({
      error: 'Configuration Error',
      message: '映射的目标URL无效'
    });
  }

  // 构建目标URL（添加查询参数）
  let fullTargetUrl = mapping.targetUrl;
  const queryString = new URLSearchParams(req.query).toString();
  if (queryString) {
    fullTargetUrl += (fullTargetUrl.includes('?') ? '&' : '?') + queryString;
  }

  console.log(`[PROXY] ${req.method} ${req.path} -> ${fullTargetUrl}`);

  // 代理请求，传递requestGroupId和responseGroupId
  proxyService.proxy(fullTargetUrl, req, res, mapping.requestGroupId, mapping.responseGroupId);
});

module.exports = router;
