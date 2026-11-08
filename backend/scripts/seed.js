/**
 * Seed script — populates the database with realistic demo data.
 * Idempotent: clears existing seed data before inserting.
 * Refuses to run in production unless --force is passed.
 * Never logs connection strings or secrets.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { validateEnv } = require('../config/env');

validateEnv();

const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

// Refuse production runs without --force
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('[seed] Refusing to run in production. Pass --force to override.');
  process.exit(1);
}

const DEMO_USERS = [
  { name: 'Aarav Sharma', email: 'demo@taskflow.in', avatarHue: 195 },
  { name: 'Priya Patel', email: 'priya@taskflow.in', avatarHue: 320 },
  { name: 'Rohan Mehta', email: 'rohan@taskflow.in', avatarHue: 45 },
  { name: 'Ananya Gupta', email: 'ananya@taskflow.in', avatarHue: 160 },
  { name: 'Vikram Singh', email: 'vikram@taskflow.in', avatarHue: 270 },
  { name: 'Sneha Reddy', email: 'sneha@taskflow.in', avatarHue: 100 },
];

const PASSWORD = 'Demo@123';

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[seed] Connected to database');

  // Clear existing demo data
  const emails = DEMO_USERS.map((u) => u.email);
  const existingUsers = await User.find({ email: { $in: emails } });
  const existingIds = existingUsers.map((u) => u._id);

  if (existingIds.length) {
    const projects = await Project.find({ owner: { $in: existingIds } });
    const projectIds = projects.map((p) => p._id);
    const taskIds = await Task.find({ project: { $in: projectIds } }).distinct('_id');
    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: { $in: projectIds } });
    await Notification.deleteMany({ project: { $in: projectIds } });
    await Project.deleteMany({ _id: { $in: projectIds } });
    // Also delete projects where they are members
    await Project.deleteMany({ members: { $in: existingIds } });
    await User.deleteMany({ email: { $in: emails } });
    console.log('[seed] Cleared existing demo data');
  }

  // Create users
  const hashedPassword = await bcrypt.hash(PASSWORD, 12);
  const users = await User.insertMany(
    DEMO_USERS.map((u) => ({
      ...u,
      password: hashedPassword,
    }))
  );
  console.log(`[seed] Created ${users.length} users`);

  const [aarav, priya, rohan, ananya, vikram, sneha] = users;

  // Create projects
  const projects = await Project.insertMany([
    {
      name: 'Website Redesign',
      description: 'Complete overhaul of the company website with a modern design system, improved performance, and mobile-first approach.',
      color: '#3B82F6',
      owner: aarav._id,
      members: [aarav._id, priya._id, rohan._id, ananya._id],
    },
    {
      name: 'Mobile App Launch',
      description: 'Build and launch the TaskFlow mobile application for iOS and Android platforms with offline support.',
      color: '#8B5CF6',
      owner: aarav._id,
      members: [aarav._id, vikram._id, sneha._id, priya._id, rohan._id],
    },
    {
      name: 'Internship Portfolio',
      description: 'Collaborative portfolio showcasing all internship projects and learnings across the team.',
      color: '#0D9488',
      owner: priya._id,
      members: [priya._id, aarav._id, ananya._id],
    },
  ]);
  console.log(`[seed] Created ${projects.length} projects`);

  const [websiteProject, mobileProject, portfolioProject] = projects;

  // Helper for dates relative to today
  const d = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(23, 59, 59, 0);
    return date;
  };

  // Create tasks
  const tasks = await Task.insertMany([
    // Website Redesign — To Do
    { project: websiteProject._id, title: 'Design new color palette and typography', description: 'Research modern design trends and propose a new brand color palette with accessible contrast ratios.', status: 'todo', priority: 'high', dueDate: d(5), assignee: priya._id, createdBy: aarav._id, order: 0, commentsCount: 2 },
    { project: websiteProject._id, title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment to staging.', status: 'todo', priority: 'medium', dueDate: d(7), assignee: rohan._id, createdBy: aarav._id, order: 1, commentsCount: 1 },
    { project: websiteProject._id, title: 'Write accessibility audit checklist', description: 'Document WCAG 2.1 AA requirements and create a testing checklist for the team.', status: 'todo', priority: 'low', dueDate: d(14), assignee: ananya._id, createdBy: priya._id, order: 2, commentsCount: 0 },
    { project: websiteProject._id, title: 'Migrate blog content to new CMS', description: 'Export existing blog posts and migrate them to the new headless CMS structure.', status: 'todo', priority: 'medium', dueDate: null, assignee: null, createdBy: aarav._id, order: 3, commentsCount: 0 },

    // Website Redesign — In Progress
    { project: websiteProject._id, title: 'Build responsive navigation component', description: 'Create a responsive navbar with mobile hamburger menu, smooth transitions and keyboard navigation.', status: 'in_progress', priority: 'high', dueDate: d(2), assignee: aarav._id, createdBy: aarav._id, order: 0, commentsCount: 3 },
    { project: websiteProject._id, title: 'Implement dark mode toggle', description: 'Add theme switching with CSS custom properties and localStorage persistence.', status: 'in_progress', priority: 'medium', dueDate: d(4), assignee: priya._id, createdBy: aarav._id, order: 1, commentsCount: 0 },

    // Website Redesign — Done
    { project: websiteProject._id, title: 'Create wireframes for all pages', description: 'Low-fidelity wireframes for homepage, about, services, blog and contact pages.', status: 'done', priority: 'high', dueDate: d(-5), assignee: priya._id, createdBy: aarav._id, order: 0, commentsCount: 1 },
    { project: websiteProject._id, title: 'Set up project repository', description: 'Initialize Git repo, configure ESLint, Prettier, and project structure.', status: 'done', priority: 'medium', dueDate: d(-10), assignee: rohan._id, createdBy: aarav._id, order: 1, commentsCount: 0 },

    // Mobile App Launch — To Do
    { project: mobileProject._id, title: 'Research push notification services', description: 'Compare Firebase Cloud Messaging, OneSignal, and AWS SNS for cross-platform push notifications.', status: 'todo', priority: 'medium', dueDate: d(10), assignee: vikram._id, createdBy: aarav._id, order: 0, commentsCount: 1 },
    { project: mobileProject._id, title: 'Design onboarding screens', description: 'Create 4 onboarding screens showcasing key features with illustrations.', status: 'todo', priority: 'high', dueDate: d(3), assignee: sneha._id, createdBy: aarav._id, order: 1, commentsCount: 0 },
    { project: mobileProject._id, title: 'Plan offline data sync strategy', description: 'Define how the app handles offline edits and conflict resolution when reconnecting.', status: 'todo', priority: 'high', dueDate: d(-1), assignee: aarav._id, createdBy: aarav._id, order: 2, commentsCount: 2 },

    // Mobile App Launch — In Progress
    { project: mobileProject._id, title: 'Build authentication flow', description: 'Implement sign up, login, forgot password, and session management with secure token storage.', status: 'in_progress', priority: 'high', dueDate: d(1), assignee: rohan._id, createdBy: aarav._id, order: 0, commentsCount: 1 },
    { project: mobileProject._id, title: 'Create reusable component library', description: 'Build buttons, inputs, cards, modals and other common UI components with consistent styling.', status: 'in_progress', priority: 'medium', dueDate: d(6), assignee: priya._id, createdBy: aarav._id, order: 1, commentsCount: 0 },
    { project: mobileProject._id, title: 'Set up app navigation structure', description: 'Implement bottom tab navigation with stack navigators for each section.', status: 'in_progress', priority: 'medium', dueDate: d(4), assignee: vikram._id, createdBy: aarav._id, order: 2, commentsCount: 0 },

    // Mobile App Launch — Done
    { project: mobileProject._id, title: 'Finalize app architecture document', description: 'Document the tech stack, folder structure, state management approach and API layer design.', status: 'done', priority: 'high', dueDate: d(-7), assignee: aarav._id, createdBy: aarav._id, order: 0, commentsCount: 1 },
    { project: mobileProject._id, title: 'Set up development environment', description: 'Configure React Native environment, testing tools and developer build pipeline.', status: 'done', priority: 'medium', dueDate: d(-12), assignee: vikram._id, createdBy: aarav._id, order: 1, commentsCount: 0 },

    // Internship Portfolio — To Do
    { project: portfolioProject._id, title: 'Collect project screenshots', description: 'Take high-quality screenshots of each completed project in both light and dark themes.', status: 'todo', priority: 'medium', dueDate: d(8), assignee: aarav._id, createdBy: priya._id, order: 0, commentsCount: 0 },
    { project: portfolioProject._id, title: 'Write project case studies', description: 'Document the problem, approach, challenges and outcomes for each major project.', status: 'todo', priority: 'high', dueDate: d(5), assignee: ananya._id, createdBy: priya._id, order: 1, commentsCount: 1 },

    // Internship Portfolio — In Progress
    { project: portfolioProject._id, title: 'Design portfolio layout', description: 'Create a clean, professional portfolio layout with sections for projects, skills and contact.', status: 'in_progress', priority: 'high', dueDate: d(3), assignee: priya._id, createdBy: priya._id, order: 0, commentsCount: 0 },
    { project: portfolioProject._id, title: 'Build skills section with progress bars', description: 'Implement an animated skills section showing proficiency levels in each technology.', status: 'in_progress', priority: 'low', dueDate: d(6), assignee: aarav._id, createdBy: priya._id, order: 1, commentsCount: 0 },

    // Internship Portfolio — Done
    { project: portfolioProject._id, title: 'Set up portfolio hosting', description: 'Deploy the portfolio site on Render with a custom domain and SSL certificate.', status: 'done', priority: 'medium', dueDate: d(-3), assignee: aarav._id, createdBy: priya._id, order: 0, commentsCount: 0 },
    { project: portfolioProject._id, title: 'Create team introduction page', description: 'Design and build a page introducing each team member with photos and bios.', status: 'done', priority: 'low', dueDate: d(-8), assignee: ananya._id, createdBy: priya._id, order: 1, commentsCount: 1 },
  ]);
  console.log(`[seed] Created ${tasks.length} tasks`);

  // Create comments
  const comments = await Comment.insertMany([
    // Website — "Design new color palette"
    { task: tasks[0]._id, author: aarav._id, text: 'Let\'s make sure we include at least one high-contrast accent color for CTAs. The current blue feels too muted.' },
    { task: tasks[0]._id, author: priya._id, text: 'Agreed. I\'ll prepare three palette options by Friday — one warm, one cool, and one neutral.' },

    // Website — "Set up CI/CD pipeline"
    { task: tasks[1]._id, author: rohan._id, text: 'I\'ve started looking into GitHub Actions. Should I include staging and production environments or just staging for now?' },

    // Website — "Build responsive navigation"
    { task: tasks[4]._id, author: priya._id, text: 'The mobile menu animation looks great! Can we add a subtle backdrop blur effect?' },
    { task: tasks[4]._id, author: aarav._id, text: 'Good idea. I\'ll test it across browsers — backdrop-filter has some Edge quirks.' },
    { task: tasks[4]._id, author: rohan._id, text: 'Don\'t forget to handle the Escape key for closing the mobile menu. It\'s an accessibility requirement.' },

    // Website — "Create wireframes"
    { task: tasks[6]._id, author: aarav._id, text: 'These wireframes are solid. Moving this to done — great work Priya!' },

    // Mobile — "Research push notifications"
    { task: tasks[8]._id, author: vikram._id, text: 'FCM seems like the best choice for our stack. Free tier covers our needs easily.' },

    // Mobile — "Plan offline sync"
    { task: tasks[10]._id, author: aarav._id, text: 'We should use a last-write-wins strategy for simple fields and manual merge for complex conflicts.' },
    { task: tasks[10]._id, author: rohan._id, text: 'What about using CRDTs for the task description field? Might be overkill but worth considering.' },

    // Mobile — "Build auth flow"
    { task: tasks[11]._id, author: rohan._id, text: 'Token refresh logic is working. Need to add biometric unlock as a follow-up task.' },

    // Mobile — "Finalize architecture"
    { task: tasks[14]._id, author: vikram._id, text: 'The architecture doc is comprehensive. Shared it with the team for final review.' },

    // Portfolio — "Write case studies"
    { task: tasks[17]._id, author: priya._id, text: 'Each case study should be 300-500 words. Focus on the technical decisions and trade-offs.' },

    // Portfolio — "Create team page"
    { task: tasks[21]._id, author: priya._id, text: 'Looks fantastic! The card hover effects add a nice professional touch.' },
  ]);
  console.log(`[seed] Created ${comments.length} comments`);

  // Create notifications for the demo user (aarav)
  const notifications = await Notification.insertMany([
    { recipient: aarav._id, actor: priya._id, type: 'commented', project: websiteProject._id, task: tasks[4]._id, read: false },
    { recipient: aarav._id, actor: rohan._id, type: 'commented', project: websiteProject._id, task: tasks[4]._id, read: false },
    { recipient: aarav._id, actor: priya._id, type: 'added_to_project', project: portfolioProject._id, read: true },
    { recipient: aarav._id, actor: rohan._id, type: 'commented', project: mobileProject._id, task: tasks[10]._id, read: false },
    { recipient: aarav._id, actor: vikram._id, type: 'commented', project: mobileProject._id, task: tasks[14]._id, read: true },
    // Notifications for other users too
    { recipient: priya._id, actor: aarav._id, type: 'assigned', project: websiteProject._id, task: tasks[0]._id, read: false },
    { recipient: rohan._id, actor: aarav._id, type: 'assigned', project: websiteProject._id, task: tasks[1]._id, read: true },
    { recipient: vikram._id, actor: aarav._id, type: 'assigned', project: mobileProject._id, task: tasks[8]._id, read: false },
  ]);
  console.log(`[seed] Created ${notifications.length} notifications`);

  console.log('[seed] Done. Demo login: demo@taskflow.in / Demo@123');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});

