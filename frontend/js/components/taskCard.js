/**
 * TaskFlow Task Card Component
 * Linear-meets-Trello design: 3px left priority stripe, compact chips,
 * hover grip handle, dimmed Done status with checkmark, and accessible keyboard focus.
 */

import { icon } from '../core/icons.js';
import { renderAvatar } from '../core/avatar.js';
import { escapeHtml, renderPriorityBadge, renderDueDateChip } from '../core/utils.js';

/**
 * Renders a single task card HTML.
 * @param {Object} task
 * @returns {string}
 */
export function renderTaskCard(task) {
  const safeTitle = escapeHtml(task.title);
  const priorityBadge = renderPriorityBadge(task.priority);
  const dueDateChip = task.dueDate ? renderDueDateChip(task.dueDate) : '';
  const assigneeAvatar = task.assignee ? renderAvatar(task.assignee, 24) : '';
  const commentCount = task.commentsCount > 0 ? `
    <span class="task-comment-count" title="${task.commentsCount} comments">
      ${icon('message', 'icon-sm')}
      <span class="tabular-nums">${task.commentsCount}</span>
    </span>
  ` : '';

  const isDone = task.status === 'done';

  return `
    <div class="task-card ${isDone ? 'is-done' : ''}" 
         id="task-${task.id}" 
         data-id="${task.id}" 
         data-status="${task.status}" 
         data-priority="${task.priority || 'medium'}"
         data-order="${task.order}" 
         draggable="true" 
         tabindex="0" 
         role="button" 
         aria-grabbed="false" 
         aria-label="Task: ${safeTitle}">
      
      <div class="task-card-content">
        <!-- Hover Drag Handle -->
        <span class="task-card-grip" aria-hidden="true" title="Drag to move">
          ${icon('grip-vertical', 'icon-sm')}
        </span>

        <div class="task-card-header-row">
          ${isDone ? `<span class="task-done-check" title="Completed">${icon('check', 'icon-sm')}</span>` : ''}
          <div class="task-card-title">${safeTitle}</div>
        </div>
      </div>

      <div class="task-card-footer">
        <div class="task-card-badges">
          ${priorityBadge}
          ${dueDateChip}
        </div>

        <div class="task-card-meta">
          ${commentCount}
          ${assigneeAvatar}
          <button class="task-card-menu-btn" data-card-menu="${task.id}" title="Task options" aria-label="Task options">
            ${icon('more-horizontal', 'icon-sm')}
          </button>
        </div>
      </div>
    </div>
  `.trim();
}
