/**
 * TaskFlow Register Page Logic
 */

import { api } from '../core/api.js';
import { setSession, requireGuest } from '../core/auth.js';
import { icon } from '../core/icons.js';

if (requireGuest()) {
  initRegister();
}

function initRegister() {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePassBtn = document.getElementById('toggle-password');
  const submitBtn = document.getElementById('btn-submit');
  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const serverError = document.getElementById('server-error');

  const bar1 = document.getElementById('bar-1') || document.getElementById('str-1');
  const bar2 = document.getElementById('bar-2') || document.getElementById('str-2');
  const bar3 = document.getElementById('bar-3') || document.getElementById('str-3');

  togglePassBtn.innerHTML = icon('eye', 'icon-sm');

  let showPassword = false;
  togglePassBtn.onclick = () => {
    showPassword = !showPassword;
    passwordInput.type = showPassword ? 'text' : 'password';
    togglePassBtn.innerHTML = icon(showPassword ? 'eye-off' : 'eye', 'icon-sm');
  };

  // Password strength meter
  passwordInput.oninput = () => {
    passwordError.textContent = '';
    serverError.classList.remove('visible');

    const pass = passwordInput.value;
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass)) score++;
    if (pass.length >= 10 && /[^A-Za-z0-9]/.test(pass)) score++;

    // Reset classes
    [bar1, bar2, bar3].forEach((b) => {
      if (b) b.className = 'strength-bar';
    });

    if (score === 1) {
      if (bar1) bar1.classList.add('weak');
    } else if (score === 2) {
      if (bar1) bar1.classList.add('medium');
      if (bar2) bar2.classList.add('medium');
    } else if (score >= 3) {
      if (bar1) bar1.classList.add('strong');
      if (bar2) bar2.classList.add('strong');
      if (bar3) bar3.classList.add('strong');
    }
  };

  nameInput.oninput = () => {
    nameError.textContent = '';
    serverError.classList.remove('visible');
  };
  emailInput.oninput = () => {
    emailError.textContent = '';
    serverError.classList.remove('visible');
  };

  form.onsubmit = async (e) => {
    e.preventDefault();

    let hasError = false;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!name || name.length < 2) {
      nameError.textContent = 'Name must be at least 2 characters';
      hasError = true;
    }

    if (!email) {
      emailError.textContent = 'Email is required';
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailError.textContent = 'Please enter a valid email';
      hasError = true;
    }

    if (!password || password.length < 6) {
      passwordError.textContent = 'Password must be at least 6 characters';
      hasError = true;
    }

    if (hasError) return;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> <span>Creating account...</span>`;

    try {
      const res = await api.post('/auth/register', { name, email, password });
      setSession(res.token, res.user);
      window.location.replace('/dashboard');
    } catch (err) {
      serverError.textContent = err.message || 'Registration failed';
      serverError.classList.add('visible');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Create account</span>`;
    }
  };
}

