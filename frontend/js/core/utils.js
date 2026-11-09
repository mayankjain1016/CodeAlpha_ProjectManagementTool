/**
 * TaskFlow Utility Functions
 */

import { icon } from './icons.js';

/**
 * Escapes user input to safely inject into innerHTML without XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a relative time string (e.g., "just now", "5m ago", "2h ago", "yesterday").
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'yesterday';
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Formats a due date for display on task cards and drawer.
 * @param {string|Date} dateInput
 * @returns {{ text: string, status: 'overdue'|'due-soon'|'normal'|'' }}
 */
export function formatDueDate(dateInput) {
  if (!dateInput) return { text: '', status: '' };
  const due = new Date(dateInput);
  const now = new Date();

  // Reset times to compare dates
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

  let status = 'normal';
  let text = '';

  if (diffDays < 0) {
    status = 'overdue';
    text = diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)}d overdue`;
  } else if (diffDays === 0) {
    status = 'due-soon';
    text = 'Today';
  } else if (diffDays === 1) {
    status = 'due-soon';
    text = 'Tomorrow';
  } else if (diffDays <= 2) {
    status = 'due-soon';
    text = `${diffDays} days left`;
  } else {
    status = 'normal';
    text = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { text, status };
}

/**
 * Returns HTML for a priority badge.
 * @param {'low'|'medium'|'high'} priority
 * @returns {string}
 */
export function renderPriorityBadge(priority = 'medium') {
  const p = priority.toLowerCase();
  const label = p.charAt(0).toUpperCase() + p.slice(1);
  return `
    <span class="badge badge-priority-${p}">
      ${icon('flag', 'icon-sm')}
      ${label}
    </span>
  `.trim();
}

/**
 * Returns HTML for a due date chip.
 * @param {string|Date} date
 * @returns {string}
 */
export function renderDueDateChip(date) {
  if (!date) return '';
  const { text, status } = formatDueDate(date);
  return `
    <span class="due-chip ${status}">
      ${icon('calendar', 'icon-sm')}
      ${text}
    </span>
  `.trim();
}

/**
 * Standard debounce function.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Animates a numerical counter from 0 to target value.
 * @param {HTMLElement} element
 * @param {number} target
 * @param {number} duration
 */
export function animateCount(element, target, duration = 800) {
  if (!element) return;
  const start = 0;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeProgress);
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target;
    }
  }

  requestAnimationFrame(update);
}

