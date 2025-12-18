/**
 * 请求映射服务
 * 管理 key -> targetUrl 的映射关系
 * 支持关联Header分组
 */
const fileStorage = require('../utils/fileStorage');
const path = require('path');

class MappingService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/mappings.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fileStorage.exists(this.configPath)) {
        return fileStorage.read(this.configPath);
      }
    } catch (err) {
      console.error('加载映射配置失败:', err.message);
    }
    const defaultConfig = { mappings: [] };
    fileStorage.write(this.configPath, defaultConfig);
    return defaultConfig;
  }

  saveConfig() {
    fileStorage.write(this.configPath, this.config);
  }

  /**
   * 生成随机key
   */
  generateKey(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (this.getByKey(key)) {
      return this.generateKey(length);
    }
    return key;
  }

  // ===== CRUD 操作 =====

  getAll() {
    return this.config.mappings;
  }

  getByKey(key) {
    return this.config.mappings.find(m => m.key === key);
  }

  getById(id) {
    return this.config.mappings.find(m => m.id === id);
  }

  create(data) {
    const key = data.key || this.generateKey();
    if (this.getByKey(key)) {
      throw new Error(`Key "${key}" 已存在`);
    }

    const newMapping = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      key: key,
      targetUrl: data.targetUrl,
      headerGroupId: data.headerGroupId || null,
      description: data.description || '',
      enabled: data.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.config.mappings.push(newMapping);
    this.saveConfig();
    return newMapping;
  }

  update(id, data) {
    const index = this.config.mappings.findIndex(m => m.id === id);
    if (index === -1) return null;

    const existing = this.config.mappings[index];

    if (data.key && data.key !== existing.key) {
      const conflict = this.config.mappings.find(m => m.key === data.key && m.id !== id);
      if (conflict) {
        throw new Error(`Key "${data.key}" 已存在`);
      }
    }

    this.config.mappings[index] = {
      ...existing,
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };

    this.saveConfig();
    return this.config.mappings[index];
  }

  delete(id) {
    const index = this.config.mappings.findIndex(m => m.id === id);
    if (index === -1) return false;

    this.config.mappings.splice(index, 1);
    this.saveConfig();
    return true;
  }

  /**
   * 根据请求路径查找匹配的映射
   * 匹配路径第一段 /{key}/... 格式
   * @param {string} pathname - 请求路径，如 /iflow 或 /iflow/v1/message
   * @returns {object|null} 匹配的映射
   */
  matchPath(pathname) {
    // 获取路径第一段作为key
    const segments = pathname.split('/').filter(s => s);
    if (segments.length === 0) return null;

    const key = segments[0];
    const mapping = this.getByKey(key);
    if (!mapping || !mapping.enabled) return null;

    return mapping;
  }
}

module.exports = new MappingService();
