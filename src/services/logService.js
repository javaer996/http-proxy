/**
 * 代理日志服务
 * 存储最近的代理请求日志（文件持久化）
 */
const fileStorage = require('../utils/fileStorage');
const path = require('path');

class LogService {
  constructor() {
    this.configPath = path.join(__dirname, '../../config/logs.json');
    this.maxLogs = 100;
    this.logs = this.loadLogs();
  }

  loadLogs() {
    try {
      if (fileStorage.exists(this.configPath)) {
        const data = fileStorage.read(this.configPath);
        return data.logs || [];
      }
    } catch (err) {
      console.error('加载日志失败:', err.message);
    }
    return [];
  }

  saveLogs() {
    try {
      fileStorage.write(this.configPath, { logs: this.logs });
    } catch (err) {
      console.error('保存日志失败:', err.message);
    }
  }

  /**
   * 添加日志
   */
  add(logEntry) {
    const log = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      ...logEntry
    };

    this.logs.unshift(log);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.saveLogs();
    return log;
  }

  /**
   * 获取所有日志
   */
  getAll(limit = 50) {
    return this.logs.slice(0, limit);
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
    this.saveLogs();
  }
}

module.exports = new LogService();
