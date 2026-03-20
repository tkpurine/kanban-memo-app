// --- PWA: Register Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// --- State ---
const state = {
  session: null,
  tags: [],
  viewMode: 'kanban'
};

// --- Auth Token ---
let authToken = localStorage.getItem('kanban_auth_token') || '';

// --- API Helper ---
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (authToken) {
    opts.headers['X-Auth-Token'] = authToken;
  }
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (res.status === 401) {
    // Token expired or invalid — show login
    localStorage.removeItem('kanban_auth_token');
    authToken = '';
    location.reload();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  const loginModal = document.getElementById('login-modal');
  const loginInput = document.getElementById('login-input');
  const loginSubmit = document.getElementById('login-submit');
  const loginError = document.getElementById('login-error');
  const folderModal = document.getElementById('folder-modal');
  const folderInput = document.getElementById('folder-input');
  const folderSubmit = document.getElementById('folder-submit');
  const folderError = document.getElementById('folder-error');
  const appEl = document.getElementById('app');

  // Check if auth is required
  try {
    const authCheck = await fetch('/api/auth/check').then(r => r.json());
    if (authCheck.authRequired && !authToken) {
      loginModal.classList.remove('hidden');
      folderModal.classList.add('hidden');
      setupLogin();
      return;
    }
  } catch { /* ignore */ }

  await proceedAfterAuth();

  // Login handlers
  function setupLogin() {
    async function submitLogin() {
      const password = loginInput.value;
      if (!password) {
        loginError.textContent = 'Please enter a password.';
        return;
      }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!res.ok) {
          loginError.textContent = data.error || 'Login failed';
          return;
        }
        authToken = data.token;
        localStorage.setItem('kanban_auth_token', authToken);
        loginError.textContent = '';
        loginModal.classList.add('hidden');
        await proceedAfterAuth();
      } catch (err) {
        loginError.textContent = err.message;
      }
    }

    loginSubmit.addEventListener('click', submitLogin);
    loginInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitLogin();
    });
  }

  // After auth, check folder config
  async function proceedAfterAuth() {
    try {
      const config = await api('GET', '/api/config/folder');
      if (config.folder) {
        folderModal.classList.add('hidden');
        appEl.classList.remove('hidden');
        await loadApp();
        return;
      }
    } catch { /* ignore */ }

    folderModal.classList.remove('hidden');
    setupFolderModal();
  }

  // Folder modal handlers
  function setupFolderModal() {
    async function submitFolder() {
      const folder = folderInput.value.trim();
      if (!folder) {
        folderError.textContent = 'Please enter a folder path.';
        return;
      }
      try {
        await api('POST', '/api/config/folder', { folder });
        folderError.textContent = '';
        folderModal.classList.add('hidden');
        appEl.classList.remove('hidden');
        await loadApp();
      } catch (err) {
        folderError.textContent = err.message;
      }
    }

    folderSubmit.addEventListener('click', submitFolder);
    folderInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitFolder();
    });
  }
});

// --- Load App ---
async function loadApp() {
  const [session, tagData] = await Promise.all([
    api('GET', '/api/session/current'),
    api('GET', '/api/tags')
  ]);
  state.session = session;
  state.tags = tagData.tags;

  renderSessionInfo();
  renderBoard();
  renderTags();
  initSortable();
  initEventHandlers();
}

// --- View Mode ---
function switchViewMode(mode) {
  state.viewMode = mode;
  const board = document.getElementById('board');
  const listView = document.getElementById('list-view');
  const kanbanBtn = document.getElementById('kanban-view-btn');
  const listBtn = document.getElementById('list-view-btn');

  if (mode === 'kanban') {
    board.classList.remove('hidden');
    listView.classList.add('hidden');
    kanbanBtn.classList.add('active');
    listBtn.classList.remove('active');
    renderBoard();
    initTagSortable();
  } else {
    board.classList.add('hidden');
    listView.classList.remove('hidden');
    kanbanBtn.classList.remove('active');
    listBtn.classList.add('active');
    renderListView();
  }
}

// --- Render: current view ---
function renderCurrentView() {
  if (state.viewMode === 'list') {
    renderListView();
  } else {
    renderBoard();
  }
}

// --- Render: Session Info ---
function renderSessionInfo() {
  const el = document.getElementById('session-time');
  if (!state.session) {
    el.textContent = '';
    return;
  }
  const start = new Date(state.session.startedAt);
  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  el.textContent = `Started: ${fmt(start)} ~ Now`;
}

// --- Render: Board ---
function renderBoard() {
  const columns = document.querySelectorAll('.column .task-list');
  columns.forEach(col => { col.innerHTML = ''; });

  if (!state.session) return;

  state.session.tasks.forEach(task => {
    const col = document.querySelector(`.column[data-status="${task.status}"] .task-list`);
    if (!col) return;
    col.appendChild(createTaskCard(task));
  });
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.taskId = task.id;

  const content = document.createElement('div');
  content.className = 'task-content';
  content.textContent = task.content;
  card.appendChild(content);

  // Double-click to edit
  content.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (content.contentEditable === 'true') return;

    content.contentEditable = 'true';
    content.classList.add('editing');
    content.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(content);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    async function save() {
      content.contentEditable = 'false';
      content.classList.remove('editing');
      const newText = content.textContent.trim();
      if (!newText || newText === task.content) {
        content.textContent = task.content;
        return;
      }
      try {
        const updated = await api('PUT', `/api/task/${task.id}`, { content: newText });
        const idx = state.session.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) state.session.tasks[idx] = updated;
        content.textContent = updated.content;
      } catch (err) {
        content.textContent = task.content;
        alert(err.message);
      }
    }

    content.addEventListener('blur', save, { once: true });
    content.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        content.blur();
      }
      if (ev.key === 'Escape') {
        content.textContent = task.content;
        content.blur();
      }
    });
  });

  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'task-tags';

  task.tagIds.forEach(tagId => {
    const tag = state.tags.find(t => t.id === tagId);
    if (!tag) return;

    const badge = document.createElement('span');
    badge.className = 'tag-badge';
    badge.textContent = tag.name;

    const removeBtn = document.createElement('span');
    removeBtn.className = 'tag-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const updated = await api('DELETE', `/api/task/${task.id}/tags/${tagId}`);
        const idx = state.session.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) state.session.tasks[idx] = updated;
        renderCurrentView();
      } catch (err) {
        alert(err.message);
      }
    });

    badge.appendChild(removeBtn);
    tagsContainer.appendChild(badge);
  });

  card.appendChild(tagsContainer);
  return card;
}

// --- Render: List View ---
function renderListView() {
  const container = document.getElementById('list-task-list');
  container.innerHTML = '';

  if (!state.session) return;

  const visibleTasks = state.session.tasks.filter(t => t.status !== 'done');

  visibleTasks.forEach(task => {
    const row = document.createElement('div');
    row.className = 'list-task-row';
    row.dataset.taskId = task.id;

    const handle = document.createElement('span');
    handle.className = 'list-drag-handle';
    handle.textContent = '≡';
    row.appendChild(handle);

    const content = document.createElement('div');
    content.className = 'list-task-content';
    content.textContent = task.content;
    row.appendChild(content);

    // Double-click to edit in list view
    content.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (content.contentEditable === 'true') return;

      content.contentEditable = 'true';
      content.classList.add('editing');
      content.focus();

      const range = document.createRange();
      range.selectNodeContents(content);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      async function save() {
        content.contentEditable = 'false';
        content.classList.remove('editing');
        const newText = content.textContent.trim();
        if (!newText || newText === task.content) {
          content.textContent = task.content;
          return;
        }
        try {
          const updated = await api('PUT', `/api/task/${task.id}`, { content: newText });
          const idx = state.session.tasks.findIndex(t => t.id === task.id);
          if (idx !== -1) state.session.tasks[idx] = updated;
          content.textContent = updated.content;
        } catch (err) {
          content.textContent = task.content;
          alert(err.message);
        }
      }

      content.addEventListener('blur', save, { once: true });
      content.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          content.blur();
        }
        if (ev.key === 'Escape') {
          content.textContent = task.content;
          content.blur();
        }
      });
    });

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'task-tags list-task-tags';
    task.tagIds.forEach(tagId => {
      const tag = state.tags.find(t => t.id === tagId);
      if (!tag) return;

      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.textContent = tag.name;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'tag-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const updated = await api('DELETE', `/api/task/${task.id}/tags/${tagId}`);
          const idx = state.session.tasks.findIndex(t => t.id === task.id);
          if (idx !== -1) state.session.tasks[idx] = updated;
          renderListView();
        } catch (err) {
          alert(err.message);
        }
      });

      badge.appendChild(removeBtn);
      tagsContainer.appendChild(badge);
    });
    row.appendChild(tagsContainer);

    const statusSelect = document.createElement('select');
    statusSelect.className = 'list-status-select';
    [
      { value: 'todo', label: 'Todo' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'waiting', label: 'Waiting' },
      { value: 'done', label: 'Done' }
    ].forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (task.status === opt.value) option.selected = true;
      statusSelect.appendChild(option);
    });

    statusSelect.addEventListener('change', async (e) => {
      e.stopPropagation();
      try {
        const updated = await api('PUT', `/api/task/${task.id}`, { status: statusSelect.value });
        const idx = state.session.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) state.session.tasks[idx] = updated;
      } catch (err) {
        alert(err.message);
        renderListView();
      }
    });

    row.appendChild(statusSelect);
    container.appendChild(row);
  });

  initListSortable();
  initTagSortable();
}

// --- Render: Tags ---
function renderTags() {
  const list = document.getElementById('tag-list');
  list.innerHTML = '';

  state.tags.forEach(tag => {
    const item = document.createElement('div');
    item.className = 'tag-item';
    item.dataset.tagId = tag.id;
    item.textContent = tag.name;
    list.appendChild(item);
  });

  // Reinitialize tag dragging after re-render
  initTagSortable();
}

// --- SortableJS Setup ---
let tagSortableInstance = null;
let listSortableInstance = null;

function initSortable() {
  // Task columns — drag tasks between columns
  document.querySelectorAll('.task-list').forEach(list => {
    new Sortable(list, {
      group: 'tasks',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: async (evt) => {
        const taskId = evt.item.dataset.taskId;
        const newStatus = evt.to.closest('.column').dataset.status;
        try {
          const updated = await api('PUT', `/api/task/${taskId}`, { status: newStatus });
          const idx = state.session.tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) state.session.tasks[idx] = updated;
        } catch (err) {
          alert(err.message);
          renderBoard();
        }
      }
    });
  });
}

function initListSortable() {
  if (listSortableInstance) {
    listSortableInstance.destroy();
    listSortableInstance = null;
  }

  const container = document.getElementById('list-task-list');
  listSortableInstance = new Sortable(container, {
    animation: 150,
    handle: '.list-drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: async () => {
      const visibleTaskIds = [...container.querySelectorAll('.list-task-row')].map(el => el.dataset.taskId);
      const doneTaskIds = state.session.tasks.filter(t => t.status === 'done').map(t => t.id);
      const allTaskIds = [...visibleTaskIds, ...doneTaskIds];
      try {
        await api('PUT', '/api/tasks/order', { taskIds: allTaskIds });
        const reordered = [];
        allTaskIds.forEach(id => {
          const task = state.session.tasks.find(t => t.id === id);
          if (task) reordered.push(task);
        });
        state.session.tasks = reordered;
      } catch (err) {
        alert(err.message);
        renderListView();
      }
    }
  });
}

function initTagSortable() {
  // Destroy previous instance to avoid duplicates
  if (tagSortableInstance) {
    tagSortableInstance.destroy();
  }

  const tagList = document.getElementById('tag-list');
  tagSortableInstance = new Sortable(tagList, {
    group: {
      name: 'tags',
      pull: 'clone',
      put: false
    },
    sort: false,
    animation: 150,
    onEnd: async (evt) => {
      // Remove the cloned element from wherever it was dropped
      if (evt.item.parentElement && evt.item.parentElement.id !== 'tag-list') {
        evt.item.remove();
      }

      // Find the task element the tag was dropped onto (kanban card or list row)
      const cardEl = evt.to.closest('.task-card') || evt.to.closest('.list-task-row');
      if (!cardEl) return;

      const taskId = cardEl.dataset.taskId;
      const tagId = evt.item.dataset.tagId;
      const task = state.session.tasks.find(t => t.id === taskId);
      if (!task || task.tagIds.includes(tagId)) return;

      try {
        const newTagIds = [...task.tagIds, tagId];
        const updated = await api('PUT', `/api/task/${taskId}`, { tagIds: newTagIds });
        const idx = state.session.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) state.session.tasks[idx] = updated;
        renderCurrentView();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  // Make each kanban task card accept tag drops
  document.querySelectorAll('.task-card').forEach(card => {
    new Sortable(card, {
      group: {
        name: 'tags',
        pull: false,
        put: true
      },
      sort: false,
      onAdd: async (evt) => {
        const tagId = evt.item.dataset.tagId;
        const taskId = card.dataset.taskId;

        // Remove the cloned element
        evt.item.remove();

        const task = state.session.tasks.find(t => t.id === taskId);
        if (!task || task.tagIds.includes(tagId)) return;

        try {
          const newTagIds = [...task.tagIds, tagId];
          const updated = await api('PUT', `/api/task/${taskId}`, { tagIds: newTagIds });
          const idx = state.session.tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) state.session.tasks[idx] = updated;
          renderCurrentView();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  });

  // Make each list task row accept tag drops
  document.querySelectorAll('.list-task-row').forEach(row => {
    new Sortable(row, {
      group: {
        name: 'tags',
        pull: false,
        put: true
      },
      sort: false,
      onAdd: async (evt) => {
        const tagId = evt.item.dataset.tagId;
        const taskId = row.dataset.taskId;

        evt.item.remove();

        const task = state.session.tasks.find(t => t.id === taskId);
        if (!task || task.tagIds.includes(tagId)) return;

        try {
          const newTagIds = [...task.tagIds, tagId];
          const updated = await api('PUT', `/api/task/${taskId}`, { tagIds: newTagIds });
          const idx = state.session.tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) state.session.tasks[idx] = updated;
          renderListView();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  });
}

// --- Event Handlers ---
function initEventHandlers() {
  // Add task
  const taskInput = document.getElementById('task-input');
  const addTaskBtn = document.getElementById('add-task-btn');

  async function addTask() {
    const content = taskInput.value.trim();
    if (!content) return;
    try {
      const task = await api('POST', '/api/task', { content });
      state.session.tasks.push(task);
      taskInput.value = '';
      renderCurrentView();
    } catch (err) {
      alert(err.message);
    }
  }

  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addTask();
  });

  // New session
  document.getElementById('new-session-btn').addEventListener('click', async () => {
    if (!confirm('Start a new session? Tasks not marked as Done will carry over.')) return;
    try {
      const session = await api('POST', '/api/session/new');
      state.session = session;
      renderSessionInfo();
      renderCurrentView();
    } catch (err) {
      alert(err.message);
    }
  });

  // Add tag
  const tagInput = document.getElementById('tag-input');
  const addTagBtn = document.getElementById('add-tag-btn');

  async function addTag() {
    const name = tagInput.value.trim();
    if (!name) return;
    try {
      const tag = await api('POST', '/api/tags', { name });
      state.tags.push(tag);
      tagInput.value = '';
      renderTags();
    } catch (err) {
      alert(err.message);
    }
  }

  addTagBtn.addEventListener('click', addTag);
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addTag();
  });

  // View toggle
  document.getElementById('kanban-view-btn').addEventListener('click', () => switchViewMode('kanban'));
  document.getElementById('list-view-btn').addEventListener('click', () => switchViewMode('list'));
}
