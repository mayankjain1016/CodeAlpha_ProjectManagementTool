/**
 * TaskFlow Kanban Board Page Logic
 * Complete Drag & Drop, Keyboard Navigation, Inline Task Creation,
 * Deep-linkable Task Drawer, Filters, and Project Settings.
 */

import { api } from '../core/api.js';
import { getUser, requireAuth } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { renderAvatar, renderAvatarGroup } from '../core/avatar.js';
import { initShell, loadSidebarData } from '../core/shell.js';
import { openModal, closeModal } from '../core/modal.js';
import { showToast } from '../core/toast.js';
import { escapeHtml } from '../core/utils.js';
import { renderTaskCard } from '../components/taskCard.js';
import { initTaskDrawer, openTaskDrawer } from '../components/taskDrawer.js';
import { setupMemberSearch } from '../components/memberPicker.js';

let project = null;
let allTasks = [];
let draggedTaskId = null;
let keyboardGrabbedTask = null;
let dragPlaceholder = null;

const COLUMNS = ['todo', 'in_progress', 'done'];
const PROJECT_COLORS = ['#6366F1', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#10B981'];

if (requireAuth()) {
  initBoardPage();
}

async function initBoardPage() {
  await initShell('board');

  const contentArea = document.getElementById('page-content');
  const template = document.getElementById('board-template');
  if (!contentArea || !template) return;

  contentArea.innerHTML = '';
  contentArea.appendChild(template.content.cloneNode(true));

  // Inject Icons into slots
  injectPageIcons();

  // Extract Project ID from URL (/projects/:id)
  const pathParts = window.location.pathname.split('/');
  const projectId = pathParts[pathParts.length - 1];

  if (!projectId) {
    showBoardError('Invalid project URL');
    return;
  }

  // Fetch Project and Tasks
  try {
    const res = await api.get(`/projects/${projectId}`);
    project = res.project;
    allTasks = res.tasks || [];

    setupBoardHeader();
    setupFilters();
    setupComposers();
    renderAllTasks();
    setupDragAndDrop();
    setupKeyboardNavigation();
    setupProjectSettings();

    // Init Drawer
    initTaskDrawer({
      project,
      onUpdate: (updatedTask, isMoved) => {
        const idx = allTasks.findIndex((t) => t.id === updatedTask.id);
        if (idx !== -1) {
          allTasks[idx] = updatedTask;
        } else {
          allTasks.push(updatedTask);
        }
        if (isMoved) {
          renderAllTasks();
        } else {
          // Update card in place
          const card = document.getElementById(`task-${updatedTask.id}`);
          if (card) {
            const temp = document.createElement('div');
            temp.innerHTML = renderTaskCard(updatedTask);
            card.replaceWith(temp.firstElementChild);
            attachCardEvents(document.getElementById(`task-${updatedTask.id}`));
          }
        }
        updateColumnCounts();
      },
      onDelete: (deletedTaskId) => {
        allTasks = allTasks.filter((t) => t.id !== deletedTaskId);
        document.getElementById(`task-${deletedTaskId}`)?.remove();
        updateColumnCounts();
      },
    });
  } catch (err) {
    showBoardError(err.message || 'You do not have access to this project');
  }
}

function injectPageIcons() {
  document.getElementById('btn-invite-member').innerHTML = `${icon('users', 'icon-sm')} <span>Members</span>`;
  document.getElementById('btn-project-settings').innerHTML = icon('settings', 'icon-md');
  document.getElementById('filter-search-icon-slot').innerHTML = icon('search', 'icon-sm');
  document.getElementById('clear-icon-slot').innerHTML = icon('x', 'icon-sm');
  document.getElementById('close-settings-icon-slot').innerHTML = icon('x', 'icon-md');
  document.querySelectorAll('.close-confirm-icon-slot, .close-touch-icon-slot').forEach((el) => {
    el.innerHTML = icon('x', 'icon-md');
  });

  COLUMNS.forEach((col) => {
    document.querySelector(`[data-add-column="${col}"]`).innerHTML = icon('plus', 'icon-sm');
    document.querySelector(`[data-open-composer="${col}"] .open-icon-slot`).innerHTML = icon('plus', 'icon-sm');
  });
}

function showBoardError(msg) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `
    <div class="empty-state" style="margin-top: 80px;">
      <div class="empty-state-icon" style="color: var(--priority-high);">
        ${icon('alert-circle', 'icon-lg')}
      </div>
      <div class="empty-state-title">Unable to access project</div>
      <div class="empty-state-desc">${escapeHtml(msg)}</div>
      <a href="/dashboard" class="btn btn-primary" style="margin-top: 8px;">
        ${icon('layout-grid', 'icon-sm')} Return to Dashboard
      </a>
    </div>
  `;
}

function setupBoardHeader() {
  document.title = `${project.name} - TaskFlow`;

  const colorIndicator = document.getElementById('board-color-indicator');
  const title = document.getElementById('board-title');
  const desc = document.getElementById('board-desc');
  const membersGroup = document.getElementById('board-members-group');

  if (colorIndicator) colorIndicator.style.backgroundColor = project.color;
  if (title) title.textContent = project.name;
  if (desc) desc.textContent = project.description || '';

  if (membersGroup) {
    membersGroup.innerHTML = renderAvatarGroup(project.members, 5, 28);
    membersGroup.onclick = () => {
      openModal(document.getElementById('modal-project-settings'));
    };
  }

  const inviteBtn = document.getElementById('btn-invite-member');
  if (inviteBtn) {
    inviteBtn.onclick = () => {
      openModal(document.getElementById('modal-project-settings'));
      document.getElementById('member-search-input')?.focus();
    };
  }

  const settingsBtn = document.getElementById('btn-project-settings');
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      openModal(document.getElementById('modal-project-settings'));
    };
  }
}

/* ========================================================
   Filtering System
   ======================================================== */
function setupFilters() {
  const textInput = document.getElementById('filter-text');
  const assigneeSelect = document.getElementById('filter-assignee');
  const prioritySelect = document.getElementById('filter-priority');
  const clearBtn = document.getElementById('btn-clear-filters');

  // Populate assignee filter with project members
  if (project && project.members) {
    project.members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      assigneeSelect.appendChild(opt);
    });
  }

  function applyFilters() {
    const q = textInput.value.trim().toLowerCase();
    const assignee = assigneeSelect.value;
    const priority = prioritySelect.value;
    const currentUser = getUser();

    const isFiltered = q || assignee !== 'all' || priority !== 'all';
    clearBtn.style.display = isFiltered ? 'inline-flex' : 'none';

    document.querySelectorAll('.task-card').forEach((card) => {
      const taskId = card.getAttribute('data-id');
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      let match = true;

      if (q && !task.title.toLowerCase().includes(q) && !(task.description && task.description.toLowerCase().includes(q))) {
        match = false;
      }

      if (assignee !== 'all') {
        if (assignee === 'me') {
          if (!task.assignee || task.assignee.id !== currentUser.id) match = false;
        } else if (assignee === 'unassigned') {
          if (task.assignee) match = false;
        } else {
          if (!task.assignee || task.assignee.id !== assignee) match = false;
        }
      }

      if (priority !== 'all' && task.priority !== priority) {
        match = false;
      }

      card.style.display = match ? 'flex' : 'none';
    });

    updateColumnCounts();
  }

  textInput.addEventListener('input', applyFilters);
  assigneeSelect.addEventListener('change', applyFilters);
  prioritySelect.addEventListener('change', applyFilters);

  clearBtn.onclick = () => {
    textInput.value = '';
    assigneeSelect.value = 'all';
    prioritySelect.value = 'all';
    applyFilters();
  };
}

/* ========================================================
   Task Rendering & Counts
   ======================================================== */
function renderAllTasks() {
  COLUMNS.forEach((col) => {
    const list = document.getElementById(`tasks-${col}`);
    if (!list) return;

    const columnTasks = allTasks
      .filter((t) => t.status === col)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    list.innerHTML = columnTasks.map(renderTaskCard).join('');

    list.querySelectorAll('.task-card').forEach(attachCardEvents);
  });

  updateColumnCounts();
}

function updateColumnCounts() {
  COLUMNS.forEach((col) => {
    const list = document.getElementById(`tasks-${col}`);
    const badge = document.getElementById(`badge-${col}`);
    if (list && badge) {
      const visibleCount = Array.from(list.children).filter((c) => c.classList.contains('task-card') && c.style.display !== 'none').length;
      badge.textContent = visibleCount;
    }
  });
}

function attachCardEvents(card) {
  if (!card) return;
  const taskId = card.getAttribute('data-id');

  // Click opens drawer
  card.onclick = (e) => {
    // If clicking menu button, open touch menu instead
    if (e.target.closest('[data-card-menu]')) {
      e.stopPropagation();
      openTouchMoveModal(taskId);
      return;
    }
    openTaskDrawer(taskId);
  };

  // Dragstart & Dragend
  card.ondragstart = (e) => {
    draggedTaskId = taskId;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    // Create placeholder element
    if (!dragPlaceholder) {
      dragPlaceholder = document.createElement('div');
      dragPlaceholder.className = 'drag-placeholder';
    }
  };

  card.ondragend = () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.kanban-column').forEach((col) => col.classList.remove('drag-over'));
    dragPlaceholder?.remove();
    draggedTaskId = null;
  };
}

/* ========================================================
   Inline Task Composers
   ======================================================== */
function setupComposers() {
  COLUMNS.forEach((col) => {
    const openBtn = document.querySelector(`[data-open-composer="${col}"]`);
    const composer = document.getElementById(`composer-${col}`);
    const input = document.getElementById(`composer-input-${col}`);
    const cancelBtn = document.querySelector(`[data-cancel-composer="${col}"]`);
    const submitBtn = document.querySelector(`[data-submit-composer="${col}"]`);
    const openWrapper = document.getElementById(`btn-open-wrapper-${col}`);

    if (!openBtn || !composer || !input) return;

    const openComposer = () => {
      composer.style.display = 'block';
      openWrapper.style.display = 'none';
      input.value = '';
      input.focus();
    };

    const closeComposer = () => {
      composer.style.display = 'none';
      openWrapper.style.display = 'block';
      input.value = '';
    };

    openBtn.onclick = openComposer;
    document.querySelector(`[data-add-column="${col}"]`).onclick = openComposer;

    cancelBtn.onclick = closeComposer;

    const submitTask = async () => {
      const title = input.value.trim();
      if (!title) return;

      submitBtn.disabled = true;

      try {
        const res = await api.post(`/projects/${project.id}/tasks`, {
          title,
          status: col,
          priority: 'medium',
        });

        allTasks.push(res.task);
        const list = document.getElementById(`tasks-${col}`);
        const temp = document.createElement('div');
        temp.innerHTML = renderTaskCard(res.task);
        const newCard = temp.firstElementChild;
        list.appendChild(newCard);
        attachCardEvents(newCard);

        closeComposer();
        updateColumnCounts();
        showToast('Task added', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    };

    submitBtn.onclick = submitTask;

    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitTask();
      } else if (e.key === 'Escape') {
        closeComposer();
      }
    };
  });
}

/* ========================================================
   Native HTML5 Drag and Drop with Insertion Placeholder
   ======================================================== */
function setupDragAndDrop() {
  COLUMNS.forEach((colName) => {
    const columnEl = document.getElementById(`column-${colName}`);
    const taskListEl = document.getElementById(`tasks-${colName}`);
    if (!columnEl || !taskListEl) return;

    columnEl.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      columnEl.classList.add('drag-over');

      // Auto-scroll column near boundaries
      const rect = taskListEl.getBoundingClientRect();
      if (e.clientY < rect.top + 40) {
        taskListEl.scrollTop -= 8;
      } else if (e.clientY > rect.bottom - 40) {
        taskListEl.scrollTop += 8;
      }

      // Determine insertion position based on mouse Y
      const afterElement = getDragAfterElement(taskListEl, e.clientY);
      if (!dragPlaceholder) {
        dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'drag-placeholder';
      }

      if (afterElement == null) {
        taskListEl.appendChild(dragPlaceholder);
      } else {
        taskListEl.insertBefore(dragPlaceholder, afterElement);
      }
    };

    columnEl.ondragleave = (e) => {
      if (!columnEl.contains(e.relatedTarget)) {
        columnEl.classList.remove('drag-over');
      }
    };

    columnEl.ondrop = async (e) => {
      e.preventDefault();
      columnEl.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
      if (!taskId) return;

      const card = document.getElementById(`task-${taskId}`);
      const task = allTasks.find((t) => t.id === taskId);
      if (!card || !task) return;

      // Calculate new index inside target column
      const cardsInTarget = Array.from(taskListEl.children).filter((el) => el.classList.contains('task-card'));
      let targetIndex = 0;

      if (dragPlaceholder && dragPlaceholder.parentNode === taskListEl) {
        const children = Array.from(taskListEl.children);
        const placeholderIdx = children.indexOf(dragPlaceholder);
        // Exclude the dragged card itself if already in this column
        const cardsBeforePlaceholder = children.slice(0, placeholderIdx).filter((el) => el.classList.contains('task-card') && el !== card);
        targetIndex = cardsBeforePlaceholder.length;
      } else {
        targetIndex = cardsInTarget.length;
      }

      dragPlaceholder?.remove();

      // Check if actually changed
      if (task.status === colName && task.order === targetIndex) {
        return;
      }

      // Optimistic UI move
      const oldStatus = task.status;
      const oldOrder = task.order;

      // Insert card in DOM at new spot
      if (dragPlaceholder && dragPlaceholder.nextSibling) {
        taskListEl.insertBefore(card, dragPlaceholder.nextSibling);
      } else {
        taskListEl.appendChild(card);
      }

      task.status = colName;
      card.setAttribute('data-status', colName);
      card.classList.add('just-moved');
      setTimeout(() => card.classList.remove('just-moved'), 1200);

      updateColumnCounts();

      // Call API
      try {
        const res = await api.patch(`/tasks/${taskId}/move`, {
          status: colName,
          index: targetIndex,
        });

        // Update task object with server response
        const idx = allTasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) allTasks[idx] = res.task;

        // Re-align orders in local array
        allTasks.forEach((t) => {
          if (t.status === colName && t.id !== taskId) {
            // Updated orders will sync on next fetch
          }
        });
      } catch (err) {
        // Rollback
        showToast(`Move failed: ${err.message}`, 'error');
        task.status = oldStatus;
        task.order = oldOrder;
        card.setAttribute('data-status', oldStatus);
        renderAllTasks();
      }
    };
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

/* ========================================================
   Keyboard Drag and Drop Accessibility
   ======================================================== */
function setupKeyboardNavigation() {
  window.addEventListener('keydown', async (e) => {
    // Only handle if focused on a task card
    const focusedCard = document.activeElement?.closest('.task-card');
    if (!focusedCard) return;

    const taskId = focusedCard.getAttribute('data-id');
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Space key: Pick up or Drop
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!keyboardGrabbedTask) {
        // Pick up
        keyboardGrabbedTask = task;
        focusedCard.setAttribute('aria-grabbed', 'true');
        focusedCard.style.outline = '3px solid var(--primary)';
        showToast(`Picked up "${task.title}". Use arrow keys to move, Space to drop.`, 'info', 2500);
      } else if (keyboardGrabbedTask.id === task.id) {
        // Drop
        focusedCard.setAttribute('aria-grabbed', 'false');
        focusedCard.style.outline = '';
        keyboardGrabbedTask = null;
        showToast('Dropped task', 'success', 2000);
      }
      return;
    }

    // Escape: Cancel pickup
    if (e.key === 'Escape' && keyboardGrabbedTask) {
      focusedCard.setAttribute('aria-grabbed', 'false');
      focusedCard.style.outline = '';
      keyboardGrabbedTask = null;
      showToast('Move cancelled', 'info', 1500);
      return;
    }

    // Arrow keys while card is picked up
    if (keyboardGrabbedTask && keyboardGrabbedTask.id === task.id) {
      const currentColIndex = COLUMNS.indexOf(task.status);
      let targetStatus = task.status;
      let targetIndex = task.order || 0;

      if (e.key === 'ArrowRight' && currentColIndex < COLUMNS.length - 1) {
        e.preventDefault();
        targetStatus = COLUMNS[currentColIndex + 1];
        targetIndex = 0;
      } else if (e.key === 'ArrowLeft' && currentColIndex > 0) {
        e.preventDefault();
        targetStatus = COLUMNS[currentColIndex - 1];
        targetIndex = 0;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex += 1;
      } else if (e.key === 'ArrowUp' && targetIndex > 0) {
        e.preventDefault();
        targetIndex -= 1;
      } else {
        return;
      }

      // Execute move
      try {
        const res = await api.patch(`/tasks/${task.id}/move`, {
          status: targetStatus,
          index: targetIndex,
        });
        const idx = allTasks.findIndex((t) => t.id === task.id);
        if (idx !== -1) allTasks[idx] = res.task;
        renderAllTasks();
        const updatedCard = document.getElementById(`task-${task.id}`);
        if (updatedCard) {
          updatedCard.focus();
          updatedCard.setAttribute('aria-grabbed', 'true');
          updatedCard.style.outline = '3px solid var(--primary)';
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });
}

/* ========================================================
   Mobile Card "Move to" Modal Menu
   ======================================================== */
function openTouchMoveModal(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) return;

  const modal = document.getElementById('modal-touch-move');
  const actionsContainer = document.getElementById('touch-move-actions');
  if (!modal || !actionsContainer) return;

  const colLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

  let html = '';
  COLUMNS.forEach((col) => {
    if (col !== task.status) {
      html += `
        <button class="btn btn-secondary" data-move-to="${col}" style="width: 100%; justify-content: flex-start;">
          Move to <strong>${colLabels[col]}</strong>
        </button>
      `;
    }
  });

  html += `
    <button class="btn btn-secondary" data-move-pos="up" style="width: 100%; justify-content: flex-start;">
      Move up in column
    </button>
    <button class="btn btn-secondary" data-move-pos="down" style="width: 100%; justify-content: flex-start;">
      Move down in column
    </button>
  `;

  actionsContainer.innerHTML = html;

  actionsContainer.querySelectorAll('[data-move-to]').forEach((btn) => {
    btn.onclick = async () => {
      const targetCol = btn.getAttribute('data-move-to');
      closeModal(modal);
      try {
        const res = await api.patch(`/tasks/${taskId}/move`, {
          status: targetCol,
          index: 0,
        });
        const idx = allTasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) allTasks[idx] = res.task;
        renderAllTasks();
        showToast(`Moved to ${colLabels[targetCol]}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  });

  actionsContainer.querySelector('[data-move-pos="up"]').onclick = async () => {
    closeModal(modal);
    const newIdx = Math.max(0, (task.order || 0) - 1);
    try {
      const res = await api.patch(`/tasks/${taskId}/move`, {
        status: task.status,
        index: newIdx,
      });
      const idx = allTasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) allTasks[idx] = res.task;
      renderAllTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  actionsContainer.querySelector('[data-move-pos="down"]').onclick = async () => {
    closeModal(modal);
    const newIdx = (task.order || 0) + 1;
    try {
      const res = await api.patch(`/tasks/${taskId}/move`, {
        status: task.status,
        index: newIdx,
      });
      const idx = allTasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) allTasks[idx] = res.task;
      renderAllTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  openModal(modal);
}

/* ========================================================
   Project Settings & Members Modal
   ======================================================== */
function setupProjectSettings() {
  const modal = document.getElementById('modal-project-settings');
  const nameInput = document.getElementById('edit-proj-name');
  const descInput = document.getElementById('edit-proj-desc');
  const colorsContainer = document.getElementById('edit-project-colors');
  const form = document.getElementById('form-edit-project');
  const membersList = document.getElementById('project-members-list');
  const membersCountEl = document.getElementById('settings-members-count');
  const addMemberSection = document.getElementById('add-member-section');
  const dangerZone = document.getElementById('danger-zone-section');

  const currentUser = getUser();
  const isOwner = project.owner && currentUser && project.owner.id === currentUser.id;

  // Pre-fill form
  nameInput.value = project.name;
  descInput.value = project.description || '';

  if (!isOwner) {
    nameInput.disabled = true;
    descInput.disabled = true;
    document.getElementById('btn-save-project-details').style.display = 'none';
    if (addMemberSection) addMemberSection.style.display = 'none';
    if (dangerZone) dangerZone.style.display = 'none';
  }

  // Render color swatches
  colorsContainer.innerHTML = PROJECT_COLORS.map(
    (c, i) => `
      <input type="radio" name="editProjectColor" id="edit-color-${i}" value="${c}" class="color-swatch-radio" ${
      project.color === c ? 'checked' : ''
    } ${!isOwner ? 'disabled' : ''}>
      <label for="edit-color-${i}" class="color-swatch-label" style="background-color: ${c};"></label>
    `
  ).join('');

  // Render members list
  renderSettingsMembers();

  // Save Details Submit
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!isOwner) return;

    const checkedColor = form.querySelector('input[name="editProjectColor"]:checked');
    try {
      const res = await api.put(`/projects/${project.id}`, {
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        color: checkedColor ? checkedColor.value : project.color,
      });

      project = res.project;
      setupBoardHeader();
      loadSidebarData();
      showToast('Project updated successfully', 'success');
      closeModal(modal);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Add Member Debounced Search
  if (isOwner) {
    const searchInput = document.getElementById('member-search-input');
    const resultsContainer = document.getElementById('member-search-results');

    setupMemberSearch(searchInput, resultsContainer, async (selectedUser) => {
      try {
        const res = await api.post(`/projects/${project.id}/members`, {
          userId: selectedUser.id,
        });
        project = res.project;
        setupBoardHeader();
        renderSettingsMembers();
        showToast(`Added ${selectedUser.name} to project`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Delete Project Danger Zone
  const openDeleteModalBtn = document.getElementById('btn-open-delete-modal');
  const confirmModal = document.getElementById('modal-confirm-delete');
  const confirmNameSpan = document.getElementById('confirm-project-name');
  const confirmInput = document.getElementById('input-confirm-name');
  const confirmSubmitBtn = document.getElementById('btn-confirm-delete-submit');

  if (openDeleteModalBtn && confirmModal) {
    openDeleteModalBtn.onclick = () => {
      confirmNameSpan.textContent = project.name;
      confirmInput.value = '';
      confirmSubmitBtn.disabled = true;
      openModal(confirmModal);
    };

    confirmInput.oninput = () => {
      confirmSubmitBtn.disabled = confirmInput.value.trim() !== project.name;
    };

    confirmSubmitBtn.onclick = async () => {
      try {
        await api.delete(`/projects/${project.id}`);
        showToast('Project deleted', 'success');
        window.location.replace('/dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
}

function renderSettingsMembers() {
  const list = document.getElementById('project-members-list');
  const countEl = document.getElementById('settings-members-count');
  if (!list) return;

  const currentUser = getUser();
  const isOwner = project.owner && currentUser && project.owner.id === currentUser.id;

  countEl.textContent = (project.members || []).length;

  list.innerHTML = (project.members || [])
    .map((m) => {
      const isMemberOwner = project.owner && project.owner.id === m.id;
      const canRemove = isOwner && !isMemberOwner;

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface-2); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${renderAvatar(m, 32)}
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 500; font-size: var(--font-size-sm); color: var(--text-main);">${escapeHtml(m.name)}</span>
              <span style="font-size: var(--font-size-xs); color: var(--text-muted);">${escapeHtml(m.email)}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${isMemberOwner ? 'badge-priority-low' : 'count-badge'}" style="font-size: 11px;">
              ${isMemberOwner ? 'Owner' : 'Member'}
            </span>

            ${
              canRemove
                ? `<button class="btn-ghost btn-icon" data-remove-member="${m.id}" title="Remove member" aria-label="Remove member" style="color: var(--text-subtle);">
                    ${icon('trash', 'icon-sm')}
                  </button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  // Bind remove buttons
  list.querySelectorAll('[data-remove-member]').forEach((btn) => {
    btn.onclick = async () => {
      const userId = btn.getAttribute('data-remove-member');
      if (confirm('Remove this member from the project? Their assigned tasks will become unassigned.')) {
        try {
          const res = await api.delete(`/projects/${project.id}/members/${userId}`);
          project = res.project;
          setupBoardHeader();
          renderSettingsMembers();
          showToast('Member removed', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  });
}
