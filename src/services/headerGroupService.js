/**
 * Header分组服务
 * 管理Header分组，每个分组包含多个Header操作
 */
const fileStorage = require('../utils/fileStorage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class HeaderGroupService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/header-groups.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fileStorage.exists(this.configPath)) {
        return fileStorage.read(this.configPath);
      }
    } catch (err) {
      console.error('加载Header分组配置失败:', err.message);
    }
    const defaultConfig = { groups: [] };
    fileStorage.write(this.configPath, defaultConfig);
    return defaultConfig;
  }

  saveConfig() {
    fileStorage.write(this.configPath, this.config);
  }

  // ===== CRUD 操作 =====

  getAll() {
    return this.config.groups;
  }

  getById(id) {
    return this.config.groups.find(g => g.id === id);
  }

  create(data) {
    const newGroup = {
      id: uuidv4(),
      name: data.name || '未命名分组',
      description: data.description || '',
      actions: data.actions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.config.groups.push(newGroup);
    this.saveConfig();
    return newGroup;
  }

  update(id, data) {
    const index = this.config.groups.findIndex(g => g.id === id);
    if (index === -1) return null;

    this.config.groups[index] = {
      ...this.config.groups[index],
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };

    this.saveConfig();
    return this.config.groups[index];
  }

  delete(id) {
    const index = this.config.groups.findIndex(g => g.id === id);
    if (index === -1) return false;

    this.config.groups.splice(index, 1);
    this.saveConfig();
    return true;
  }

  /**
   * 应用Header分组的操作到请求头
   * @param {object} headers - 原始请求头
   * @param {string} groupId - Header分组ID
   * @returns {object} 处理后的请求头
   */
  applyGroup(headers, groupId) {
    if (!groupId) return headers;

    const group = this.getById(groupId);
    if (!group) return headers;

    const result = { ...headers };

    for (const action of group.actions) {
      const headerKey = action.headerName.toLowerCase();

      switch (action.type) {
        case 'add':
          if (!result[headerKey]) {
            result[headerKey] = action.headerValue;
          }
          break;
        case 'set':
          result[headerKey] = action.headerValue;
          break;
        case 'delete':
          delete result[headerKey];
          break;
      }
    }

    return result;
  }
}

module.exports = new HeaderGroupService();
