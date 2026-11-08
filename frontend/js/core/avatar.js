/**
 * TaskFlow Avatar Module
 * Generates local SVG/HTML avatars with deterministic dual-color gradient from avatarHue
 * and 1-2 initials. Provides avatar groups with +N overflow.
 */

import { escapeHtml } from './utils.js';

/**
 * Extracts 1-2 initials from a full name.
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Renders an avatar element HTML string.
 * @param {Object} user - { name, avatarHue }
 * @param {number} [size=32] - 20, 24, 32, or 40
 * @param {string} [extraClass='']
 * @returns {string} HTML string
 */
export function renderAvatar(user, size = 32, extraClass = '') {
  const name = user ? user.name || 'User' : 'Unassigned';
  const hue = user && typeof user.avatarHue === 'number' ? user.avatarHue : 180;
  const initials = getInitials(name);

  // Two-color gradient based on hue
  const color1 = `hsl(${hue}, 70%, 45%)`;
  const color2 = `hsl(${(hue + 40) % 360}, 80%, 35%)`;

  const safeName = escapeHtml(name);

  return `
    <div class="avatar avatar-${size} ${extraClass}" 
         style="background: linear-gradient(135deg, ${color1}, ${color2});" 
         title="${safeName}" 
         aria-label="${safeName}">
      ${initials}
    </div>
  `.trim();
}

/**
 * Renders a stacked avatar group with +N overflow.
 * @param {Array} users - Array of user objects
 * @param {number} [max=4] - Max avatars to show before +N
 * @param {number} [size=24] - Avatar size
 * @returns {string} HTML string
 */
export function renderAvatarGroup(users = [], max = 4, size = 24) {
  if (!users || !users.length) return '';

  const visible = users.slice(0, max);
  const remaining = users.length - max;

  let html = '<div class="avatar-group">';
  visible.forEach((u) => {
    html += renderAvatar(u, size);
  });

  if (remaining > 0) {
    html += `
      <div class="avatar avatar-${size} avatar-overflow" title="${remaining} more members">
        +${remaining}
      </div>
    `;
  }
  html += '</div>';

  return html;
}
