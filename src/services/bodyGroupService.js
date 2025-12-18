/**
 * Body分组服务
 * 管理请求体/响应体的修改规则
 */
const fileStorage = require('../utils/fileStorage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class BodyGroupService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/body-groups.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fileStorage.exists(this.configPath)) {
        return fileStorage.read(this.configPath);
      }
    } catch (err) {
      console.error('加载Body分组配置失败:', err.message);
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
      // 请求体配置: { type: 'script'|'replace', content: '...' }
      requestBody: data.requestBody || null,
      // 响应体配置: { type: 'script'|'replace', content: '...', statusCode: 200 }
      responseBody: data.responseBody || null,
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
   * 处理请求体
   * @param {Buffer} body - 原始请求体
   * @param {string} groupId - Body分组ID
   * @returns {Buffer} 处理后的请求体
   */
  processRequestBody(body, groupId) {
    if (!groupId) return body;

    const group = this.getById(groupId);
    if (!group || !group.requestBody) return body;

    return this._processBody(body, group.requestBody);
  }

  /**
   * 处理响应体
   * @param {Buffer} body - 原始响应体
   * @param {string} groupId - Body分组ID
   * @returns {Buffer} 处理后的响应体
   */
  processResponseBody(body, groupId) {
    if (!groupId) return body;

    const group = this.getById(groupId);
    if (!group || !group.responseBody) return body;

    return this._processBody(body, group.responseBody);
  }

  /**
   * 检查是否需要直接返回响应（不发起实际请求）
   * @param {string} groupId - Body分组ID
   * @returns {{ skip: boolean, body: Buffer, statusCode: number } | null}
   */
  shouldSkipRequest(groupId) {
    if (!groupId) return null;

    const group = this.getById(groupId);
    if (!group || !group.responseBody) return null;

    if (group.responseBody.type === 'replace') {
      return {
        skip: true,
        body: Buffer.from(group.responseBody.content || '', 'utf8'),
        statusCode: group.responseBody.statusCode || 200
      };
    }

    return null;
  }

  _processBody(body, config) {
    if (!config || !config.content) return body;

    try {
      if (config.type === 'replace') {
        return Buffer.from(config.content, 'utf8');
      }

      if (config.type === 'script') {
        // 解析原始body为JSON
        let data;
        try {
          data = JSON.parse(body.toString('utf8'));
        } catch {
          data = body.toString('utf8');
        }

        // 执行脚本
        const fn = new Function('body', config.content);
        const result = fn(data);

        // 返回处理后的结果
        if (typeof result === 'object') {
          return Buffer.from(JSON.stringify(result), 'utf8');
        }
        return Buffer.from(String(result), 'utf8');
      }
    } catch (err) {
      console.error('处理Body失败:', err.message);
    }

    return body;
  }
}

module.exports = new BodyGroupService();
