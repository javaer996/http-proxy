const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { URL } = require('url');
const headerGroupService = require('./headerGroupService');
const bodyGroupService = require('./bodyGroupService');
const logService = require('./logService');

class ProxyService {
  /**
   * 执行代理请求
   * @param {string} targetUrl - 目标URL
   * @param {object} originalReq - 原始请求对象
   * @param {object} originalRes - 原始响应对象
   * @param {string} headerGroupId - Header分组ID（可选）
   * @param {string} bodyGroupId - Body分组ID（可选）
   */
  async proxy(targetUrl, originalReq, originalRes, headerGroupId = null, bodyGroupId = null) {
    const startTime = Date.now();
    console.log(`[DEBUG proxyService] 开始代理: ${targetUrl}`);

    // 收集请求体
    const collectRequestBody = () => {
      return new Promise((resolve) => {
        // GET/HEAD/DELETE 等没有 body 的请求直接返回空
        if (!['POST', 'PUT', 'PATCH'].includes(originalReq.method)) {
          console.log(`[DEBUG proxyService] ${originalReq.method} 请求，跳过body收集`);
          return resolve(Buffer.alloc(0));
        }

        console.log(`[DEBUG proxyService] 开始收集请求体...`);
        const chunks = [];
        originalReq.on('data', chunk => {
          console.log(`[DEBUG proxyService] 收到数据块: ${chunk.length} bytes`);
          chunks.push(chunk);
        });
        originalReq.on('end', () => {
          console.log(`[DEBUG proxyService] 请求体收集完成，总大小: ${Buffer.concat(chunks).length} bytes`);
          resolve(Buffer.concat(chunks));
        });
        originalReq.on('error', (err) => {
          console.log(`[DEBUG proxyService] 请求体收集错误:`, err.message);
          resolve(Buffer.alloc(0));
        });
      });
    };

    try {
      let requestBody = await collectRequestBody();

      // 检查是否需要直接返回响应（不发起实际请求）
      const skipResult = bodyGroupService.shouldSkipRequest(bodyGroupId);
      if (skipResult && skipResult.skip) {
        const logEntry = {
          method: originalReq.method,
          originalUrl: originalReq.originalUrl,
          targetUrl: targetUrl,
          requestHeaders: { ...originalReq.headers },
          requestBody: this.formatBody(requestBody),
          responseHeaders: { 'content-type': 'application/json' },
          responseBody: this.formatBody(skipResult.body),
          status: skipResult.statusCode,
          duration: Date.now() - startTime,
          error: null
        };
        logService.add(logEntry);

        originalRes.writeHead(skipResult.statusCode, { 'content-type': 'application/json' });
        originalRes.end(skipResult.body);
        return;
      }

      // 处理请求体
      requestBody = bodyGroupService.processRequestBody(requestBody, bodyGroupId);

      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      // 构建请求头
      const headers = this.buildHeaders(originalReq.headers, targetUrl, headerGroupId);

      const logEntry = {
        method: originalReq.method,
        originalUrl: originalReq.originalUrl,
        targetUrl: targetUrl,
        requestHeaders: { ...headers },
        requestBody: this.formatBody(requestBody),
        responseHeaders: null,
        responseBody: null,
        status: null,
        duration: null,
        error: null
      };

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: originalReq.method,
        headers: headers,
      };

      const proxyReq = httpModule.request(options, (proxyRes) => {
        console.log(`[DEBUG proxyService] 收到响应: ${proxyRes.statusCode}`);
        // 收集响应体
        const responseBodyChunks = [];

        proxyRes.on('data', chunk => {
          responseBodyChunks.push(chunk);
        });

        proxyRes.on('end', () => {
          const responseBody = Buffer.concat(responseBodyChunks);
          console.log(`[DEBUG proxyService] 响应完成，大小: ${responseBody.length} bytes`);

          logEntry.status = proxyRes.statusCode;
          logEntry.duration = Date.now() - startTime;
          logEntry.responseHeaders = { ...proxyRes.headers };

          // 解压响应体用于日志记录
          const contentEncoding = proxyRes.headers['content-encoding'];
          let decodedBody = responseBody;
          try {
            if (contentEncoding === 'gzip') {
              decodedBody = zlib.gunzipSync(responseBody);
            } else if (contentEncoding === 'deflate') {
              decodedBody = zlib.inflateSync(responseBody);
            } else if (contentEncoding === 'br') {
              decodedBody = zlib.brotliDecompressSync(responseBody);
            }
          } catch (e) {
            console.log(`[DEBUG proxyService] 解压失败: ${e.message}`);
          }

          // 处理响应体（使用脚本修改）
          let finalBody = bodyGroupService.processResponseBody(decodedBody, bodyGroupId);

          logEntry.responseBody = this.formatBody(finalBody);
          logService.add(logEntry);
          console.log(`[DEBUG proxyService] 日志已添加`);

          // 发送响应
          const responseHeaders = { ...proxyRes.headers };
          delete responseHeaders['transfer-encoding'];
          delete responseHeaders['content-encoding'];
          responseHeaders['content-length'] = finalBody.length;

          originalRes.writeHead(proxyRes.statusCode, responseHeaders);
          originalRes.end(finalBody);
        });
      });

      proxyReq.on('error', (err) => {
        console.error('代理请求错误:', err.message);
        logEntry.status = 502;
        logEntry.duration = Date.now() - startTime;
        logEntry.error = err.message;
        logService.add(logEntry);

        if (!originalRes.headersSent) {
          originalRes.status(502).json({
            error: 'Bad Gateway',
            message: err.message
          });
        }
      });

      proxyReq.setTimeout(30000, () => {
        proxyReq.destroy();
        logEntry.status = 504;
        logEntry.duration = Date.now() - startTime;
        logEntry.error = '请求超时';
        logService.add(logEntry);

        if (!originalRes.headersSent) {
          originalRes.status(504).json({
            error: 'Gateway Timeout',
            message: '请求超时'
          });
        }
      });

      // 发送请求体
      console.log(`[DEBUG proxyService] 发送请求到: ${options.hostname}:${options.port}${options.path}`);
      if (requestBody.length > 0) {
        proxyReq.write(requestBody);
      }
      proxyReq.end();
      console.log(`[DEBUG proxyService] 请求已发送，等待响应...`);

    } catch (err) {
      console.error('代理错误:', err.message);
      const logEntry = {
        method: originalReq.method,
        originalUrl: originalReq.originalUrl,
        targetUrl: targetUrl,
        requestHeaders: null,
        requestBody: null,
        responseHeaders: null,
        responseBody: null,
        status: 500,
        duration: Date.now() - startTime,
        error: err.message
      };
      logService.add(logEntry);

      if (!originalRes.headersSent) {
        originalRes.status(500).json({
          error: 'Proxy Error',
          message: err.message
        });
      }
    }
  }

  /**
   * 格式化body为可读字符串（不截断）
   */
  formatBody(buffer) {
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // 检查是否是二进制数据
    const isBinary = this.isBinaryData(buffer);

    if (isBinary) {
      return {
        type: 'binary',
        data: '[二进制数据]',
        truncated: false,
        size: buffer.length
      };
    }

    // 尝试解析为JSON
    try {
      const text = buffer.toString('utf8');
      const parsed = JSON.parse(text);
      return {
        type: 'json',
        data: parsed,
        truncated: false,
        size: buffer.length
      };
    } catch {
      const text = buffer.toString('utf8');
      return {
        type: 'text',
        data: text,
        truncated: false,
        size: buffer.length
      };
    }
  }

  /**
   * 检查是否是二进制数据
   */
  isBinaryData(buffer) {
    // 检查前1000字节是否包含非打印字符
    const sample = buffer.slice(0, Math.min(buffer.length, 1000));
    let nonPrintableCount = 0;

    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i];
      // 允许的字符: tab(9), LF(10), CR(13), 可打印ASCII(32-126)
      if (!(byte === 9 || byte === 10 || byte === 13 ||
            (byte >= 32 && byte <= 126))) {
        nonPrintableCount++;
      }
    }

    // 如果超过30%的字节是非打印字符，则认为是二进制
    return nonPrintableCount / sample.length > 0.3;
  }

  /**
   * 构建最终请求头
   */
  buildHeaders(originalHeaders, targetUrl, headerGroupId) {
    // 复制原始头部
    const headers = {};
    for (const [key, value] of Object.entries(originalHeaders)) {
      headers[key.toLowerCase()] = value;
    }

    // 删除hop-by-hop头部
    const hopByHopHeaders = [
      'connection', 'keep-alive', 'proxy-authenticate',
      'proxy-authorization', 'te', 'trailers',
      'transfer-encoding', 'upgrade', 'host'
    ];
    hopByHopHeaders.forEach(h => delete headers[h]);

    // 设置正确的Host头
    const parsedUrl = new URL(targetUrl);
    headers['host'] = parsedUrl.host;

    // 应用Header分组
    if (headerGroupId) {
      return headerGroupService.applyGroup(headers, headerGroupId);
    }

    return headers;
  }
}

module.exports = new ProxyService();
