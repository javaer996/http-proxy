const express = require('express');
const router = express.Router();
const bodyGroupService = require('../services/bodyGroupService');

// 获取所有分组
router.get('/', (req, res) => {
  const groups = bodyGroupService.getAll();
  res.json({ success: true, data: groups });
});

// 获取单个分组
router.get('/:id', (req, res) => {
  const group = bodyGroupService.getById(req.params.id);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: '分组不存在'
    });
  }
  res.json({ success: true, data: group });
});

// 创建分组
router.post('/', (req, res) => {
  try {
    const newGroup = bodyGroupService.create(req.body);
    res.status(201).json({ success: true, data: newGroup });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// 更新分组
router.put('/:id', (req, res) => {
  try {
    const updated = bodyGroupService.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '分组不存在'
      });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// 删除分组
router.delete('/:id', (req, res) => {
  const deleted = bodyGroupService.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: '分组不存在'
    });
  }
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
