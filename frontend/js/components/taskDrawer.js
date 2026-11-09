/**
 * TaskFlow Task Drawer Component
 * Deep-linkable right-side sheet (#task=ID) with inline editable fields,
 * auto-saving, members assignee picker, and threaded comments.
 */

import { api } from '../core/api.js';
import { getUser } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { renderAvatar } from '../core/avatar.js';
import { showToast } from '../core/toast.js';
import {
  escapeHtml,
  formatRelativeTime,
  renderPriorityBadge,
  renderDueDateChip,
} from '../core/utils.js';

let activeTask = null;
let currentProject = null;
let onTaskUpdateCallback = null;
let onTaskDeleteCallback = null;

export function initTaskDrawer({ project, onUpdate, onDelete }) {
  currentProject = project;
  onTaskUpdateCallback = onUpdate;
  onTaskDeleteCallback = onDelete;

  let drawerBackdrop = document.getElementById('task-drawer-backdrop');
  if (!drawerBackdrop) {
    drawerBackdrop = document.createElement('div');
    drawerBackdrop.className = 'drawer-backdrop';
    drawerBackdrop.id = 'task-drawer-backdrop';
    drawerBackdrop.innerHTML = `<div class="task-drawer" id="task-drawer"></div>`;
    document.body.appendChild(drawerBackdrop);

    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) {
        closeTaskDrawer();
      }
    });
  }

  // Handle URL hash on load or hashchange
  const handleHash = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#task=')) {
      const taskId = hash.replace('#task=', '');
      if (taskId && (!activeTask || activeTask.id !== taskId)) {
        openTaskDrawer(taskId);
      }
    } else if (activeTask) {
      closeTaskDrawer(false);
    }
  };

  window.addEventListener('hashchange', handleHash);
  if (window.location.hash.startsWith('#task=')) {
    handleHash();
  }
}

export async function openTaskDrawer(taskId) {
  const backdrop = document.getElementById('task-drawer-backdrop');
  const drawer = document.getElementById('task-drawer');
  if (!backdrop || !drawer) return;

  drawer.innerHTML = `
    <div style="padding: 30px; text-align: center; color: var(--text-muted);">
      <div class="spinner"></div>
      <p style="margin-top: 12px; font-size: var(--font-size-sm);">Loading task details...</p>
    </div>
  `;

  backdrop.classList.add('open');
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Update hash if not present
  if (window.location.hash !== `#task=${taskId}`) {
    history.replaceState(null, '', `#task=${taskId}`);
  }

  try {
    const res = await api.get(`/tasks/${taskId}`);
    activeTask = res.task;
    const comments = res.comments || [];
    renderDrawerContent(activeTask, comments);
  } catch (err) {
    showToast(err.message || 'Failed to load task', 'error');
    closeTaskDrawer();
  }
}

export function closeTaskDrawer(updateHash = true) {
  const backdrop = document.getElementById('task-drawer-backdrop');
  const drawer = document.getElementById('task-drawer');
  if (!backdrop || !drawer) return;

  backdrop.classList.remove('open');
  drawer.classList.remove('open');
  document.body.style.overflow = '';
  activeTask = null;

  if (updateHash && window.location.hash.startsWith('#task=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function renderDrawerContent(task, comments) {
  const drawer = document.getElementById('task-drawer');
  if (!drawer) return;

  const currentUser = getUser();
  const members = currentProject ? currentProject.members || [] : [];
  const isOwnerOrCreator =
    (currentUser && task.createdBy && currentUser.id === task.createdBy.id) ||
    (currentUser && currentProject && currentProject.owner && currentUser.id === currentProject.owner.id);

  // Format date input value (YYYY-MM-DD)
  const dueDateVal = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';

  drawer.innerHTML = `
    <!-- Drawer Header -->
    <div class="drawer-header">
      <div class="drawer-header-left">
        <span class="project-dot" style="background-color: ${currentProject?.color || '#0D9488'};" title="${escapeHtml(currentProject?.name || 'Project')}"></span>
        <span class="drawer-task-key" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--text-subtle); letter-spacing: 0.04em;">TF-${task.id.slice(-4).toUpperCase()}</span>
        <button class="btn-ghost btn-sm" id="btn-copy-task-link" title="Copy link to task" style="font-size: 11.5px; padding: 3px 8px; height: 26px; gap: 5px;">
          ${icon('share-2', 'icon-sm')}
          <span>Copy link</span>
        </button>
        <span class="saved-indicator" id="drawer-saved-indicator">
          ${icon('check', 'icon-sm')} Saved
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${
          isOwnerOrCreator
            ? `<button class="btn-ghost btn-icon" id="btn-delete-task" title="Delete task" aria-label="Delete task">
                ${icon('trash', 'icon-md')}
              </button>`
            : ''
        }
        <button class="btn-ghost btn-icon" id="btn-close-drawer" title="Close" aria-label="Close">
          ${icon('x', 'icon-md')}
        </button>
      </div>
    </div>

    <!-- Drawer Body -->
    <div class="drawer-body">
      <!-- Inline Editable Title -->
      <input type="text" class="drawer-title-input" id="drawer-task-title" value="${escapeHtml(task.title)}" placeholder="Task title...">

      <!-- Properties Grid -->
      <div class="drawer-properties">
        <!-- Status -->
        <div class="property-label">${icon('list-checks', 'icon-sm')} Status</div>
        <div class="property-value">
          <select id="drawer-task-status">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
          </select>
        </div>

        <!-- Priority -->
        <div class="property-label">${icon('flag', 'icon-sm')} Priority</div>
        <div class="property-value">
          <select id="drawer-task-priority">
            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>

        <!-- Due Date -->
        <div class="property-label">${icon('calendar', 'icon-sm')} Due Date</div>
        <div class="property-value">
          <input type="date" id="drawer-task-due" value="${dueDateVal}">
        </div>

        <!-- Assignee -->
        <div class="property-label">${icon('user', 'icon-sm')} Assignee</div>
        <div class="property-value">
          <select id="drawer-task-assignee">
            <option value="">Unassigned</option>
            ${members
              .map(
                (m) =>
                  `<option value="${m.id}" ${task.assignee && task.assignee.id === m.id ? 'selected' : ''}>${escapeHtml(
                    m.name
                  )}</option>`
              )
              .join('')}
          </select>
        </div>

        <!-- Created By -->
        <div class="property-label">${icon('clock', 'icon-sm')} Created</div>
        <div class="property-value" style="font-size: var(--font-size-xs); color: var(--text-muted);">
          by ${task.createdBy ? escapeHtml(task.createdBy.name) : 'Unknown'} &bull; ${formatRelativeTime(task.createdAt)}
        </div>
      </div>

      <!-- Description -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label class="form-label" for="drawer-task-desc" style="font-size: var(--font-size-sm); color: var(--text-muted);">
          Description
        </label>
        <textarea id="drawer-task-desc" class="drawer-description" placeholder="Add a more detailed description...">${escapeHtml(
          task.description || ''
        )}</textarea>
      </div>

      <!-- Comments Thread -->
      <div class="comments-section">
        <h3 class="comments-title">
          ${icon('message', 'icon-md')} Comments (<span id="drawer-comments-count">${comments.length}</span>)
        </h3>

        <!-- Comments List -->
        <div class="comments-list" id="drawer-comments-list">
          ${renderCommentsList(comments, currentUser, currentProject)}
        </div>
      </div>
    </div>

    <!-- Pinned Comment Composer at Bottom of Drawer -->
    <div class="drawer-composer-pinned">
      <div class="comment-composer">
        ${renderAvatar(currentUser, 28)}
        <div class="comment-composer-body">
          <textarea class="comment-input" id="drawer-comment-input" placeholder="Write a comment... (Ctrl+Enter to post)"></textarea>
          <div class="comment-composer-footer">
            <span style="font-size: var(--font-size-xs); color: var(--text-subtle);">Ctrl+Enter to post</span>
            <button class="btn btn-primary btn-sm" id="btn-post-comment">Comment</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachDrawerEvents(task);
}

function renderCommentsList(comments, currentUser, project) {
  if (!comments || comments.length === 0) {
    return `
      <div id="no-comments-msg" style="padding: 16px; text-align: center; color: var(--text-subtle); font-size: var(--font-size-sm);">
        No comments yet. Start the conversation!
      </div>
    `;
  }

  return comments
    .map((c) => {
      const isAuthor = currentUser && c.author && currentUser.id === c.author.id;
      const isProjectOwner = currentUser && project && project.owner && currentUser.id === project.owner.id;
      const canDelete = isAuthor || isProjectOwner;

      return `
        <div class="comment-item" id="comment-${c.id}">
          ${renderAvatar(c.author, 32)}
          <div class="comment-bubble">
            <div class="comment-header">
              <span class="comment-author">${escapeHtml(c.author ? c.author.name : 'Unknown')}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="comment-time">${formatRelativeTime(c.createdAt)}</span>
                ${
                  canDelete
                    ? `<button class="comment-delete-btn" data-delete-comment="${c.id}" title="Delete comment" aria-label="Delete comment">
                        ${icon('trash', 'icon-sm')}
                      </button>`
                    : ''
                }
              </div>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

function flashSaved() {
  const indicator = document.getElementById('drawer-saved-indicator');
  if (indicator) {
    indicator.classList.add('visible');
    setTimeout(() => {
      indicator.classList.remove('visible');
    }, 1800);
  }
}

function attachDrawerEvents(task) {
  // Close buttons
  document.getElementById('btn-close-drawer').onclick = () => closeTaskDrawer();

  // Copy link button
  const copyBtn = document.getElementById('btn-copy-task-link');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Task link copied to clipboard', 'info');
      }).catch(() => {
        showToast('Failed to copy link', 'error');
      });
    };
  }

  // Field change autosave helpers
  async function saveField(data) {
    try {
      const res = await api.put(`/tasks/${task.id}`, data);
      activeTask = res.task;
      flashSaved();
      if (onTaskUpdateCallback) {
        onTaskUpdateCallback(res.task);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Title on blur or Enter
  const titleInput = document.getElementById('drawer-task-title');
  titleInput.onblur = () => {
    const val = titleInput.value.trim();
    if (val && val !== task.title) {
      saveField({ title: val });
    }
  };
  titleInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      titleInput.blur();
    }
  };

  // Status select
  const statusSelect = document.getElementById('drawer-task-status');
  statusSelect.onchange = async () => {
    const newStatus = statusSelect.value;
    try {
      // Use move endpoint so column ordering is properly set
      const res = await api.patch(`/tasks/${task.id}/move`, {
        status: newStatus,
        index: 0,
      });
      activeTask = res.task;
      flashSaved();
      if (onTaskUpdateCallback) {
        onTaskUpdateCallback(res.task, true); // true = move
      }
    } catch (err) {
      showToast(err.message, 'error');
      statusSelect.value = task.status;
    }
  };

  // Priority select
  const prioritySelect = document.getElementById('drawer-task-priority');
  prioritySelect.onchange = () => {
    saveField({ priority: prioritySelect.value });
  };

  // Due date input
  const dueInput = document.getElementById('drawer-task-due');
  dueInput.onchange = () => {
    saveField({ dueDate: dueInput.value ? new Date(dueInput.value).toISOString() : null });
  };

  // Assignee select
  const assigneeSelect = document.getElementById('drawer-task-assignee');
  assigneeSelect.onchange = () => {
    saveField({ assignee: assigneeSelect.value || null });
  };

  // Description textarea on blur
  const descInput = document.getElementById('drawer-task-desc');
  descInput.onblur = () => {
    const val = descInput.value.trim();
    if (val !== (task.description || '')) {
      saveField({ description: val });
    }
  };

  // Delete Task
  const deleteBtn = document.getElementById('btn-delete-task');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
        try {
          await api.delete(`/tasks/${task.id}`);
          showToast('Task deleted', 'success');
          closeTaskDrawer();
          if (onTaskDeleteCallback) {
            onTaskDeleteCallback(task.id);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  }

  // Comment posting
  const commentInput = document.getElementById('drawer-comment-input');
  const postCommentBtn = document.getElementById('btn-post-comment');

  async function postComment() {
    const text = commentInput.value.trim();
    if (!text) return;

    postCommentBtn.disabled = true;

    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { text });
      commentInput.value = '';

      // Append comment to list
      const list = document.getElementById('drawer-comments-list');
      const noMsg = document.getElementById('no-comments-msg');
      if (noMsg) noMsg.remove();

      const currentUser = getUser();
      const div = document.createElement('div');
      div.className = 'comment-item';
      div.id = `comment-${res.comment.id}`;
      div.innerHTML = `
        ${renderAvatar(res.comment.author, 32)}
        <div class="comment-bubble">
          <div class="comment-header">
            <span class="comment-author">${escapeHtml(res.comment.author.name)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="comment-time">${formatRelativeTime(res.comment.createdAt)}</span>
              <button class="comment-delete-btn" data-delete-comment="${res.comment.id}" title="Delete comment" aria-label="Delete comment">
                ${icon('trash', 'icon-sm')}
              </button>
            </div>
          </div>
          <div class="comment-text">${escapeHtml(res.comment.text)}</div>
        </div>
      `;

      list.appendChild(div);

      // Bind delete on new comment
      div.querySelector('[data-delete-comment]').onclick = () => deleteComment(res.comment.id);

      // Increment comments count
      const countEl = document.getElementById('drawer-comments-count');
      if (countEl) {
        countEl.textContent = parseInt(countEl.textContent || '0', 10) + 1;
      }

      if (onTaskUpdateCallback) {
        onTaskUpdateCallback({ ...activeTask, commentsCount: (activeTask.commentsCount || 0) + 1 });
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      postCommentBtn.disabled = false;
    }
  }

  postCommentBtn.onclick = postComment;
  commentInput.onkeydown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      postComment();
    }
  };

  // Bind existing comment delete buttons
  document.querySelectorAll('[data-delete-comment]').forEach((btn) => {
    btn.onclick = () => {
      const commentId = btn.getAttribute('data-delete-comment');
      deleteComment(commentId);
    };
  });

  async function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${commentId}`);
      document.getElementById(`comment-${commentId}`)?.remove();
      const countEl = document.getElementById('drawer-comments-count');
      if (countEl) {
        countEl.textContent = Math.max(0, parseInt(countEl.textContent || '0', 10) - 1);
      }
      if (onTaskUpdateCallback) {
        onTaskUpdateCallback({ ...activeTask, commentsCount: Math.max(0, (activeTask.commentsCount || 1) - 1) });
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

