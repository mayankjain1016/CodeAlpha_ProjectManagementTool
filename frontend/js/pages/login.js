/**
 * TaskFlow Login Page Logic
 */

import { api } from '../core/api.js';
import { setSession, requireGuest } from '../core/auth.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';

// Redirect if already logged in
if (requireGuest()) {
  initLogin();
}

function initLogin() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePassBtn = document.getElementById('toggle-password');
  const submitBtn = document.getElementById('btn-submit');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const serverError = document.getElementById('server-error');
  const demoBtn = document.getElementById('btn-fill-demo');

  // Set toggle icon
  togglePassBtn.innerHTML = icon('eye', 'icon-sm');

  let showPassword = false;
  togglePassBtn.onclick = () => {
    showPassword = !showPassword;
    passwordInput.type = showPassword ? 'text' : 'password';
    togglePassBtn.innerHTML = icon(showPassword ? 'eye-off' : 'eye', 'icon-sm');
  };

  // Demo fill button
  if (demoBtn) {
    demoBtn.onclick = () => {
      emailInput.value = 'demo@taskflow.in';
      passwordInput.value = 'Demo@123';
      emailError.textContent = '';
      passwordError.textContent = '';
      serverError.classList.remove('visible');
    };
  }

  // Clear errors on input
  emailInput.oninput = () => {
    emailError.textContent = '';
    serverError.classList.remove('visible');
  };
  passwordInput.oninput = () => {
    passwordError.textContent = '';
    serverError.classList.remove('visible');
  };

  form.onsubmit = async (e) => {
    e.preventDefault();

    let hasError = false;
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      emailError.textContent = 'Email is required';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailError.textContent = 'Please enter a valid email';
      hasError = true;
    }

    if (!password) {
      passwordError.textContent = 'Password is required';
      hasError = true;
    }

    if (hasError) return;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> <span>Signing in...</span>`;

    try {
      const res = await api.post('/auth/login', { email, password });
      setSession(res.token, res.user);

      // Check for returnUrl
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      const target = returnUrl && returnUrl.startsWith('/') ? decodeURIComponent(returnUrl) : '/dashboard';
      window.location.replace(target);
    } catch (err) {
      serverError.textContent = err.message || 'Wrong email or password';
      serverError.classList.add('visible');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Sign in</span>`;
    }
  };
}

