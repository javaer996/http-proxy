const express = require('express');
const router = express.Router();
const ruleService = require('../services/ruleService');

// ===== 全局Header配置 (放在前面避免被 :id 匹配) =====

router.get('/global/headers', (req, res) => {
  const globalHeaders = ruleService.getGlobalHeaders();
  res.json({ success: true, data: globalHeaders });
});

router.put('/global/headers', (req, res) => {
  const updated = ruleService.updateGlobalHeaders(req.body);
  res.json({ success: true, data: updated });
});

// ===== 规则 CRUD =====

// 获取所有规则
router.get('/', (req, res) => {
  const rules = ruleService.getAllRules();
  res.json({ success: true, data: rules });
});

// 获取单个规则
router.get('/:id', (req, res) => {
  const rule = ruleService.getRuleById(req.params.id);
  if (!rule) {
    return res.status(404).json({
      success: false,
      message: '规则不存在'
    });
  }
  res.json({ success: true, data: rule });
});

// 创建规则
router.post('/', (req, res) => {
  try {
    const newRule = ruleService.createRule(req.body);
    res.status(201).json({ success: true, data: newRule });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// 更新规则
router.put('/:id', (req, res) => {
  const updated = ruleService.updateRule(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: '规则不存在'
    });
  }
  res.json({ success: true, data: updated });
});

// 删除规则
router.delete('/:id', (req, res) => {
  const deleted = ruleService.deleteRule(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: '规则不存在'
    });
  }
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
