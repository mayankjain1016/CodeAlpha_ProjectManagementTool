/**
 * TaskFlow Modal Manager
 * Accessible modals with focus trapping, Escape to close, and backdrop clicks.
 */

let activeModal = null;
let lastFocusedElement = null;

export function openModal(modalEl) {
  if (typeof modalEl === 'string') {
    modalEl = document.querySelector(modalEl);
  }
  if (!modalEl) return;

  lastFocusedElement = document.activeElement;
  activeModal = modalEl;

  modalEl.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Find first focusable element
  const focusable = modalEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length) {
    focusable[0].focus();
  }

  // Bind close buttons
  modalEl.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.onclick = () => closeModal(modalEl);
  });

  // Click on backdrop (outside modal content) closes it
  modalEl.onclick = (e) => {
    if (e.target === modalEl) {
      closeModal(modalEl);
    }
  };
}

export function closeModal(modalEl) {
  if (typeof modalEl === 'string') {
    modalEl = document.querySelector(modalEl);
  }
  if (!modalEl) modalEl = activeModal;
  if (!modalEl) return;

  modalEl.classList.remove('open');
  document.body.style.overflow = '';
  activeModal = null;

  if (lastFocusedElement) {
    lastFocusedElement.focus();
  }
}

// Global Escape key listener
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeModal) {
    closeModal(activeModal);
  }
});

