/**
 * 响应分组服务
 * 管理响应头、响应体和状态码的修改规则
 */
const fileStorage = require('../utils/fileStorage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class ResponseGroupService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/response-groups.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fileStorage.exists(this.configPath)) {
        return fileStorage.read(this.configPath);
      }
    } catch (err) {
      console.error('加载响应分组配置失败:', err.message);
    }
    const defaultConfig = { groups: [] };
    fileStorage.write(this.configPath, defaultConfig);
    return defaultConfig;
  }

  saveConfig() {
    fileStorage.write(this.configPath, this.config);
  }

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
      // Header操作: [{ type: 'add'|'set'|'delete', headerName, headerValue }]
      headerActions: data.headerActions || [],
      // Body配置: { type: 'script'|'replace', content: '...' }
      body: data.body || null,
      // 状态码: null 表示不修改
      statusCode: data.statusCode || null,
      // 是否跳过实际请求（Mock模式）
      mockMode: data.mockMode || false,
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
   * 检查是否需要跳过实际请求（Mock模式）
   */
  shouldMock(groupId) {
    if (!groupId) return null;

    const group = this.getById(groupId);
    if (!group || !group.mockMode) return null;

    return {
      body: group.body?.content ? Buffer.from(group.body.content, 'utf8') : Buffer.from('{}'),
      statusCode: group.statusCode || 200,
      headers: this._buildMockHeaders(group.headerActions)
    };
  }

  _buildMockHeaders(headerActions) {
    const headers = { 'content-type': 'application/json' };
    if (!headerActions) return headers;

    for (const action of headerActions) {
      const headerKey = action.headerName.toLowerCase();
      switch (action.type) {
        case 'add':
          if (!headers[headerKey]) {
            headers[headerKey] = action.headerValue;
          }
          break;
        case 'set':
          headers[headerKey] = action.headerValue;
          break;
        case 'delete':
          delete headers[headerKey];
          break;
      }
    }
    return headers;
  }

  /**
   * 应用响应头修改
   */
  applyHeaders(headers, groupId) {
    if (!groupId) return headers;

    const group = this.getById(groupId);
    if (!group || !group.headerActions) return headers;

    const result = { ...headers };

    for (const action of group.headerActions) {
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

  /**
   * 处理响应体
   */
  processBody(body, groupId) {
    if (!groupId) return body;

    const group = this.getById(groupId);
    if (!group || !group.body) return body;

    return this._processBody(body, group.body);
  }

  /**
   * 获取状态码修改
   */
  getStatusCode(groupId, originalStatus) {
    if (!groupId) return originalStatus;

    const group = this.getById(groupId);
    if (!group || !group.statusCode) return originalStatus;

    return group.statusCode;
  }

  _processBody(body, config) {
    if (!config || !config.content) return body;

    try {
      if (config.type === 'replace') {
        return Buffer.from(config.content, 'utf8');
      }

      if (config.type === 'script') {
        let data;
        try {
          data = JSON.parse(body.toString('utf8'));
        } catch {
          data = body.toString('utf8');
        }

        const fn = new Function('body', config.content);
        const result = fn(data);

        if (typeof result === 'object') {
          return Buffer.from(JSON.stringify(result), 'utf8');
        }
        return Buffer.from(String(result), 'utf8');
      }
    } catch (err) {
      console.error('处理响应体失败:', err.message);
    }

    return body;
  }
}

module.exports = new ResponseGroupService();
