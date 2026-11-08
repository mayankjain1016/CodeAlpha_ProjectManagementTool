/**
 * TaskFlow App Shell
 * Injects and coordinates the global navigation, header, theme toggle,
 * user menu, notification polling, and global search.
 */

import { getUser, logout } from './auth.js';
import { api } from './api.js';
import { icon } from './icons.js';
import { renderAvatar } from './avatar.js';
import { toggleTheme, getTheme } from './theme.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, debounce } from './utils.js';

let notificationTimer = null;
let currentProjects = [];

export async function initShell(activePage = 'dashboard') {
  const user = getUser();
  if (!user) return;

  const shellRoot = document.getElementById('app-shell');
  if (!shellRoot) return;

  // Build the shell HTML structure
  shellRoot.innerHTML = `
    <div class="app-container">
      <!-- Mobile Backdrop -->
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

      <!-- Left Sidebar -->
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <a href="/dashboard" class="brand-link">
            <span class="brand-icon">
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                <rect x="6" y="8" width="20" height="3.5" rx="1.75" fill="#fff"/>
                <rect x="6" y="14.5" width="20" height="3.5" rx="1.75" fill="#fff" opacity=".8"/>
                <rect x="6" y="21" width="20" height="3.5" rx="1.75" fill="#fff" opacity=".5"/>
              </svg>
            </span>
            <span>TaskFlow</span>
          </a>
        </div>

        <div class="sidebar-scroll">
          <div class="nav-section">
            <a href="/dashboard" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
              ${icon('layout-grid')}
              <span>Dashboard</span>
            </a>
            <a href="/my-tasks" class="nav-item ${activePage === 'my-tasks' ? 'active' : ''}">
              ${icon('list-checks')}
              <span>My Tasks</span>
              <span class="nav-counter" id="my-tasks-counter">0</span>
            </a>
          </div>

          <div class="nav-section">
            <div class="nav-section-title">
              <span>Projects</span>
              <button class="sidebar-btn-add" id="btn-new-project-sidebar" title="New project" aria-label="New project">
                ${icon('plus', 'icon-sm')}
              </button>
            </div>
            <div id="sidebar-projects-list" style="display: flex; flex-direction: column; gap: 2px;">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="app-main">
        <!-- Top Bar -->
        <header class="app-topbar">
          <div class="topbar-left">
            <button class="mobile-menu-btn" id="btn-mobile-menu" aria-label="Toggle menu">
              ${icon('layout-grid')}
            </button>

            <!-- Global Search -->
            <div class="global-search-container">
              <span class="global-search-icon">${icon('search', 'icon-sm')}</span>
              <input type="text" class="global-search-input" id="global-search-input" placeholder="Search tasks, projects..." autocomplete="off">
              <div class="search-results-dropdown" id="search-results-dropdown"></div>
            </div>
          </div>

          <!-- Topbar Actions -->
          <div class="topbar-right">
            <!-- Theme Toggle -->
            <button class="topbar-btn" id="btn-theme-toggle" title="Toggle theme" aria-label="Toggle theme">
              ${getTheme() === 'dark' ? icon('sun') : icon('moon')}
            </button>

            <!-- Notifications Bell -->
            <div style="position: relative;">
              <button class="topbar-btn" id="btn-notifications" title="Notifications" aria-label="Notifications">
                ${icon('bell')}
                <span class="unread-badge" id="notification-badge"></span>
              </button>

              <!-- Notifications Popover -->
              <div class="notification-popover" id="notification-popover">
                <div class="notification-header">
                  <h3>Notifications</h3>
                  <button class="btn-mark-all-read" id="btn-mark-all-read">Mark all read</button>
                </div>
                <div class="notification-list" id="notification-list">
                  <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--font-size-sm);">
                    Loading...
                  </div>
                </div>
              </div>
            </div>

            <!-- User Menu -->
            <div class="user-menu-container">
              <button class="user-avatar-btn" id="btn-user-menu" aria-label="User profile">
                ${renderAvatar(user, 32)}
              </button>
              <div class="user-dropdown" id="user-dropdown">
                <div class="user-dropdown-header">
                  <div class="user-dropdown-name">${escapeHtml(user.name)}</div>
                  <div class="user-dropdown-email">${escapeHtml(user.email)}</div>
                </div>
                <div class="dropdown-item danger" id="btn-logout">
                  ${icon('log-out', 'icon-sm')}
                  <span>Log out</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- View Body Content -->
        <main class="app-content" id="page-content">
          <!-- Page content injected here -->
        </main>
      </div>
    </div>

    <!-- Global New Project Modal -->
    <div class="modal-backdrop" id="modal-new-project">
      <div class="modal" role="dialog" aria-labelledby="modal-new-proj-title">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-new-proj-title">Create new project</h2>
          <button class="btn-ghost btn-icon" data-close-modal aria-label="Close modal">
            ${icon('x')}
          </button>
        </div>
        <form id="form-new-project">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="new-proj-name">Project Name</label>
              <input type="text" id="new-proj-name" class="form-input" placeholder="e.g. Mobile App Redesign" required minlength="2" maxlength="60">
            </div>

            <div class="form-group">
              <label class="form-label" for="new-proj-desc">Description (optional)</label>
              <textarea id="new-proj-desc" class="form-input" style="height: 70px; resize: vertical;" placeholder="What is this project about?" maxlength="300"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Color theme</label>
              <div class="color-swatches" id="project-color-swatches">
                <!-- Color options -->
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-create-project-submit">Create project</button>
          </div>
        </form>
      </div>
    </div>
  `;

  setupShellEvents();
  loadSidebarData();
  startNotificationPolling();
}

/**
 * Attaches event listeners for shell elements.
 */
function setupShellEvents() {
  // Mobile drawer toggle
  const mobileBtn = document.getElementById('btn-mobile-menu');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (mobileBtn && sidebar && backdrop) {
    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('open');
    };
    mobileBtn.onclick = toggleSidebar;
    backdrop.onclick = toggleSidebar;
  }

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.onclick = () => {
      const next = toggleTheme();
      themeBtn.innerHTML = next === 'dark' ? icon('sun') : icon('moon');
    };
  }

  // User menu toggle
  const userBtn = document.getElementById('btn-user-menu');
  const userDropdown = document.getElementById('user-dropdown');
  if (userBtn && userDropdown) {
    userBtn.onclick = (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('open');
      // close notification if open
      document.getElementById('notification-popover')?.classList.remove('open');
    };
  }

  // Logout button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => logout();
  }

  // Notifications popover toggle
  const notifBtn = document.getElementById('btn-notifications');
  const notifPopover = document.getElementById('notification-popover');
  if (notifBtn && notifPopover) {
    notifBtn.onclick = (e) => {
      e.stopPropagation();
      notifPopover.classList.toggle('open');
      userDropdown?.classList.remove('open');
      if (notifPopover.classList.contains('open')) {
        fetchNotifications();
      }
    };
  }

  // Mark all read button
  const markReadBtn = document.getElementById('btn-mark-all-read');
  if (markReadBtn) {
    markReadBtn.onclick = async () => {
      try {
        await api.post('/notifications/read-all');
        const badge = document.getElementById('notification-badge');
        if (badge) badge.classList.remove('active');
        fetchNotifications();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (userDropdown && !userDropdown.contains(e.target) && e.target !== userBtn) {
      userDropdown.classList.remove('open');
    }
    if (notifPopover && !notifPopover.contains(e.target) && !notifBtn?.contains(e.target)) {
      notifPopover.classList.remove('open');
    }
    const searchDropdown = document.getElementById('search-results-dropdown');
    if (searchDropdown && !searchDropdown.contains(e.target) && e.target.id !== 'global-search-input') {
      searchDropdown.classList.remove('open');
    }
  });

  // Setup New Project Modal
  setupNewProjectModal();

  // Setup Global Search
  setupGlobalSearch();
}

/**
 * Loads project list and unassigned task count for the sidebar.
 */
export async function loadSidebarData() {
  try {
    const [projRes, tasksRes] = await Promise.all([
      api.get('/projects'),
      api.get('/tasks/mine'),
    ]);

    currentProjects = projRes.projects || [];
    renderSidebarProjects(currentProjects);

    const taskCountEl = document.getElementById('my-tasks-counter');
    if (taskCountEl) {
      taskCountEl.textContent = (tasksRes.tasks || []).length;
    }
  } catch (err) {
    console.error('[shell] Failed to load sidebar data:', err);
  }
}

function renderSidebarProjects(projects) {
  const container = document.getElementById('sidebar-projects-list');
  if (!container) return;

  const currentPath = window.location.pathname;

  if (projects.length === 0) {
    container.innerHTML = `
      <div style="padding: 8px 10px; font-size: var(--font-size-xs); color: var(--text-subtle);">
        No projects yet
      </div>
    `;
    return;
  }

  container.innerHTML = projects
    .map((p) => {
      const active = currentPath === `/projects/${p.id}`;
      return `
        <a href="/projects/${p.id}" class="nav-item ${active ? 'active' : ''}" title="${escapeHtml(p.name)}">
          <span class="project-dot" style="background-color: ${p.color};"></span>
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
            ${escapeHtml(p.name)}
          </span>
          <span class="nav-counter">${p.stats ? p.stats.total : 0}</span>
        </a>
      `;
    })
    .join('');
}

/**
 * Setup New Project Modal logic and color palette.
 */
const PROJECT_COLORS = ['#6366F1', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#10B981'];

function setupNewProjectModal() {
  const openBtn = document.getElementById('btn-new-project-sidebar');
  const modal = document.getElementById('modal-new-project');
  const colorContainer = document.getElementById('project-color-swatches');
  const form = document.getElementById('form-new-project');

  if (!modal || !colorContainer || !form) return;

  // Render swatches
  colorContainer.innerHTML = PROJECT_COLORS.map(
    (c, i) => `
      <input type="radio" name="projectColor" id="color-${i}" value="${c}" class="color-swatch-radio" ${i === 1 ? 'checked' : ''}>
      <label for="color-${i}" class="color-swatch-label" style="background-color: ${c};" title="${c}"></label>
    `
  ).join('');

  if (openBtn) {
    openBtn.onclick = () => openModal(modal);
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('new-proj-name');
    const descInput = document.getElementById('new-proj-desc');
    const checkedColor = form.querySelector('input[name="projectColor"]:checked');
    const submitBtn = document.getElementById('btn-create-project-submit');

    if (!nameInput.value.trim()) return;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const res = await api.post('/projects', {
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        color: checkedColor ? checkedColor.value : PROJECT_COLORS[0],
      });

      showToast('Project created successfully', 'success');
      closeModal(modal);
      form.reset();
      // Redirect to the new board
      window.location.href = `/projects/${res.project.id}`;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  };
}

/**
 * Setup Global Search across accessible projects and tasks.
 */
function setupGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const dropdown = document.getElementById('search-results-dropdown');
  if (!input || !dropdown) return;

  const onSearch = debounce(async () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      return;
    }

    try {
      const [projRes, tasksRes] = await Promise.all([
        api.get('/projects'),
        api.get('/tasks/mine'),
      ]);

      const matchedProjects = (projRes.projects || []).filter(
        (p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
      );

      const matchedTasks = (tasksRes.tasks || []).filter(
        (t) => t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query))
      );

      if (matchedProjects.length === 0 && matchedTasks.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: var(--font-size-sm);">
            No matching results found
          </div>
        `;
        dropdown.classList.add('open');
        return;
      }

      let html = '';

      if (matchedProjects.length > 0) {
        html += `<div class="search-result-group"><div class="search-group-title">Projects</div>`;
        matchedProjects.forEach((p) => {
          html += `
            <a href="/projects/${p.id}" class="search-result-item">
              <span class="project-dot" style="background-color: ${p.color};"></span>
              <div class="search-result-meta">
                <span class="search-result-title">${escapeHtml(p.name)}</span>
                <span class="search-result-sub">${p.stats ? p.stats.total : 0} tasks</span>
              </div>
            </a>
          `;
        });
        html += `</div>`;
      }

      if (matchedTasks.length > 0) {
        html += `<div class="search-result-group"><div class="search-group-title">My Tasks</div>`;
        matchedTasks.forEach((t) => {
          html += `
            <a href="/projects/${t.project.id}#task=${t.id}" class="search-result-item">
              ${icon('list-checks', 'icon-sm')}
              <div class="search-result-meta">
                <span class="search-result-title">${escapeHtml(t.title)}</span>
                <span class="search-result-sub">${escapeHtml(t.project.name)} &bull; ${t.status}</span>
              </div>
            </a>
          `;
        });
        html += `</div>`;
      }

      dropdown.innerHTML = html;
      dropdown.classList.add('open');
    } catch (err) {
      console.error('[search] Error searching:', err);
    }
  }, 250);

  input.addEventListener('input', onSearch);
  input.addEventListener('focus', () => {
    if (input.value.trim()) dropdown.classList.add('open');
  });
}

/**
 * Fetch and render notifications.
 */
async function fetchNotifications() {
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');
  if (!badge && !list) return;

  try {
    const res = await api.get('/notifications');
    const { notifications, unreadCount } = res;

    if (badge) {
      if (unreadCount > 0) {
        badge.classList.add('active');
      } else {
        badge.classList.remove('active');
      }
    }

    if (list) {
      if (!notifications || notifications.length === 0) {
        list.innerHTML = `
          <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: var(--font-size-sm);">
            No notifications yet
          </div>
        `;
        return;
      }

      list.innerHTML = notifications
        .map((n) => {
          let text = '';
          const actorName = n.actor ? escapeHtml(n.actor.name) : 'Someone';
          const projName = n.project ? escapeHtml(n.project.name) : 'a project';
          const taskTitle = n.task ? escapeHtml(n.task.title) : 'a task';

          if (n.type === 'assigned') {
            text = `<strong>${actorName}</strong> assigned you to "<strong>${taskTitle}</strong>" in <em>${projName}</em>`;
          } else if (n.type === 'commented') {
            text = `<strong>${actorName}</strong> commented on "<strong>${taskTitle}</strong>" in <em>${projName}</em>`;
          } else if (n.type === 'added_to_project') {
            text = `<strong>${actorName}</strong> added you to project <em>${projName}</em>`;
          }

          const targetUrl = n.task && n.project ? `/projects/${n.project.id}#task=${n.task.id}` : n.project ? `/projects/${n.project.id}` : '#';

          return `
            <a href="${targetUrl}" class="notification-item ${!n.read ? 'unread' : ''}">
              ${renderAvatar(n.actor, 28)}
              <div class="notification-content">
                <div class="notification-text">${text}</div>
                <div class="notification-time">${formatRelativeTime(n.createdAt)}</div>
              </div>
            </a>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('[notifications] Failed to fetch:', err);
  }
}

/**
 * Polling every 20 seconds while visible.
 */
function startNotificationPolling() {
  fetchNotifications();

  function poll() {
    if (document.visibilityState === 'visible') {
      fetchNotifications();
    }
  }

  notificationTimer = setInterval(poll, 20000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchNotifications();
    }
  });
}
