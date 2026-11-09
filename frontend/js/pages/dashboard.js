/**
 * TaskFlow Dashboard Page Logic
 * Linear-meets-Trello aesthetic: sleek metric cards without pastel icons,
 * project cards with gradient banners, upcoming tasks list, and team workload widget.
 */

import { api } from '../core/api.js';
import { getUser, requireAuth } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { renderAvatar } from '../core/avatar.js';
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

  const dateEl = document.getElementById('greeting-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

    // Render team workload
    renderTeamWorkload(projects, myTasks);
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
        <span class="stat-label">Active projects</span>
      </div>
      <div class="stat-value" id="stat-val-projects">0</div>
      <div class="stat-micro-bar">
        <div class="stat-micro-fill" style="width: ${Math.min(totalProjects * 25, 100)}%; background-color: var(--teal-500);"></div>
      </div>
      <div class="metric-context">${totalProjects} active workspace project${totalProjects === 1 ? '' : 's'}</div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Assigned to me</span>
      </div>
      <div class="stat-value" id="stat-val-tasks">0</div>
      <div class="stat-micro-bar">
        <div class="stat-micro-fill" style="width: ${Math.min(openTasks * 20, 100)}%; background-color: #3B82F6;"></div>
      </div>
      <div class="metric-context">${openTasks > 0 ? `${openTasks} tasks pending completion` : 'All tasks completed'}</div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Due this week</span>
      </div>
      <div class="stat-value" id="stat-val-due">0</div>
      <div class="stat-micro-bar">
        <div class="stat-micro-fill" style="width: ${Math.min(dueThisWeek * 25, 100)}%; background-color: #F5A524;"></div>
      </div>
      <div class="metric-context">${dueThisWeek > 0 ? `${dueThisWeek} scheduled in next 7 days` : 'No upcoming deadlines'}</div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Overdue tasks</span>
      </div>
      <div class="stat-value" id="stat-val-overdue" style="${overdue > 0 ? 'color: var(--priority-high);' : ''}">0</div>
      <div class="stat-micro-bar">
        <div class="stat-micro-fill" style="width: ${overdue > 0 ? '100%' : '0%'}; background-color: var(--priority-high);"></div>
      </div>
      <div class="metric-context ${overdue > 0 ? 'urgent' : ''}">${overdue > 0 ? `${overdue} require immediate action` : 'Zero overdue items'}</div>
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
    .slice(0, 5);

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

function renderTeamWorkload(projects, myTasks) {
  const container = document.getElementById('team-workload-list');
  const countBadge = document.getElementById('workload-members-count');
  if (!container) return;

  // Aggregate distinct members across all projects
  const memberMap = new Map();
  projects.forEach((p) => {
    (p.members || []).forEach((m) => {
      if (!memberMap.has(m.id)) {
        memberMap.set(m.id, {
          user: m,
          projectCount: 0,
          taskCount: 0,
        });
      }
      memberMap.get(m.id).projectCount += 1;
    });
  });

  const currentUser = getUser();
  if (currentUser && !memberMap.has(currentUser.id)) {
    memberMap.set(currentUser.id, {
      user: currentUser,
      projectCount: projects.length,
      taskCount: myTasks.length,
    });
  }

  // Count my tasks for current user
  if (currentUser && memberMap.has(currentUser.id)) {
    memberMap.get(currentUser.id).taskCount = myTasks.length;
  }

  const members = Array.from(memberMap.values()).slice(0, 5);
  if (countBadge) countBadge.textContent = members.length;

  if (members.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: var(--font-size-xs);">
        No team members found
      </div>
    `;
    return;
  }

  // Find max projects or tasks for scaling
  const maxProjects = Math.max(...members.map((m) => m.projectCount), 1);

  container.innerHTML = members
    .map((item) => {
      const pct = Math.round((item.projectCount / maxProjects) * 100);
      return `
        <div class="workload-item">
          ${renderAvatar(item.user, 24)}
          <div class="workload-info">
            <span class="workload-name" title="${escapeHtml(item.user.name)}">${escapeHtml(item.user.name)}</span>
          </div>
          <div class="workload-bar-wrap">
            <div class="workload-bar-fill" style="width: ${Math.max(pct, 15)}%;"></div>
          </div>
          <span class="workload-count">${item.projectCount} proj</span>
        </div>
      `;
    })
    .join('');
}
