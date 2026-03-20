// --- State ---
const state = {
  session: null,
  tags: []
};

// --- API Helper ---
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  const folderModal = document.getElementById('folder-modal');
  const folderInput = document.getElementById('folder-input');
  const folderSubmit = document.getElementById('folder-submit');
  const folderError = document.getElementById('folder-error');
  const appEl = document.getElementById('app');

  // Check if folder is already configured
  try {
    const config = await api('GET', '/api/config/folder');
    if (config.folder) {
      folderModal.classList.add('hidden');
      appEl.classList.remove('hidden');
      await loadApp();
      return;
    }
  } catch { /* ignore */ }

  // Folder modal handlers
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
        renderBoard();
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

      // Find the task card the tag was dropped onto
      const cardEl = evt.to.closest('.task-card');
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
        renderBoard();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  // Make each task card accept tag drops
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
          renderBoard();
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
      renderBoard();
    } catch (err) {
      alert(err.message);
    }
  }

  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // New session
  document.getElementById('new-session-btn').addEventListener('click', async () => {
    if (!confirm('Start a new session? Tasks not marked as Done will carry over.')) return;
    try {
      const session = await api('POST', '/api/session/new');
      state.session = session;
      renderSessionInfo();
      renderBoard();
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
    if (e.key === 'Enter') addTag();
  });
}
