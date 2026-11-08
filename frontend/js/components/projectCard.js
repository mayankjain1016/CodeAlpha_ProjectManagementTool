/**
 * TaskFlow Project Card Component
 * Renders dashboard project grid cards with progress bar and member stacks.
 */

import { renderAvatarGroup } from '../core/avatar.js';
import { escapeHtml, formatRelativeTime } from '../core/utils.js';

export function renderProjectCard(project) {
  const safeName = escapeHtml(project.name);
  const safeDesc = escapeHtml(project.description || 'No description provided');
  const color = project.color || '#0D9488';
  const total = project.stats ? project.stats.total : 0;
  const done = project.stats ? project.stats.done : 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const updatedTime = formatRelativeTime(project.updatedAt);

  return `
    <a href="/projects/${project.id}" class="project-card" data-project-id="${project.id}" aria-label="Project: ${safeName}" style="text-decoration: none; color: inherit;">
      <div class="project-card-topbar" style="background-color: ${color};"></div>
      
      <div class="project-card-body">
        <div class="project-card-header">
          <h3 class="project-card-name">${safeName}</h3>
        </div>

        <p class="project-card-desc">${safeDesc}</p>

        <div class="project-progress-container">
          <div class="project-progress-meta">
            <span>${done} of ${total} tasks</span>
            <span class="tabular-nums font-semibold">${percent}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${percent}%; background-color: ${color};"></div>
          </div>
        </div>
      </div>

      <div class="project-card-footer">
        <div class="project-card-members">
          ${renderAvatarGroup(project.members, 4, 24)}
        </div>
        <div class="project-card-meta">
          Updated ${updatedTime}
        </div>
      </div>
    </a>
  `.trim();
}
