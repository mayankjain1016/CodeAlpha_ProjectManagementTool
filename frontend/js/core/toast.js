/**
 * TaskFlow Toast Notification System
 * Accessible (aria-live), non-blocking feedback messages.
 */

import { icon } from './icons.js';
import { escapeHtml } from './utils.js';

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
  }
  return container;
}

/**
 * Displays a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 * @param {number} [duration=3500]
 */
export function showToast(message, type = 'info', duration = 3500) {
  const cont = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  let iconName = 'alert-circle';
  if (type === 'success') iconName = 'check';
  if (type === 'error') iconName = 'alert-circle';

  toast.innerHTML = `
    ${icon(iconName, 'icon-md')}
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  cont.appendChild(toast);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    toast.classList.add('dismissing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }

  toast.addEventListener('click', dismiss);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return { dismiss };
}

