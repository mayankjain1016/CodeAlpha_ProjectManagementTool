/**
 * TaskFlow App Shell
 * Coordinates global navigation, collapsible sidebar, context breadcrumbs,
 * Linear-style Command Palette (Ctrl+K), real-time WebSockets, notifications,
 * and user theme preferences.
 */

import { getUser, logout } from './auth.js';
import { api } from './api.js';
import { icon } from './icons.js';
import { renderAvatar } from './avatar.js';
import { toggleTheme, getTheme } from './theme.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, debounce } from './utils.js';
import { initClientSocket } from './socket.js';

let notificationTimer = null;
let currentProjects = [];
let paletteActiveIndex = 0;
let paletteItems = [];

export async function initShell(activePage = 'dashboard') {
  const user = getUser();
  if (!user) return;

  const shellRoot = document.getElementById('app-shell');
  if (!shellRoot) return;

  const isCollapsed = localStorage.getItem('taskflow_sidebar_collapsed') === 'true';

  const breadcrumbTitle =
    activePage === 'dashboard'
      ? 'Dashboard'
      : activePage === 'my-tasks'
      ? 'My Tasks'
      : 'Board';

  // Build the shell HTML structure
  shellRoot.innerHTML = `
    <div class="app-container">
      <!-- Mobile Backdrop -->
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

      <!-- Left Sidebar -->
      <aside class="app-sidebar ${isCollapsed ? 'collapsed' : ''}" id="app-sidebar">
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
          <button class="sidebar-collapse-btn" id="btn-sidebar-collapse" title="Collapse sidebar" aria-label="Collapse sidebar">
            ${icon('sidebar', 'icon-sm')}
          </button>
        </div>

        <div class="sidebar-scroll">
          <div class="nav-section">
            <a href="/dashboard" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" title="Dashboard">
              ${icon('layout-grid')}
              <span>Dashboard</span>
            </a>
            <a href="/my-tasks" class="nav-item ${activePage === 'my-tasks' ? 'active' : ''}" title="My Tasks">
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

        <!-- Pinned User Card at Sidebar Bottom -->
        <div class="sidebar-user-card" id="sidebar-user-card">
          <div class="sidebar-user-info">
            ${renderAvatar(user, 28)}
            <div class="sidebar-user-text">
              <span class="sidebar-user-name">${escapeHtml(user.name)}</span>
              <span class="sidebar-user-email">${escapeHtml(user.email)}</span>
            </div>
          </div>
          <button class="sidebar-theme-toggle" id="btn-sidebar-theme-toggle" title="Toggle theme" aria-label="Toggle theme">
            ${getTheme() === 'dark' ? icon('sun', 'icon-sm') : icon('moon', 'icon-sm')}
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="app-main">
        <!-- Top Bar -->
        <header class="app-topbar">
          <div class="topbar-left" style="display: flex; align-items: center; gap: 16px;">
            <button class="mobile-menu-btn" id="btn-mobile-menu" aria-label="Toggle menu">
              ${icon('layout-grid')}
            </button>

            <!-- Context Breadcrumbs -->
            <nav class="topbar-breadcrumbs" id="topbar-breadcrumbs" aria-label="Breadcrumb">
              <a href="/dashboard" class="breadcrumb-item breadcrumb-home">Workspace</a>
              <span class="breadcrumb-separator">/</span>
              <span class="breadcrumb-item breadcrumb-current" id="breadcrumb-current-page">
                ${breadcrumbTitle}
              </span>
            </nav>

            <!-- Global Search & Command Trigger -->
            <div class="global-search-container" id="global-search-container">
              <span class="global-search-icon">${icon('search', 'icon-sm')}</span>
              <input type="text" class="global-search-input" id="global-search-input" placeholder="Search or jump to..." readonly autocomplete="off">
              <kbd class="search-kbd-hint" id="search-kbd-hint">Ctrl K</kbd>
            </div>
          </div>

          <!-- Topbar Actions -->
          <div class="topbar-right">
            <!-- Quiet Real-Time Connection Dot -->
            <div class="realtime-status-dot connected" id="realtime-status-dot" title="Real-time sync active"></div>

            <!-- Quick Create Button -->
            <button class="btn btn-primary btn-sm topbar-create-btn" id="btn-topbar-create">
              ${icon('plus', 'icon-sm')}
              <span>Create</span>
            </button>

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

    <!-- Global Command Palette Modal (Ctrl+K) -->
    <div class="palette-backdrop" id="command-palette-backdrop">
      <div class="palette-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="palette-search-wrap">
          <span class="palette-search-icon">${icon('command', 'icon-sm')}</span>
          <input type="text" class="palette-input" id="palette-input" placeholder="Type a command or search..." autocomplete="off">
          <kbd class="palette-esc-chip" id="palette-esc-chip">ESC</kbd>
        </div>
        <div class="palette-results" id="palette-results">
          <!-- Dynamic Results -->
        </div>
        <div class="palette-footer">
          <div class="palette-shortcut-hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
          <span class="palette-brand">TaskFlow</span>
        </div>
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
  setupCommandPalette();
  initClientSocket();
}

/**
 * Updates the breadcrumb current page slot (used by board page to set project name).
 */
export function setBreadcrumb(title, color = null) {
  const el = document.getElementById('breadcrumb-current-page');
  if (!el) return;
  if (color) {
    el.innerHTML = `<span class="project-dot" style="background-color: ${color};"></span><span>${escapeHtml(title)}</span>`;
  } else {
    el.textContent = title;
  }
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

  // Sidebar desktop collapse toggle
  const collapseBtn = document.getElementById('btn-sidebar-collapse');
  if (collapseBtn && sidebar) {
    collapseBtn.onclick = () => {
      const willCollapse = !sidebar.classList.contains('collapsed');
      sidebar.classList.toggle('collapsed', willCollapse);
      localStorage.setItem('taskflow_sidebar_collapsed', willCollapse ? 'true' : 'false');
    };
  }

  // Theme toggles (sync topbar & sidebar toggles)
  const themeBtn = document.getElementById('btn-theme-toggle');
  const sidebarThemeBtn = document.getElementById('btn-sidebar-theme-toggle');

  const updateThemeIcons = (currentTheme) => {
    const isDark = currentTheme === 'dark';
    if (themeBtn) themeBtn.innerHTML = isDark ? icon('sun') : icon('moon');
    if (sidebarThemeBtn) sidebarThemeBtn.innerHTML = isDark ? icon('sun', 'icon-sm') : icon('moon', 'icon-sm');
  };

  const handleThemeToggle = () => {
    const next = toggleTheme();
    updateThemeIcons(next);
  };

  if (themeBtn) themeBtn.onclick = handleThemeToggle;
  if (sidebarThemeBtn) sidebarThemeBtn.onclick = handleThemeToggle;

  // Topbar quick create button
  const topbarCreateBtn = document.getElementById('btn-topbar-create');
  if (topbarCreateBtn) {
    topbarCreateBtn.onclick = () => {
      const modal = document.getElementById('modal-new-project');
      if (modal) openModal(modal);
    };
  }

  // User menu toggle
  const userBtn = document.getElementById('btn-user-menu');
  const userDropdown = document.getElementById('user-dropdown');
  if (userBtn && userDropdown) {
    userBtn.onclick = (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('open');
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
  });

  // Setup New Project Modal
  setupNewProjectModal();
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
 * Linear-style Command Palette (Ctrl+K)
 */
function setupCommandPalette() {
  const backdrop = document.getElementById('command-palette-backdrop');
  const input = document.getElementById('palette-input');
  const resultsContainer = document.getElementById('palette-results');
  const escChip = document.getElementById('palette-esc-chip');
  const searchTrigger = document.getElementById('global-search-container');

  if (!backdrop || !input || !resultsContainer) return;

  const openPalette = () => {
    backdrop.classList.add('open');
    input.value = '';
    renderPaletteItems('');
    setTimeout(() => input.focus(), 50);
  };

  const closePalette = () => {
    backdrop.classList.remove('open');
    input.value = '';
  };

  // Triggers
  if (searchTrigger) {
    searchTrigger.onclick = openPalette;
  }
  if (escChip) {
    escChip.onclick = closePalette;
  }

  // Keyboard shortcut Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop.classList.contains('open')) {
        closePalette();
      } else {
        openPalette();
      }
    } else if (e.key === 'Escape' && backdrop.classList.contains('open')) {
      closePalette();
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette();
  });

  // Debounced search inside palette
  const handleInput = debounce(async () => {
    renderPaletteItems(input.value.trim().toLowerCase());
  }, 150);

  input.addEventListener('input', handleInput);

  // Keyboard navigation within results
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteActiveIndex = (paletteActiveIndex + 1) % Math.max(paletteItems.length, 1);
      updatePaletteSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteActiveIndex = (paletteActiveIndex - 1 + paletteItems.length) % Math.max(paletteItems.length, 1);
      updatePaletteSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = paletteItems[paletteActiveIndex];
      if (selected) {
        executePaletteItem(selected);
      }
    }
  });

  async function renderPaletteItems(query) {
    paletteItems = [];
    paletteActiveIndex = 0;

    let navMatches = [
      { id: 'nav-dash', type: 'nav', title: 'Dashboard', iconName: 'layout-grid', action: () => (window.location.href = '/dashboard'), shortcut: 'G D' },
      { id: 'nav-tasks', type: 'nav', title: 'My Tasks', iconName: 'list-checks', action: () => (window.location.href = '/my-tasks'), shortcut: 'G M' },
    ];

    let actionMatches = [
      {
        id: 'act-proj',
        type: 'action',
        title: 'Create new project',
        iconName: 'plus',
        action: () => {
          closePalette();
          const modal = document.getElementById('modal-new-project');
          if (modal) openModal(modal);
        },
        shortcut: 'C P',
      },
      {
        id: 'act-theme',
        type: 'action',
        title: 'Toggle light / dark theme',
        iconName: getTheme() === 'dark' ? 'sun' : 'moon',
        action: () => {
          toggleTheme();
          closePalette();
        },
        shortcut: 'T',
      },
    ];

    let projectMatches = currentProjects.map((p) => ({
      id: `proj-${p.id}`,
      type: 'project',
      title: p.name,
      color: p.color,
      meta: `${p.stats ? p.stats.total : 0} tasks`,
      action: () => (window.location.href = `/projects/${p.id}`),
    }));

    if (query) {
      navMatches = navMatches.filter((n) => n.title.toLowerCase().includes(query));
      actionMatches = actionMatches.filter((a) => a.title.toLowerCase().includes(query));
      projectMatches = projectMatches.filter((p) => p.title.toLowerCase().includes(query));
    }

    let taskMatches = [];
    if (query && query.length >= 2) {
      try {
        const tasksRes = await api.get('/tasks/mine');
        taskMatches = (tasksRes.tasks || [])
          .filter((t) => t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)))
          .map((t) => ({
            id: `task-${t.id}`,
            type: 'task',
            title: t.title,
            meta: `${t.project ? t.project.name : ''} • ${t.status}`,
            action: () => (window.location.href = `/projects/${t.project.id}#task=${t.id}`),
          }));
      } catch (err) {
        // silent
      }
    }

    let html = '';
    let globalIndex = 0;

    const buildGroup = (groupTitle, items) => {
      if (items.length === 0) return '';
      let groupHtml = `<div class="palette-group-title">${groupTitle}</div>`;
      items.forEach((item) => {
        const itemIdx = globalIndex++;
        paletteItems.push(item);

        let iconMarkup = item.iconName ? icon(item.iconName, 'icon-sm') : '';
        if (item.color) {
          iconMarkup = `<span class="project-dot" style="background-color: ${item.color};"></span>`;
        }

        groupHtml += `
          <div class="palette-item ${itemIdx === 0 ? 'active' : ''}" data-idx="${itemIdx}">
            ${iconMarkup}
            <span>${escapeHtml(item.title)}</span>
            ${item.shortcut ? `<kbd class="palette-item-meta">${item.shortcut}</kbd>` : ''}
            ${item.meta ? `<span class="palette-item-meta">${escapeHtml(item.meta)}</span>` : ''}
          </div>
        `;
      });
      return groupHtml;
    };

    html += buildGroup('Navigation', navMatches);
    html += buildGroup('Actions', actionMatches);
    html += buildGroup('Projects', projectMatches);
    html += buildGroup('Tasks', taskMatches);

    if (paletteItems.length === 0) {
      html = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: var(--font-size-sm);">
          No commands or results found for "<strong>${escapeHtml(query)}</strong>"
        </div>
      `;
    }

    resultsContainer.innerHTML = html;

    // Attach click events
    resultsContainer.querySelectorAll('.palette-item').forEach((el) => {
      el.onclick = () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        const item = paletteItems[idx];
        if (item) executePaletteItem(item);
      };
    });
  }

  function updatePaletteSelection() {
    resultsContainer.querySelectorAll('.palette-item').forEach((el) => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      el.classList.toggle('active', idx === paletteActiveIndex);
      if (idx === paletteActiveIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function executePaletteItem(item) {
    closePalette();
    if (typeof item.action === 'function') {
      item.action();
    }
  }
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
            <a href="${targetUrl}" class="notification-item ${!n.read ? 'unread' : ''}" data-notif-id="${n.id}">
              ${renderAvatar(n.actor, 28)}
              <div class="notification-content">
                <div class="notification-text">${text}</div>
                <div class="notification-time">${formatRelativeTime(n.createdAt)}</div>
              </div>
            </a>
          `;
        })
        .join('');

      list.querySelectorAll('.notification-item.unread').forEach((item) => {
        item.addEventListener('click', async () => {
          const notifId = item.getAttribute('data-notif-id');
          if (notifId) {
            try {
              await api.patch(`/notifications/${notifId}/read`);
              item.classList.remove('unread');
            } catch (e) {
              console.warn('[notifications] Single read error:', e);
            }
          }
        });
      });
    }
  } catch (err) {
    console.error('[notifications] Failed to fetch:', err);
  }
}

/**
 * Polling fallback every 20 seconds while visible.
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
