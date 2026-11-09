/**
 * TaskFlow Member Picker Component
 * Debounced search for adding new members to a project.
 */

import { api } from '../core/api.js';
import { renderAvatar } from '../core/avatar.js';
import { escapeHtml, debounce } from '../core/utils.js';

export function setupMemberSearch(inputEl, resultsContainerEl, onSelectUser) {
  if (!inputEl || !resultsContainerEl) return;

  const handleSearch = debounce(async () => {
    const query = inputEl.value.trim();
    if (query.length < 1) {
      resultsContainerEl.innerHTML = '';
      resultsContainerEl.style.display = 'none';
      return;
    }

    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      const users = res.users || [];

      if (users.length === 0) {
        resultsContainerEl.innerHTML = `
          <div style="padding: 12px; font-size: var(--font-size-xs); color: var(--text-muted); text-align: center;">
            No users found matching "${escapeHtml(query)}"
          </div>
        `;
        resultsContainerEl.style.display = 'block';
        return;
      }

      resultsContainerEl.innerHTML = users
        .map(
          (u) => `
          <div class="dropdown-item" data-user-id="${u.id}" style="padding: 8px 12px; gap: 10px;">
            ${renderAvatar(u, 28)}
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <span style="font-weight: 500; font-size: var(--font-size-sm); color: var(--text-main);">${escapeHtml(u.name)}</span>
              <span style="font-size: var(--font-size-xs); color: var(--text-muted);">${escapeHtml(u.email)}</span>
            </div>
          </div>
        `
        )
        .join('');

      resultsContainerEl.style.display = 'block';

      // Bind selection clicks
      resultsContainerEl.querySelectorAll('[data-user-id]').forEach((item) => {
        item.onclick = () => {
          const userId = item.getAttribute('data-user-id');
          const selected = users.find((u) => u.id === userId);
          if (selected && onSelectUser) {
            onSelectUser(selected);
          }
          inputEl.value = '';
          resultsContainerEl.innerHTML = '';
          resultsContainerEl.style.display = 'none';
        };
      });
    } catch (err) {
      console.error('[memberPicker] Search error:', err);
    }
  }, 250);

  inputEl.addEventListener('input', handleSearch);
}

