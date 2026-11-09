/**
 * TaskFlow Project Card Component
 * Linear-meets-Trello design: distinctive gradient mesh header in project tint,
 * larger typography, segmented progress bar (Done / In Progress / To Do),
 * and readable avatar group with hover spread.
 */

import { renderAvatarGroup } from '../core/avatar.js';
import { escapeHtml, formatRelativeTime } from '../core/utils.js';

export function renderProjectCard(project) {
  const safeName = escapeHtml(project.name);
  const safeDesc = escapeHtml(project.description || 'No description provided');
  const color = project.color || '#0D9488';

  const total = project.stats ? project.stats.total || 0 : 0;
  const done = project.stats ? project.stats.done || 0 : 0;
  const inProgress = project.stats ? project.stats.in_progress || 0 : 0;
  const todo = total >= done + inProgress ? total - done - inProgress : 0;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const donePct = total > 0 ? (done / total) * 100 : 0;
  const inProgPct = total > 0 ? (inProgress / total) * 100 : 0;
  const todoPct = total > 0 ? (todo / total) * 100 : 0;

  const updatedTime = formatRelativeTime(project.updatedAt);

  return `
    <a href="/projects/${project.id}" 
       class="project-card" 
       data-project-id="${project.id}" 
       aria-label="Project: ${safeName}"
       style="--card-proj-color: ${color}; text-decoration: none; color: inherit;">
      
      <!-- Distinctive Project Header with subtle color gradient & pattern -->
      <div class="project-card-header-banner" style="background: linear-gradient(135deg, ${color}22 0%, ${color}08 100%); border-bottom: 1px solid ${color}26;">
        <span class="project-header-square" style="background-color: ${color}; box-shadow: 0 0 10px ${color}40;"></span>
        <span class="project-header-pill" style="color: ${color}; background-color: ${color}1A;">Active</span>
      </div>
      
      <div class="project-card-body">
        <div class="project-card-header">
          <h3 class="project-card-name">${safeName}</h3>
        </div>

        <p class="project-card-desc">${safeDesc}</p>

        <!-- Segmented Progress Bar (Done, In Progress, To Do) -->
        <div class="project-progress-container">
          <div class="project-progress-meta">
            <span class="progress-meta-count"><span class="tabular-nums font-semibold">${done}</span> of <span class="tabular-nums">${total}</span> tasks</span>
            <span class="tabular-nums font-semibold progress-meta-pct">${percent}%</span>
          </div>
          <div class="segmented-progress-track">
            ${donePct > 0 ? `<div class="progress-segment segment-done" style="width: ${donePct}%;" title="Done: ${done}"></div>` : ''}
            ${inProgPct > 0 ? `<div class="progress-segment segment-inprogress" style="width: ${inProgPct}%;" title="In Progress: ${inProgress}"></div>` : ''}
            ${todoPct > 0 ? `<div class="progress-segment segment-todo" style="width: ${todoPct}%;" title="To Do: ${todo}"></div>` : ''}
          </div>
        </div>
      </div>

      <div class="project-card-footer">
        <div class="project-card-members">
          ${renderAvatarGroup(project.members, 4, 28)}
        </div>
        <div class="project-card-meta">
          Updated ${updatedTime}
        </div>
      </div>
    </a>
  `.trim();
}
