/**
 * TaskFlow My Tasks Page Logic
 * Groups all tasks assigned to the current user across projects into:
 * Overdue / Today / This week / Later / No date.
 */

import { api } from '../core/api.js';
import { requireAuth } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { initShell } from '../core/shell.js';
import {
  escapeHtml,
  renderPriorityBadge,
  renderDueDateChip,
} from '../core/utils.js';

let myTasks = [];

if (requireAuth()) {
  initMyTasksPage();
}

async function initMyTasksPage() {
  await initShell('my-tasks');

  const contentArea = document.getElementById('page-content');
  const template = document.getElementById('my-tasks-template');
  if (!contentArea || !template) return;

  contentArea.innerHTML = '';
  contentArea.appendChild(template.content.cloneNode(true));

  const filterSelect = document.getElementById('my-tasks-filter-status');
  filterSelect.onchange = () => renderGroupedTasks();

  try {
    const res = await api.get('/tasks/mine');
    myTasks = res.tasks || [];
    renderGroupedTasks();
  } catch (err) {
    console.error('[myTasks] Failed to load tasks:', err);
  }
}

function renderGroupedTasks() {
  const container = document.getElementById('task-groups-container');
  const filterVal = document.getElementById('my-tasks-filter-status').value;
  if (!container) return;

  // Filter tasks
  let filtered = myTasks;
  if (filterVal === 'open') {
    filtered = myTasks.filter((t) => t.status !== 'done');
  } else if (filterVal !== 'all') {
    filtered = myTasks.filter((t) => t.status === filterVal);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          ${icon('check', 'icon-lg')}
        </div>
        <div class="empty-state-title">No tasks found</div>
        <div class="empty-state-desc">You don't have any tasks matching this filter.</div>
      </div>
    `;
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const groups = {
    overdue: { title: 'Overdue', tasks: [], color: 'var(--priority-high)' },
    today: { title: 'Today', tasks: [], color: 'var(--priority-medium)' },
    thisWeek: { title: 'This week', tasks: [], color: 'var(--teal-600)' },
    later: { title: 'Later', tasks: [], color: 'var(--text-muted)' },
    noDate: { title: 'No due date', tasks: [], color: 'var(--text-subtle)' },
  };

  filtered.forEach((task) => {
    if (!task.dueDate) {
      groups.noDate.tasks.push(task);
      return;
    }

    const due = new Date(task.dueDate);
    if (due < todayStart && task.status !== 'done') {
      groups.overdue.tasks.push(task);
    } else if (due >= todayStart && due < tomorrowStart) {
      groups.today.tasks.push(task);
    } else if (due >= tomorrowStart && due <= weekEnd) {
      groups.thisWeek.tasks.push(task);
    } else {
      groups.later.tasks.push(task);
    }
  });

  let html = '';
  Object.values(groups).forEach((group) => {
    if (group.tasks.length === 0) return;

    html += `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm); font-weight: 600; color: ${group.color};">
          <span>${group.title}</span>
          <span class="count-badge">${group.tasks.length}</span>
        </div>

        <div style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
          ${group.tasks.map(renderTaskRow).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderTaskRow(task) {
  const projColor = task.project ? task.project.color : '#0D9488';
  const projName = task.project ? escapeHtml(task.project.name) : 'Project';
  const safeTitle = escapeHtml(task.title);
  const statusLabel = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[task.status] || task.status;
  const isDone = task.status === 'done';

  return `
    <a href="/projects/${task.project.id}#task=${task.id}" class="my-task-row"
       style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); text-decoration: none; color: inherit; transition: background-color var(--duration-fast) var(--ease-default); gap: 16px;"
       tabindex="0"
       aria-label="${safeTitle}">
      
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
        <span class="project-dot" style="background-color: ${projColor};" title="${projName}"></span>
        
        <div style="display: flex; flex-direction: column; min-width: 0;">
          <span style="font-size: var(--font-size-base); font-weight: 500; color: var(--text-main); ${isDone ? 'text-decoration: line-through; opacity: 0.7;' : ''} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${safeTitle}
          </span>
          <span style="font-size: var(--font-size-xs); color: var(--text-muted);">
            ${projName}
          </span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
        ${renderPriorityBadge(task.priority)}
        ${task.dueDate ? renderDueDateChip(task.dueDate) : ''}
        <span class="badge ${isDone ? 'badge-priority-low' : 'count-badge'}" style="font-size: 11px;">
          ${statusLabel}
        </span>
      </div>
    </a>
  `;
}
