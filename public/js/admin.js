// API endpoints
const API = {
  mappings: '/api/mappings',
  groups: '/api/header-groups',
  bodyGroups: '/api/body-groups',
  logs: '/api/logs'
};

// DOM elements
const mappingsList = document.getElementById('mappings-list');
const groupsList = document.getElementById('groups-list');
const bodyGroupsList = document.getElementById('body-groups-list');
const logsList = document.getElementById('logs-list');
const mappingModal = document.getElementById('mapping-modal');
const groupModal = document.getElementById('group-modal');
const bodyGroupModal = document.getElementById('body-group-modal');

// State
let currentMappingId = null;
let currentGroupId = null;
let currentBodyGroupId = null;
let actions = [];
let headerGroups = [];
let bodyGroups = [];
let logsRefreshInterval = null;
let autoRefreshEnabled = true;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  bindEvents();
  startAutoRefresh();
});

function bindEvents() {
  // Mapping events
  document.getElementById('btn-add-mapping').addEventListener('click', () => openMappingModal());
  document.getElementById('btn-generate-key').addEventListener('click', generateKey);
  document.getElementById('mapping-form').addEventListener('submit', saveMappingHandler);

  // Group events
  document.getElementById('btn-add-group').addEventListener('click', () => openGroupModal());
  document.getElementById('btn-add-action').addEventListener('click', addAction);
  document.getElementById('group-form').addEventListener('submit', saveGroupHandler);

  // Body Group events
  document.getElementById('btn-add-body-group').addEventListener('click', () => openBodyGroupModal());
  document.getElementById('body-group-form').addEventListener('submit', saveBodyGroupHandler);

  // Log events
  document.getElementById('auto-refresh').addEventListener('change', (e) => {
    autoRefreshEnabled = e.target.checked;
    autoRefreshEnabled ? startAutoRefresh() : stopAutoRefresh();
  });
  document.getElementById('btn-refresh-logs').addEventListener('click', manualRefreshLogs);
  document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);

  // Modal close on background click
  [mappingModal, groupModal, bodyGroupModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  });

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMappingModal();
      closeGroupModal();
      closeBodyGroupModal();
      closeFullscreenModal();
    }
  });
}

async function loadAll() {
  await loadGroups();
  await loadBodyGroups();
  await loadMappings();
  await loadLogs();
}

// ===== Mappings =====
async function loadMappings() {
  try {
    const res = await fetch(API.mappings);
    const { data } = await res.json();
    renderMappings(data);
  } catch (err) {
    console.error('加载映射失败:', err);
    mappingsList.innerHTML = '<p class="empty">加载失败</p>';
  }
}

function renderMappings(mappings) {
  if (!mappings || mappings.length === 0) {
    mappingsList.innerHTML = '<p class="empty">暂无映射，点击"添加映射"创建</p>';
    return;
  }

  mappingsList.innerHTML = mappings.map(m => {
    const group = headerGroups.find(g => g.id === m.headerGroupId);
    const bodyGroup = bodyGroups.find(g => g.id === m.bodyGroupId);
    return `
      <div class="card ${m.enabled ? '' : 'disabled'}">
        <div class="card-info">
          <h4>
            <code>/${escapeHtml(m.key)}</code>
            ${m.enabled ? '<span class="status-badge enabled">启用</span>' : '<span class="status-badge disabled">禁用</span>'}
          </h4>
          <p class="meta">
            <span>目标: ${escapeHtml(m.targetUrl)}</span>
            ${group ? `<span>Header: ${escapeHtml(group.name)}</span>` : ''}
            ${bodyGroup ? `<span>Body: ${escapeHtml(bodyGroup.name)}</span>` : ''}
            ${m.description ? `<span>${escapeHtml(m.description)}</span>` : ''}
          </p>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="toggleMapping('${m.id}', ${!m.enabled})">
            ${m.enabled ? '禁用' : '启用'}
          </button>
          <button class="btn btn-sm" onclick="editMapping('${m.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMapping('${m.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function openMappingModal(mapping = null) {
  currentMappingId = mapping?.id || null;
  document.getElementById('mapping-modal-title').textContent = mapping ? '编辑映射' : '添加映射';

  document.getElementById('mapping-id').value = mapping?.id || '';
  document.getElementById('mapping-key').value = mapping?.key || '';
  document.getElementById('mapping-target').value = mapping?.targetUrl || '';
  document.getElementById('mapping-desc').value = mapping?.description || '';
  document.getElementById('mapping-enabled').checked = mapping?.enabled !== false;

  // Populate header groups dropdown
  const select = document.getElementById('mapping-group');
  select.innerHTML = '<option value="">-- 不关联 --</option>' +
    headerGroups.map(g => `<option value="${g.id}" ${mapping?.headerGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');

  // Populate body groups dropdown
  const bodySelect = document.getElementById('mapping-body-group');
  bodySelect.innerHTML = '<option value="">-- 不关联 --</option>' +
    bodyGroups.map(g => `<option value="${g.id}" ${mapping?.bodyGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');

  mappingModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeMappingModal() {
  mappingModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentMappingId = null;
}

async function generateKey() {
  try {
    const res = await fetch(`${API.mappings}/generate-key`);
    const { data } = await res.json();
    document.getElementById('mapping-key').value = data.key;
  } catch (err) {
    alert('生成Key失败: ' + err.message);
  }
}

async function saveMappingHandler(e) {
  e.preventDefault();

  const data = {
    key: document.getElementById('mapping-key').value.trim(),
    targetUrl: document.getElementById('mapping-target').value.trim(),
    headerGroupId: document.getElementById('mapping-group').value || null,
    bodyGroupId: document.getElementById('mapping-body-group').value || null,
    description: document.getElementById('mapping-desc').value.trim(),
    enabled: document.getElementById('mapping-enabled').checked
  };

  if (!data.key || !data.targetUrl) {
    alert('请填写必填字段');
    return;
  }

  try {
    const url = currentMappingId ? `${API.mappings}/${currentMappingId}` : API.mappings;
    const method = currentMappingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      closeMappingModal();
      loadMappings();
    } else {
      alert('保存失败: ' + result.message);
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function editMapping(id) {
  try {
    const res = await fetch(`${API.mappings}/${id}`);
    const { data } = await res.json();
    openMappingModal(data);
  } catch (err) {
    alert('获取映射失败: ' + err.message);
  }
}

async function toggleMapping(id, enabled) {
  try {
    await fetch(`${API.mappings}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    loadMappings();
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

async function deleteMapping(id) {
  if (!confirm('确定要删除这个映射吗？')) return;

  try {
    await fetch(`${API.mappings}/${id}`, { method: 'DELETE' });
    loadMappings();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// ===== Header Groups =====
async function loadGroups() {
  try {
    const res = await fetch(API.groups);
    const { data } = await res.json();
    headerGroups = data || [];
    renderGroups(headerGroups);
  } catch (err) {
    console.error('加载分组失败:', err);
    groupsList.innerHTML = '<p class="empty">加载失败</p>';
  }
}

function renderGroups(groups) {
  if (!groups || groups.length === 0) {
    groupsList.innerHTML = '<p class="empty">暂无Header分组，点击"添加分组"创建</p>';
    return;
  }

  groupsList.innerHTML = groups.map(g => `
    <div class="card">
      <div class="card-info">
        <h4>${escapeHtml(g.name)}</h4>
        <p class="meta">
          <span>操作数: ${g.actions ? g.actions.length : 0}</span>
          ${g.description ? `<span>${escapeHtml(g.description)}</span>` : ''}
        </p>
      </div>
      <div class="card-actions">
        <button class="btn btn-sm" onclick="editGroup('${g.id}')">编辑</button>
        <button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function openGroupModal(group = null) {
  currentGroupId = group?.id || null;
  document.getElementById('group-modal-title').textContent = group ? '编辑Header分组' : '添加Header分组';

  document.getElementById('group-id').value = group?.id || '';
  document.getElementById('group-name').value = group?.name || '';
  document.getElementById('group-desc').value = group?.description || '';

  actions = group?.actions ? JSON.parse(JSON.stringify(group.actions)) : [];
  renderActions();

  groupModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeGroupModal() {
  groupModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentGroupId = null;
  actions = [];
}

function renderActions() {
  const container = document.getElementById('actions-list');

  if (actions.length === 0) {
    container.innerHTML = '<p class="empty" style="padding: 20px;">暂无操作，点击下方按钮添加</p>';
    return;
  }

  container.innerHTML = actions.map((action, index) => `
    <div class="action-item">
      <select onchange="updateAction(${index}, 'type', this.value)">
        <option value="add" ${action.type === 'add' ? 'selected' : ''}>添加</option>
        <option value="set" ${action.type === 'set' ? 'selected' : ''}>覆盖</option>
        <option value="delete" ${action.type === 'delete' ? 'selected' : ''}>删除</option>
      </select>
      <input type="text" placeholder="Header名称" value="${escapeHtml(action.headerName || '')}"
             onchange="updateAction(${index}, 'headerName', this.value)">
      <input type="text" placeholder="Header值" value="${escapeHtml(action.headerValue || '')}"
             onchange="updateAction(${index}, 'headerValue', this.value)"
             ${action.type === 'delete' ? 'disabled style="opacity:0.5"' : ''}>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeAction(${index})">删除</button>
    </div>
  `).join('');
}

function addAction() {
  actions.push({ type: 'add', headerName: '', headerValue: '' });
  renderActions();
}

function updateAction(index, field, value) {
  actions[index][field] = value;
  if (field === 'type' && value === 'delete') {
    actions[index].headerValue = '';
  }
  if (field === 'type') renderActions();
}

function removeAction(index) {
  actions.splice(index, 1);
  renderActions();
}

async function saveGroupHandler(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('group-name').value.trim(),
    description: document.getElementById('group-desc').value.trim(),
    actions: actions.filter(a => a.headerName && a.headerName.trim())
  };

  if (!data.name) {
    alert('请输入分组名称');
    return;
  }

  try {
    const url = currentGroupId ? `${API.groups}/${currentGroupId}` : API.groups;
    const method = currentGroupId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      closeGroupModal();
      loadAll();
    } else {
      alert('保存失败: ' + result.message);
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function editGroup(id) {
  try {
    const res = await fetch(`${API.groups}/${id}`);
    const { data } = await res.json();
    openGroupModal(data);
  } catch (err) {
    alert('获取分组失败: ' + err.message);
  }
}

async function deleteGroup(id) {
  if (!confirm('确定要删除这个分组吗？')) return;

  try {
    await fetch(`${API.groups}/${id}`, { method: 'DELETE' });
    loadAll();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// ===== Body Groups =====
async function loadBodyGroups() {
  try {
    const res = await fetch(API.bodyGroups);
    const { data } = await res.json();
    bodyGroups = data || [];
    renderBodyGroups(bodyGroups);
  } catch (err) {
    console.error('加载Body分组失败:', err);
    bodyGroupsList.innerHTML = '<p class="empty">加载失败</p>';
  }
}

function renderBodyGroups(groups) {
  if (!groups || groups.length === 0) {
    bodyGroupsList.innerHTML = '<p class="empty">暂无Body分组，点击"添加分组"创建</p>';
    return;
  }

  bodyGroupsList.innerHTML = groups.map(g => {
    const reqType = g.requestBody?.type ? (g.requestBody.type === 'script' ? '脚本' : '替换') : '无';
    const resType = g.responseBody?.type ? (g.responseBody.type === 'script' ? '脚本' : '替换') : '无';
    return `
      <div class="card">
        <div class="card-info">
          <h4>${escapeHtml(g.name)}</h4>
          <p class="meta">
            <span>请求体: ${reqType}</span>
            <span>响应体: ${resType}</span>
            ${g.description ? `<span>${escapeHtml(g.description)}</span>` : ''}
          </p>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="editBodyGroup('${g.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBodyGroup('${g.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function openBodyGroupModal(group = null) {
  currentBodyGroupId = group?.id || null;
  document.getElementById('body-group-modal-title').textContent = group ? '编辑Body分组' : '添加Body分组';

  document.getElementById('body-group-id').value = group?.id || '';
  document.getElementById('body-group-name').value = group?.name || '';
  document.getElementById('body-group-desc').value = group?.description || '';

  // 请求体配置
  document.getElementById('req-body-type').value = group?.requestBody?.type || '';
  document.getElementById('req-body-content').value = group?.requestBody?.content || '';
  toggleBodyConfig('req');

  // 响应体配置
  document.getElementById('res-body-type').value = group?.responseBody?.type || '';
  document.getElementById('res-body-content').value = group?.responseBody?.content || '';
  document.getElementById('res-body-status').value = group?.responseBody?.statusCode || 200;
  toggleBodyConfig('res');

  bodyGroupModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBodyGroupModal() {
  bodyGroupModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentBodyGroupId = null;
}

function toggleBodyConfig(prefix) {
  const type = document.getElementById(`${prefix}-body-type`).value;
  const config = document.getElementById(`${prefix}-body-config`);

  if (type) {
    config.classList.remove('hidden');
  } else {
    config.classList.add('hidden');
  }

  // 响应体替换时显示状态码
  if (prefix === 'res') {
    const statusRow = document.getElementById('res-status-row');
    if (type === 'replace') {
      statusRow.classList.remove('hidden');
    } else {
      statusRow.classList.add('hidden');
    }
  }
}

async function saveBodyGroupHandler(e) {
  e.preventDefault();

  const reqType = document.getElementById('req-body-type').value;
  const resType = document.getElementById('res-body-type').value;

  const data = {
    name: document.getElementById('body-group-name').value.trim(),
    description: document.getElementById('body-group-desc').value.trim(),
    requestBody: reqType ? {
      type: reqType,
      content: document.getElementById('req-body-content').value
    } : null,
    responseBody: resType ? {
      type: resType,
      content: document.getElementById('res-body-content').value,
      statusCode: parseInt(document.getElementById('res-body-status').value) || 200
    } : null
  };

  if (!data.name) {
    alert('请输入分组名称');
    return;
  }

  try {
    const url = currentBodyGroupId ? `${API.bodyGroups}/${currentBodyGroupId}` : API.bodyGroups;
    const method = currentBodyGroupId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      closeBodyGroupModal();
      loadAll();
    } else {
      alert('保存失败: ' + result.message);
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function editBodyGroup(id) {
  try {
    const res = await fetch(`${API.bodyGroups}/${id}`);
    const { data } = await res.json();
    openBodyGroupModal(data);
  } catch (err) {
    alert('获取分组失败: ' + err.message);
  }
}

async function deleteBodyGroup(id) {
  if (!confirm('确定要删除这个分组吗？')) return;

  try {
    await fetch(`${API.bodyGroups}/${id}`, { method: 'DELETE' });
    loadAll();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// ===== Logs =====
let expandedLogIds = new Set();
let activeTabMap = new Map(); // 记录每个日志的活跃tab

async function loadLogs() {
  try {
    const res = await fetch(API.logs);
    const { data } = await res.json();
    renderLogs(data);
  } catch (err) {
    console.error('加载日志失败:', err);
  }
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    logsList.innerHTML = '<p class="empty">暂无请求日志</p>';
    logsData = [];
    return;
  }

  // 保存日志数据用于全屏显示
  logsData = logs;

  logsList.innerHTML = logs.map(log => {
    const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
    const statusClass = getStatusClass(log.status);
    const isError = log.error || log.status >= 400;
    const isExpanded = expandedLogIds.has(log.id);
    const activeTab = activeTabMap.get(log.id) || 'req-headers';

    return `
      <div class="log-item-wrapper" data-log-id="${log.id}">
        <div class="log-item ${isError ? 'error' : (log.status < 300 ? 'success' : '')} ${isExpanded ? 'expanded' : ''}"
             onclick="toggleLogDetail('${log.id}')">
          <span class="log-expand-icon">${isExpanded ? '▼' : '▶'}</span>
          <span class="log-time">${time}</span>
          <span class="log-method ${log.method}">${log.method}</span>
          <span class="log-url" title="${escapeHtml(log.originalUrl)}">${escapeHtml(log.originalUrl)}</span>
          <span class="log-target" title="${escapeHtml(log.targetUrl)}">→ ${escapeHtml(log.targetUrl)}</span>
          <span class="log-status ${statusClass}">${log.status || '-'}</span>
          <span class="log-duration">${log.duration ? log.duration + 'ms' : '-'}</span>
        </div>
        ${isExpanded ? renderLogDetail(log, activeTab) : ''}
      </div>
    `;
  }).join('');
}

function toggleLogDetail(logId) {
  if (expandedLogIds.has(logId)) {
    expandedLogIds.delete(logId);
    activeTabMap.delete(logId);
  } else {
    expandedLogIds.add(logId);
    activeTabMap.set(logId, 'req-headers');
    // 展开详情时自动关闭自动刷新
    if (autoRefreshEnabled) {
      autoRefreshEnabled = false;
      document.getElementById('auto-refresh').checked = false;
      stopAutoRefresh();
      showToast('自动刷新已取消');
    }
  }
  loadLogs();
}

// 存储日志数据用于全屏显示
let logsData = [];

function renderLogDetail(log, activeTab, isFullscreen = false) {
  const tabs = [
    { id: 'req-headers', label: '请求头' },
    { id: 'req-body', label: '请求体' },
    { id: 'res-headers', label: '响应头' },
    { id: 'res-body', label: '响应体' }
  ];
  if (log.error) {
    tabs.push({ id: 'error', label: '错误' });
  }

  const fullscreenBtn = isFullscreen ? '' : `<button class="btn-fullscreen" onclick="openFullscreenModal(event, '${log.id}')">全屏</button>`;

  return `
    <div class="log-detail" onclick="event.stopPropagation()">
      <div class="log-detail-tabs">
        ${tabs.map(tab => `
          <button class="tab-btn ${tab.id === activeTab ? 'active' : ''} ${tab.id === 'error' ? 'tab-error' : ''}"
                  onclick="switchLogTab(event, '${log.id}', '${tab.id}')">${tab.label}</button>
        `).join('')}
        ${fullscreenBtn}
      </div>
      <div class="log-detail-content">
        <div class="tab-panel ${activeTab === 'req-headers' ? 'active' : ''}" data-tab="${log.id}-req-headers">
          ${renderHeaders(log.requestHeaders, '请求头')}
        </div>
        <div class="tab-panel ${activeTab === 'req-body' ? 'active' : ''}" data-tab="${log.id}-req-body">
          ${renderBody(log.requestBody, '请求体', log.id + '-req')}
        </div>
        <div class="tab-panel ${activeTab === 'res-headers' ? 'active' : ''}" data-tab="${log.id}-res-headers">
          ${renderHeaders(log.responseHeaders, '响应头')}
        </div>
        <div class="tab-panel ${activeTab === 'res-body' ? 'active' : ''}" data-tab="${log.id}-res-body">
          ${renderBody(log.responseBody, '响应体', log.id + '-res')}
        </div>
        ${log.error ? `<div class="tab-panel ${activeTab === 'error' ? 'active' : ''}" data-tab="${log.id}-error"><pre class="error-text">${escapeHtml(log.error)}</pre></div>` : ''}
      </div>
    </div>
  `;
}

function switchLogTab(event, logId, tabName) {
  event.stopPropagation();
  event.preventDefault();

  // 保存活跃tab状态
  activeTabMap.set(logId, tabName);

  const wrapper = event.target.closest('.log-detail');
  if (!wrapper) return;

  // 切换按钮状态
  wrapper.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  // 切换面板
  wrapper.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  const targetPanel = wrapper.querySelector(`[data-tab="${logId}-${tabName}"]`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
}

function renderHeaders(headers, title) {
  if (!headers || Object.keys(headers).length === 0) {
    return `<p class="empty-detail">无${title}数据</p>`;
  }

  const rows = Object.entries(headers).map(([key, value]) =>
    `<tr><td class="header-key">${escapeHtml(key)}</td><td class="header-value">${escapeHtml(String(value))}</td></tr>`
  ).join('');

  return `<table class="headers-table"><tbody>${rows}</tbody></table>`;
}

function renderBody(body, title, copyId) {
  if (!body) {
    return `<p class="empty-detail">无${title}数据</p>`;
  }

  if (body.type === 'binary') {
    return `
      <p class="empty-detail">
        <strong>[二进制数据]</strong><br>
        大小: ${formatBytes(body.size)}
      </p>
    `;
  }

  let content = '';
  if (body.type === 'json') {
    content = JSON.stringify(body.data, null, 2);
  } else {
    content = body.data;
  }

  return `
    <div class="body-header">
      <span class="body-header-title">大小: ${formatBytes(body.size)}</span>
      <button class="btn-copy" onclick="copyBodyContent(event, '${copyId}')">复制</button>
    </div>
    <pre class="body-content ${body.type === 'json' ? 'json' : ''}" data-copy-id="${copyId}">${escapeHtml(content)}</pre>
  `;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function switchLogTab(event, logId, tabName) {
  event.stopPropagation();
  event.preventDefault();

  const wrapper = event.target.closest('.log-detail');
  if (!wrapper) return;

  // 切换按钮状态
  const buttons = wrapper.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  // 切换面板
  const panels = wrapper.querySelectorAll('.tab-panel');
  panels.forEach(panel => panel.classList.remove('active'));
  const targetPanel = wrapper.querySelector(`[data-tab="${logId}-${tabName}"]`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
}

function getStatusClass(status) {
  if (!status) return '';
  if (status >= 200 && status < 300) return 'status-2xx';
  if (status >= 300 && status < 400) return 'status-3xx';
  if (status >= 400 && status < 500) return 'status-4xx';
  if (status >= 500) return 'status-5xx';
  return '';
}

async function manualRefreshLogs() {
  const btn = document.getElementById('btn-refresh-logs');
  btn.classList.add('loading');
  btn.disabled = true;
  await loadLogs();
  btn.classList.remove('loading');
  btn.disabled = false;
}

async function clearLogs() {
  if (!confirm('确定要清空所有日志吗？')) return;

  try {
    await fetch(API.logs, { method: 'DELETE' });
    loadLogs();
  } catch (err) {
    alert('清空日志失败: ' + err.message);
  }
}

function startAutoRefresh() {
  if (logsRefreshInterval) return;
  logsRefreshInterval = setInterval(() => {
    if (autoRefreshEnabled) loadLogs();
  }, 2000);
}

function stopAutoRefresh() {
  if (logsRefreshInterval) {
    clearInterval(logsRefreshInterval);
    logsRefreshInterval = null;
  }
}

// ===== Utils =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ===== Copy Body Content =====
function copyBodyContent(event, copyId) {
  event.stopPropagation();
  event.preventDefault();

  const preElement = document.querySelector(`[data-copy-id="${copyId}"]`);
  if (!preElement) return;

  const text = preElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '已复制';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 1500);
  }).catch(err => {
    console.error('复制失败:', err);
    alert('复制失败');
  });
}

// ===== Fullscreen Modal =====
const fullscreenModal = document.getElementById('fullscreen-modal');

function openFullscreenModal(event, logId) {
  event.stopPropagation();
  event.preventDefault();

  const log = logsData.find(l => l.id === logId);
  if (!log) return;

  const activeTab = activeTabMap.get(logId) || 'req-headers';
  const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');

  document.getElementById('fullscreen-modal-title').textContent = `请求详情 - ${log.method} ${log.originalUrl} (${time})`;
  document.getElementById('fullscreen-modal-body').innerHTML = renderLogDetail(log, activeTab, true);

  fullscreenModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeFullscreenModal() {
  fullscreenModal.classList.add('hidden');
  document.body.style.overflow = '';
}

// Add fullscreen modal to close handlers
fullscreenModal.addEventListener('click', (e) => {
  if (e.target === fullscreenModal) {
    closeFullscreenModal();
  }
});

// Global functions for onclick
window.editMapping = editMapping;
window.toggleMapping = toggleMapping;
window.deleteMapping = deleteMapping;
window.closeMappingModal = closeMappingModal;
window.editGroup = editGroup;
window.deleteGroup = deleteGroup;
window.closeGroupModal = closeGroupModal;
window.updateAction = updateAction;
window.removeAction = removeAction;
window.toggleLogDetail = toggleLogDetail;
window.switchLogTab = switchLogTab;
window.copyBodyContent = copyBodyContent;
window.openFullscreenModal = openFullscreenModal;
window.closeFullscreenModal = closeFullscreenModal;
window.editBodyGroup = editBodyGroup;
window.deleteBodyGroup = deleteBodyGroup;
window.closeBodyGroupModal = closeBodyGroupModal;
window.toggleBodyConfig = toggleBodyConfig;
