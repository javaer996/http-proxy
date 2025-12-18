const express = require('express');
const router = express.Router();
const mappingService = require('../services/mappingService');

// 生成随机key
router.get('/generate-key', (req, res) => {
  const key = mappingService.generateKey();
  res.json({ success: true, data: { key } });
});

// 获取所有映射
router.get('/', (req, res) => {
  const mappings = mappingService.getAll();
  res.json({ success: true, data: mappings });
});

// 获取单个映射
router.get('/:id', (req, res) => {
  const mapping = mappingService.getById(req.params.id);
  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: '映射不存在'
    });
  }
  res.json({ success: true, data: mapping });
});

// 创建映射
router.post('/', (req, res) => {
  try {
    const newMapping = mappingService.create(req.body);
    res.status(201).json({ success: true, data: newMapping });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// 更新映射
router.put('/:id', (req, res) => {
  try {
    const updated = mappingService.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '映射不存在'
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

// 删除映射
router.delete('/:id', (req, res) => {
  const deleted = mappingService.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: '映射不存在'
    });
  }
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
