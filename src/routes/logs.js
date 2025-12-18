const express = require('express');
const router = express.Router();
const logService = require('../services/logService');

// 获取日志列表
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const after = req.query.after; // 时间戳，用于增量获取

  let logs;
  if (after) {
    logs = logService.getAfter(after);
  } else {
    logs = logService.getAll(limit);
  }

  res.json({
    success: true,
    data: logs,
    total: logs.length
  });
});

// 清空日志
router.delete('/', (req, res) => {
  logService.clear();
  res.json({ success: true, message: '日志已清空' });
});

module.exports = router;
