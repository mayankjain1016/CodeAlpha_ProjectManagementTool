/**
 * TaskFlow Skeletons Component
 * Reusable shimmer skeleton placeholders for smooth loading states.
 */

export function renderStatCardSkeleton() {
  return `
    <div class="stat-card">
      <div class="stat-header">
        <div class="skeleton" style="width: 80px; height: 16px;"></div>
        <div class="skeleton" style="width: 32px; height: 32px; border-radius: var(--radius-md);"></div>
      </div>
      <div class="skeleton" style="width: 50px; height: 32px; margin-top: 4px;"></div>
    </div>
  `;
}

export function renderProjectCardSkeleton() {
  return `
    <div class="project-card" style="cursor: default;">
      <div class="skeleton" style="height: 5px; width: 100%;"></div>
      <div class="project-card-body">
        <div class="skeleton" style="width: 60%; height: 20px;"></div>
        <div class="skeleton" style="width: 100%; height: 14px;"></div>
        <div class="skeleton" style="width: 80%; height: 14px;"></div>
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 6px;">
          <div class="skeleton" style="width: 100%; height: 6px;"></div>
        </div>
      </div>
      <div class="project-card-footer">
        <div class="skeleton" style="width: 60px; height: 24px; border-radius: var(--radius-full);"></div>
        <div class="skeleton" style="width: 70px; height: 14px;"></div>
      </div>
    </div>
  `;
}

export function renderTaskCardSkeleton() {
  return `
    <div class="task-card" style="cursor: default;">
      <div class="skeleton" style="width: 85%; height: 16px;"></div>
      <div class="skeleton" style="width: 50%; height: 14px;"></div>
      <div class="task-card-footer">
        <div class="skeleton" style="width: 60px; height: 20px; border-radius: var(--radius-sm);"></div>
        <div class="skeleton" style="width: 24px; height: 24px; border-radius: var(--radius-full);"></div>
      </div>
    </div>
  `;
}
