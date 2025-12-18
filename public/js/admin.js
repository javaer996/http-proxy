// API endpoints
const API = {
  mappings: '/api/mappings',
  requestGroups: '/api/request-groups',
  responseGroups: '/api/response-groups',
  logs: '/api/logs'
};

// DOM elements
const mappingsList = document.getElementById('mappings-list');
const requestGroupsList = document.getElementById('request-groups-list');
const responseGroupsList = document.getElementById('response-groups-list');
const logsList = document.getElementById('logs-list');
const mappingModal = document.getElementById('mapping-modal');
const requestGroupModal = document.getElementById('request-group-modal');
const responseGroupModal = document.getElementById('response-group-modal');

// State
let currentMappingId = null;
let currentRequestGroupId = null;
let currentResponseGroupId = null;
let requestHeaderActions = [];
let responseHeaderActions = [];
let requestGroups = [];
let responseGroups = [];
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

  // Request Group events
  document.getElementById('btn-add-request-group').addEventListener('click', () => openRequestGroupModal());
  document.getElementById('request-group-form').addEventListener('submit', saveRequestGroupHandler);

  // Response Group events
  document.getElementById('btn-add-response-group').addEventListener('click', () => openResponseGroupModal());
  document.getElementById('response-group-form').addEventListener('submit', saveResponseGroupHandler);

  // Log events
  document.getElementById('auto-refresh').addEventListener('change', (e) => {
    autoRefreshEnabled = e.target.checked;
    autoRefreshEnabled ? startAutoRefresh() : stopAutoRefresh();
  });
  document.getElementById('btn-refresh-logs').addEventListener('click', manualRefreshLogs);
  document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);

  // Modal close on background click
  [mappingModal, requestGroupModal, responseGroupModal].forEach(modal => {
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
      closeRequestGroupModal();
      closeResponseGroupModal();
      closeFullscreenModal();
    }
  });
}

async function loadAll() {
  await loadRequestGroups();
  await loadResponseGroups();
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
    const reqGroup = requestGroups.find(g => g.id === m.requestGroupId);
    const resGroup = responseGroups.find(g => g.id === m.responseGroupId);
    return `
      <div class="card ${m.enabled ? '' : 'disabled'}">
        <div class="card-info">
          <h4>
            <code>/${escapeHtml(m.key)}</code>
            ${m.enabled ? '<span class="status-badge enabled">启用</span>' : '<span class="status-badge disabled">禁用</span>'}
          </h4>
          <p class="meta">
            <span>目标: ${escapeHtml(m.targetUrl)}</span>
            ${reqGroup ? `<span>请求: ${escapeHtml(reqGroup.name)}</span>` : ''}
            ${resGroup ? `<span>响应: ${escapeHtml(resGroup.name)}</span>` : ''}
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

  // Populate request groups dropdown
  const reqSelect = document.getElementById('mapping-request-group');
  reqSelect.innerHTML = '<option value="">-- 不关联 --</option>' +
    requestGroups.map(g => `<option value="${g.id}" ${mapping?.requestGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');

  // Populate response groups dropdown
  const resSelect = document.getElementById('mapping-response-group');
  resSelect.innerHTML = '<option value="">-- 不关联 --</option>' +
    responseGroups.map(g => `<option value="${g.id}" ${mapping?.responseGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');

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
    requestGroupId: document.getElementById('mapping-request-group').value || null,
    responseGroupId: document.getElementById('mapping-response-group').value || null,
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

// ===== Request Groups =====
async function loadRequestGroups() {
  try {
    const res = await fetch(API.requestGroups);
    const { data } = await res.json();
    requestGroups = data || [];
    renderRequestGroups(requestGroups);
  } catch (err) {
    console.error('加载请求分组失败:', err);
    requestGroupsList.innerHTML = '<p class="empty">加载失败</p>';
  }
}

function renderRequestGroups(groups) {
  if (!groups || groups.length === 0) {
    requestGroupsList.innerHTML = '<p class="empty">暂无请求分组，点击"添加分组"创建</p>';
    return;
  }

  requestGroupsList.innerHTML = groups.map(g => {
    const headerCount = g.headerActions?.length || 0;
    const bodyType = g.body?.type ? (g.body.type === 'script' ? '脚本' : '替换') : '无';
    return `
      <div class="card">
        <div class="card-info">
          <h4>${escapeHtml(g.name)}</h4>
          <p class="meta">
            <span>Header操作: ${headerCount}</span>
            <span>Body: ${bodyType}</span>
            ${g.description ? `<span>${escapeHtml(g.description)}</span>` : ''}
          </p>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="editRequestGroup('${g.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRequestGroup('${g.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function openRequestGroupModal(group = null) {
  currentRequestGroupId = group?.id || null;
  document.getElementById('request-group-modal-title').textContent = group ? '编辑请求分组' : '添加请求分组';

  document.getElementById('request-group-id').value = group?.id || '';
  document.getElementById('request-group-name').value = group?.name || '';
  document.getElementById('request-group-desc').value = group?.description || '';

  requestHeaderActions = group?.headerActions ? JSON.parse(JSON.stringify(group.headerActions)) : [];
  renderRequestHeaderActions();

  document.getElementById('request-body-type').value = group?.body?.type || '';
  document.getElementById('request-body-content').value = group?.body?.content || '';
  toggleRequestBodyConfig();

  requestGroupModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeRequestGroupModal() {
  requestGroupModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentRequestGroupId = null;
  requestHeaderActions = [];
}

function renderRequestHeaderActions() {
  const container = document.getElementById('request-header-actions');
  if (requestHeaderActions.length === 0) {
    container.innerHTML = '<p class="empty" style="padding: 20px;">暂无操作</p>';
    return;
  }
  container.innerHTML = requestHeaderActions.map((action, index) => `
    <div class="action-item">
      <select onchange="updateRequestHeaderAction(${index}, 'type', this.value)">
        <option value="add" ${action.type === 'add' ? 'selected' : ''}>添加</option>
        <option value="set" ${action.type === 'set' ? 'selected' : ''}>覆盖</option>
        <option value="delete" ${action.type === 'delete' ? 'selected' : ''}>删除</option>
      </select>
      <input type="text" placeholder="Header名称" value="${escapeHtml(action.headerName || '')}"
             onchange="updateRequestHeaderAction(${index}, 'headerName', this.value)">
      <input type="text" placeholder="Header值" value="${escapeHtml(action.headerValue || '')}"
             onchange="updateRequestHeaderAction(${index}, 'headerValue', this.value)"
             ${action.type === 'delete' ? 'disabled style="opacity:0.5"' : ''}>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeRequestHeaderAction(${index})">删除</button>
    </div>
  `).join('');
}

function addRequestHeaderAction() {
  requestHeaderActions.push({ type: 'add', headerName: '', headerValue: '' });
  renderRequestHeaderActions();
}

function updateRequestHeaderAction(index, field, value) {
  requestHeaderActions[index][field] = value;
  if (field === 'type' && value === 'delete') requestHeaderActions[index].headerValue = '';
  if (field === 'type') renderRequestHeaderActions();
}

function removeRequestHeaderAction(index) {
  requestHeaderActions.splice(index, 1);
  renderRequestHeaderActions();
}

function toggleRequestBodyConfig() {
  const type = document.getElementById('request-body-type').value;
  const config = document.getElementById('request-body-config');
  config.classList.toggle('hidden', !type);
}

async function saveRequestGroupHandler(e) {
  e.preventDefault();
  const bodyType = document.getElementById('request-body-type').value;
  const data = {
    name: document.getElementById('request-group-name').value.trim(),
    description: document.getElementById('request-group-desc').value.trim(),
    headerActions: requestHeaderActions.filter(a => a.headerName?.trim()),
    body: bodyType ? { type: bodyType, content: document.getElementById('request-body-content').value } : null
  };
  if (!data.name) { alert('请输入分组名称'); return; }
  try {
    const url = currentRequestGroupId ? `${API.requestGroups}/${currentRequestGroupId}` : API.requestGroups;
    const res = await fetch(url, { method: currentRequestGroupId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await res.json();
    if (result.success) { closeRequestGroupModal(); loadAll(); } else { alert('保存失败: ' + result.message); }
  } catch (err) { alert('保存失败: ' + err.message); }
}

async function editRequestGroup(id) {
  try {
    const res = await fetch(`${API.requestGroups}/${id}`);
    const { data } = await res.json();
    openRequestGroupModal(data);
  } catch (err) { alert('获取分组失败: ' + err.message); }
}

async function deleteRequestGroup(id) {
  if (!confirm('确定要删除这个分组吗？')) return;
  try { await fetch(`${API.requestGroups}/${id}`, { method: 'DELETE' }); loadAll(); }
  catch (err) { alert('删除失败: ' + err.message); }
}

// ===== Response Groups =====
async function loadResponseGroups() {
  try {
    const res = await fetch(API.responseGroups);
    const { data } = await res.json();
    responseGroups = data || [];
    renderResponseGroups(responseGroups);
  } catch (err) {
    console.error('加载响应分组失败:', err);
    responseGroupsList.innerHTML = '<p class="empty">加载失败</p>';
  }
}

function renderResponseGroups(groups) {
  if (!groups || groups.length === 0) {
    responseGroupsList.innerHTML = '<p class="empty">暂无响应分组，点击"添加分组"创建</p>';
    return;
  }

  responseGroupsList.innerHTML = groups.map(g => {
    const headerCount = g.headerActions?.length || 0;
    const bodyType = g.body?.type ? (g.body.type === 'script' ? '脚本' : '替换') : '无';
    const mockLabel = g.mockMode ? ' [Mock]' : '';
    return `
      <div class="card">
        <div class="card-info">
          <h4>${escapeHtml(g.name)}${mockLabel}</h4>
          <p class="meta">
            <span>Header操作: ${headerCount}</span>
            <span>Body: ${bodyType}</span>
            ${g.statusCode ? `<span>状态码: ${g.statusCode}</span>` : ''}
            ${g.description ? `<span>${escapeHtml(g.description)}</span>` : ''}
          </p>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="editResponseGroup('${g.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteResponseGroup('${g.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function openResponseGroupModal(group = null) {
  currentResponseGroupId = group?.id || null;
  document.getElementById('response-group-modal-title').textContent = group ? '编辑响应分组' : '添加响应分组';

  document.getElementById('response-group-id').value = group?.id || '';
  document.getElementById('response-group-name').value = group?.name || '';
  document.getElementById('response-group-desc').value = group?.description || '';
  document.getElementById('response-mock-mode').checked = group?.mockMode || false;
  document.getElementById('response-status-code').value = group?.statusCode || '';

  responseHeaderActions = group?.headerActions ? JSON.parse(JSON.stringify(group.headerActions)) : [];
  renderResponseHeaderActions();

  document.getElementById('response-body-type').value = group?.body?.type || '';
  document.getElementById('response-body-content').value = group?.body?.content || '';
  toggleResponseBodyConfig();

  responseGroupModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeResponseGroupModal() {
  responseGroupModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentResponseGroupId = null;
  responseHeaderActions = [];
}

function renderResponseHeaderActions() {
  const container = document.getElementById('response-header-actions');
  if (responseHeaderActions.length === 0) {
    container.innerHTML = '<p class="empty" style="padding: 20px;">暂无操作</p>';
    return;
  }
  container.innerHTML = responseHeaderActions.map((action, index) => `
    <div class="action-item">
      <select onchange="updateResponseHeaderAction(${index}, 'type', this.value)">
        <option value="add" ${action.type === 'add' ? 'selected' : ''}>添加</option>
        <option value="set" ${action.type === 'set' ? 'selected' : ''}>覆盖</option>
        <option value="delete" ${action.type === 'delete' ? 'selected' : ''}>删除</option>
      </select>
      <input type="text" placeholder="Header名称" value="${escapeHtml(action.headerName || '')}"
             onchange="updateResponseHeaderAction(${index}, 'headerName', this.value)">
      <input type="text" placeholder="Header值" value="${escapeHtml(action.headerValue || '')}"
             onchange="updateResponseHeaderAction(${index}, 'headerValue', this.value)"
             ${action.type === 'delete' ? 'disabled style="opacity:0.5"' : ''}>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeResponseHeaderAction(${index})">删除</button>
    </div>
  `).join('');
}

function addResponseHeaderAction() {
  responseHeaderActions.push({ type: 'add', headerName: '', headerValue: '' });
  renderResponseHeaderActions();
}

function updateResponseHeaderAction(index, field, value) {
  responseHeaderActions[index][field] = value;
  if (field === 'type' && value === 'delete') responseHeaderActions[index].headerValue = '';
  if (field === 'type') renderResponseHeaderActions();
}

function removeResponseHeaderAction(index) {
  responseHeaderActions.splice(index, 1);
  renderResponseHeaderActions();
}

function toggleResponseBodyConfig() {
  const type = document.getElementById('response-body-type').value;
  const config = document.getElementById('response-body-config');
  config.classList.toggle('hidden', !type);
}

async function saveResponseGroupHandler(e) {
  e.preventDefault();
  const bodyType = document.getElementById('response-body-type').value;
  const statusCode = document.getElementById('response-status-code').value;
  const data = {
    name: document.getElementById('response-group-name').value.trim(),
    description: document.getElementById('response-group-desc').value.trim(),
    mockMode: document.getElementById('response-mock-mode').checked,
    statusCode: statusCode ? parseInt(statusCode) : null,
    headerActions: responseHeaderActions.filter(a => a.headerName?.trim()),
    body: bodyType ? { type: bodyType, content: document.getElementById('response-body-content').value } : null
  };
  if (!data.name) { alert('请输入分组名称'); return; }
  try {
    const url = currentResponseGroupId ? `${API.responseGroups}/${currentResponseGroupId}` : API.responseGroups;
    const res = await fetch(url, { method: currentResponseGroupId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await res.json();
    if (result.success) { closeResponseGroupModal(); loadAll(); } else { alert('保存失败: ' + result.message); }
  } catch (err) { alert('保存失败: ' + err.message); }
}

async function editResponseGroup(id) {
  try {
    const res = await fetch(`${API.responseGroups}/${id}`);
    const { data } = await res.json();
    openResponseGroupModal(data);
  } catch (err) { alert('获取分组失败: ' + err.message); }
}

async function deleteResponseGroup(id) {
  if (!confirm('确定要删除这个分组吗？')) return;
  try { await fetch(`${API.responseGroups}/${id}`, { method: 'DELETE' }); loadAll(); }
  catch (err) { alert('删除失败: ' + err.message); }
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

// ===== Collapsible Sections =====
function toggleSection(header) {
  const section = header.closest('.collapsible');
  section.classList.toggle('collapsed');
}

// Global functions for onclick
window.toggleSection = toggleSection;
window.editMapping = editMapping;
window.toggleMapping = toggleMapping;
window.deleteMapping = deleteMapping;
window.closeMappingModal = closeMappingModal;
window.toggleLogDetail = toggleLogDetail;
window.switchLogTab = switchLogTab;
window.copyBodyContent = copyBodyContent;
window.openFullscreenModal = openFullscreenModal;
window.closeFullscreenModal = closeFullscreenModal;
// Request Group
window.editRequestGroup = editRequestGroup;
window.deleteRequestGroup = deleteRequestGroup;
window.closeRequestGroupModal = closeRequestGroupModal;
window.addRequestHeaderAction = addRequestHeaderAction;
window.updateRequestHeaderAction = updateRequestHeaderAction;
window.removeRequestHeaderAction = removeRequestHeaderAction;
window.toggleRequestBodyConfig = toggleRequestBodyConfig;
// Response Group
window.editResponseGroup = editResponseGroup;
window.deleteResponseGroup = deleteResponseGroup;
window.closeResponseGroupModal = closeResponseGroupModal;
window.addResponseHeaderAction = addResponseHeaderAction;
window.updateResponseHeaderAction = updateResponseHeaderAction;
window.removeResponseHeaderAction = removeResponseHeaderAction;
window.toggleResponseBodyConfig = toggleResponseBodyConfig;
