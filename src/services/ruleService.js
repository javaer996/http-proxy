const fileStorage = require('../utils/fileStorage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class RuleService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/headers.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fileStorage.exists(this.configPath)) {
        return fileStorage.read(this.configPath);
      }
    } catch (err) {
      console.error('加载配置失败:', err.message);
    }
    // 默认配置
    const defaultConfig = {
      rules: [],
      globalHeaders: { add: {}, delete: [] }
    };
    fileStorage.write(this.configPath, defaultConfig);
    return defaultConfig;
  }

  saveConfig() {
    fileStorage.write(this.configPath, this.config);
  }

  // ===== CRUD 操作 =====

  getAllRules() {
    return this.config.rules;
  }

  getRuleById(id) {
    return this.config.rules.find(r => r.id === id);
  }

  createRule(ruleData) {
    const newRule = {
      id: uuidv4(),
      name: ruleData.name || '未命名规则',
      enabled: ruleData.enabled !== false,
      matchPattern: ruleData.matchPattern || '*',
      priority: ruleData.priority || 10,
      actions: ruleData.actions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.config.rules.push(newRule);
    this.saveConfig();
    return newRule;
  }

  updateRule(id, updateData) {
    const index = this.config.rules.findIndex(r => r.id === id);
    if (index === -1) return null;

    this.config.rules[index] = {
      ...this.config.rules[index],
      ...updateData,
      id, // 确保ID不被修改
      updatedAt: new Date().toISOString()
    };

    this.saveConfig();
    return this.config.rules[index];
  }

  deleteRule(id) {
    const index = this.config.rules.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.config.rules.splice(index, 1);
    this.saveConfig();
    return true;
  }

  // ===== 匹配逻辑 =====

  getMatchingRules(url) {
    return this.config.rules.filter(rule => {
      if (!rule.enabled) return false;
      return this.matchUrl(url, rule.matchPattern);
    });
  }

  matchUrl(url, pattern) {
    if (pattern === '*') return true;

    // 支持简单通配符
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
      );
      return regex.test(url);
    }

    // 直接包含匹配
    return url.includes(pattern);
  }

  getGlobalHeaders() {
    return this.config.globalHeaders || { add: {}, delete: [] };
  }

  updateGlobalHeaders(globalHeaders) {
    this.config.globalHeaders = globalHeaders;
    this.saveConfig();
    return this.config.globalHeaders;
  }
}

module.exports = new RuleService();
