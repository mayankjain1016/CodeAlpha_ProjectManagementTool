/**
 * TaskFlow Dashboard Page Logic
 */

import { api } from '../core/api.js';
import { getUser, requireAuth } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { initShell } from '../core/shell.js';
import { openModal } from '../core/modal.js';
import { renderProjectCard } from '../components/projectCard.js';
import { renderStatCardSkeleton, renderProjectCardSkeleton } from '../components/skeletons.js';
import {
  escapeHtml,
  renderPriorityBadge,
  renderDueDateChip,
  animateCount,
  formatDueDate,
} from '../core/utils.js';

if (requireAuth()) {
  initDashboard();
}

async function initDashboard() {
  await initShell('dashboard');

  const contentArea = document.getElementById('page-content');
  const template = document.getElementById('dashboard-template');
  if (!contentArea || !template) return;

  contentArea.innerHTML = '';
  contentArea.appendChild(template.content.cloneNode(true));

  const user = getUser();
  const firstName = user && user.name ? user.name.split(' ')[0] : 'there';
  const greetingEl = document.getElementById('greeting-text');
  if (greetingEl) {
    const hours = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hours >= 12 && hours < 17) timeGreeting = 'Good afternoon';
    if (hours >= 17) timeGreeting = 'Good evening';
    greetingEl.textContent = `${timeGreeting}, ${firstName}`;
  }

  // Bind New Project Button
  const newProjBtn = document.getElementById('btn-create-project-dash');
  if (newProjBtn) {
    newProjBtn.innerHTML = `${icon('plus', 'icon-sm')} <span>New project</span>`;
    newProjBtn.onclick = () => {
      const modal = document.getElementById('modal-new-project');
      if (modal) openModal(modal);
    };
  }

  // Render initial skeletons
  const statsContainer = document.getElementById('stat-tiles-container');
  statsContainer.innerHTML = Array(4).fill(0).map(renderStatCardSkeleton).join('');

  const projectsGrid = document.getElementById('projects-grid');
  projectsGrid.innerHTML = Array(3).fill(0).map(renderProjectCardSkeleton).join('');

  // Fetch dashboard data
  try {
    const [projRes, tasksRes] = await Promise.all([
      api.get('/projects'),
      api.get('/tasks/mine'),
    ]);

    const projects = projRes.projects || [];
    const myTasks = tasksRes.tasks || [];

    // Calculate stat figures
    const totalProjects = projects.length;
    const openTasks = myTasks.filter((t) => t.status !== 'done').length;

    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);

    const dueThisWeek = myTasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      const d = new Date(t.dueDate);
      return d >= now && d <= oneWeekFromNow;
    }).length;

    const overdue = myTasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      const d = new Date(t.dueDate);
      return d < now;
    }).length;

    // Render stats
    renderStatTiles({ totalProjects, openTasks, dueThisWeek, overdue });

    // Render projects grid
    renderProjects(projects);

    // Render upcoming tasks
    renderUpcomingTasks(myTasks);
  } catch (err) {
    console.error('[dashboard] Failed to load dashboard:', err);
  }
}

function renderStatTiles({ totalProjects, openTasks, dueThisWeek, overdue }) {
  const container = document.getElementById('stat-tiles-container');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-header">
        <span>Active projects</span>
        <div class="stat-icon" style="background: rgba(13, 148, 136, 0.12); color: #0D9488;">
          ${icon('folder', 'icon-md')}
        </div>
      </div>
      <div class="stat-value" id="stat-val-projects">0</div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span>Assigned to me</span>
        <div class="stat-icon" style="background: rgba(59, 130, 246, 0.12); color: #3B82F6;">
          ${icon('list-checks', 'icon-md')}
        </div>
      </div>
      <div class="stat-value" id="stat-val-tasks">0</div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span>Due this week</span>
        <div class="stat-icon" style="background: rgba(245, 165, 36, 0.12); color: #F5A524;">
          ${icon('clock', 'icon-md')}
        </div>
      </div>
      <div class="stat-value" id="stat-val-due">0</div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span>Overdue tasks</span>
        <div class="stat-icon" style="background: rgba(229, 72, 77, 0.12); color: #E5484D;">
          ${icon('alert-circle', 'icon-md')}
        </div>
      </div>
      <div class="stat-value" id="stat-val-overdue" style="${overdue > 0 ? 'color: var(--priority-high);' : ''}">0</div>
    </div>
  `;

  // Animate numbers
  animateCount(document.getElementById('stat-val-projects'), totalProjects);
  animateCount(document.getElementById('stat-val-tasks'), openTasks);
  animateCount(document.getElementById('stat-val-due'), dueThisWeek);
  animateCount(document.getElementById('stat-val-overdue'), overdue);
}

function renderProjects(projects) {
  const grid = document.getElementById('projects-grid');
  const countBadge = document.getElementById('projects-total-count');
  if (!grid) return;

  if (countBadge) countBadge.textContent = projects.length;

  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">
          ${icon('folder', 'icon-lg')}
        </div>
        <div class="empty-state-title">No projects yet</div>
        <div class="empty-state-desc">Create your first group project to start collaborating with your team.</div>
        <button class="btn btn-primary" onclick="document.getElementById('btn-new-project-sidebar')?.click()">
          ${icon('plus', 'icon-sm')} Create project
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map(renderProjectCard).join('');
}

function renderUpcomingTasks(tasks) {
  const list = document.getElementById('upcoming-tasks-list');
  if (!list) return;

  // Filter open tasks and sort by due date (closest first)
  const open = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    })
    .slice(0, 6);

  if (open.length === 0) {
    list.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: var(--font-size-sm);">
        ${icon('check', 'icon-lg')}
        <div style="margin-top: 8px;">All caught up! No pending tasks assigned to you.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = open
    .map((t) => {
      const projColor = t.project ? t.project.color : '#0D9488';
      const projName = t.project ? escapeHtml(t.project.name) : 'Project';
      const safeTitle = escapeHtml(t.title);
      const dueChip = t.dueDate ? renderDueDateChip(t.dueDate) : '';

      return `
        <a href="/projects/${t.project.id}#task=${t.id}" class="upcoming-task-item"
           style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--bg-surface-2); text-decoration: none; color: inherit; transition: all var(--duration-fast) var(--ease-default); gap: 12px;">
          
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <span class="project-dot" style="background-color: ${projColor};" title="${projName}"></span>
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <span style="font-size: var(--font-size-sm); font-weight: 500; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${safeTitle}
              </span>
              <span style="font-size: var(--font-size-xs); color: var(--text-subtle);">
                ${projName}
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            ${dueChip}
          </div>
        </a>
      `;
    })
    .join('');
}
