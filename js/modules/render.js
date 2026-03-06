// ════════════════════════════════════════════════════════
//  RENDERING FUNCTIONS
// ════════════════════════════════════════════════════════

import { DS, addDays, startOfWeek, daysInMonth, firstDayOfMonth, esc } from './utils.js';
import { getTodosForDate, isCompleted, getSuggestions } from './calendar.js';
import * as state from './state.js';

export function todoItemHTML(todo, date, reorder = null) {
  const done = isCompleted(todo, date);
  const rec = recLabel(todo);
  const isRec = todo.recurrence && todo.recurrence !== 'none';
  const ds = DS(date);
  const reorderHTML = reorder ? `
    <div class="todo-reorder">
      <button class="todo-reorder-btn" onclick="window.app.reorderTask('${todo.id}','${ds}',-1)" ${reorder.isFirst ? 'disabled' : ''}>↑</button>
      <button class="todo-reorder-btn" onclick="window.app.reorderTask('${todo.id}','${ds}',1)" ${reorder.isLast ? 'disabled' : ''}>↓</button>
    </div>` : '';
  return `
    <div class="todo-item${done?' done':''}" data-id="${todo.id}" data-date="${ds}">
      ${reorderHTML}
      <div class="todo-check${done?' checked':''}" onclick="window.app.toggleTodo('${todo.id}',window.app.parseDS('${ds}'))"></div>
      <span class="todo-text editable" ondblclick="window.app.quickEditTitle(this, '${todo.id}', '${ds}')">${esc(todo.title)}</span>
      ${rec ? `<span class="todo-badge${isRec?' recurring':''}">${rec}</span>` : ''}
      <button class="todo-edit" onclick="window.app.openEditModal('${todo.id}','${ds}')">✎</button>
      <button class="todo-delete" onclick="window.app.deleteTodo('${todo.id}','${ds}')">×</button>
    </div>`;
}

function recLabel(t) {
  if (!t.recurrence || t.recurrence==='none') return '';
  if (t.recurrence==='daily') return `↻ ${state.T.recDaily}`;
  if (t.recurrence==='weekly') {
    const names = (t.recDays||[]).map(i=>state.DAYS[i]).join(', ');
    return `↻ ${names}`;
  }
  if (t.recurrence==='monthly') return `↻ ${state.T.recMonthly}`;
  if (t.recurrence==='yearly')  return `↻ ${state.T.recYearly}`;
  return '';
}

export function renderDayView(todos) {
  const navDate = state.navDate;
  const dateStr = DS(navDate);
  const allItems = getTodosForDate(navDate, todos);

  const prevDate = new Date(navDate); prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(navDate); nextDate.setDate(nextDate.getDate() + 1);

  const header = `
    <div class="day-header-wrapper">
      <button class="day-nav-btn" onclick="window.app.navigate(-1)" title="${state.DAY_FULL[prevDate.getDay()]}">←</button>
      <div class="day-header">
        <div class="day-name-large">${state.DAY_FULL[navDate.getDay()]}</div>
        <div class="day-date-line">
          <span class="day-number">${navDate.getDate()}</span>
          <span class="day-month-inline">${state.MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}</span>
        </div>
      </div>
      <button class="day-nav-btn" onclick="window.app.navigate(1)" title="${state.DAY_FULL[nextDate.getDay()]}">→</button>
    </div>`;

  const dailyItems = allItems.filter(t => t.recurrence === 'daily');
  const otherItems = allItems.filter(t => t.recurrence !== 'daily');

  // Sort non-daily by stored dayOrder
  const order = window.app?.dayOrder?.[dateStr] || [];
  const sortedOther = [...otherItems].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    if (ia < 0 && ib < 0) return 0;
    if (ia < 0) return 1; if (ib < 0) return -1;
    return ia - ib;
  });

  if (allItems.length === 0) {
    return `<div class="day-view">${header}
      <div class="todo-list">
        <div style="padding:32px 24px;background:var(--surface);border-radius:12px;border:1.5px solid var(--border);text-align:center;">
          <p style="margin:0;font-size:16px;font-weight:600;color:var(--text);">${state.T.emptyDay}</p>
        </div>
      </div>
    </div>`;
  }

  const hasBoth = dailyItems.length > 0 && otherItems.length > 0;
  let list = `<div class="todo-list">`;

  if (sortedOther.length > 0) {
    if (hasBoth) list += `<div class="day-group-label">${state.T.groupOnce}</div>`;
    sortedOther.forEach((t, i) => {
      list += todoItemHTML(t, navDate, { isFirst: i === 0, isLast: i === sortedOther.length - 1 });
    });
  }

  if (dailyItems.length > 0) {
    list += `<div class="day-group-label" style="margin-top:20px;">${state.T.recDaily}</div>`;
    list += dailyItems.map(t => todoItemHTML(t, navDate)).join('');
  }

  list += '</div>';
  return `<div class="day-view">${header}${list}</div>`;
}

export function renderWeekView(todos) {
  const todayStr = DS(new Date());
  let html = '<div class="week-view">';

  // Display 4 weeks
  for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
    const weekStart = addDays(startOfWeek(state.navDate), weekOffset * 7);
    const weekEnd = addDays(weekStart, 6);
    const weekNum = getWeekNumber(weekStart);
    const startStr = state.MONTHS[weekStart.getMonth()] + ' ' + weekStart.getDate();
    const endStr = state.MONTHS[weekEnd.getMonth()] + ' ' + weekEnd.getDate();

    html += `<div class="week-container" style="--week-delay: ${weekOffset * 80}ms;">
      <div class="week-title">${state.T.week} ${weekNum} — ${startStr} to ${endStr}</div>
      <div class="week-grid">`;

    // 7 days of the week
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const isT = DS(d) === todayStr;
      const items = getTodosForDate(d, todos).filter(t => t.recurrence !== 'daily');
      const ds = DS(d);
      html += `<div class="week-day-col${isT?' is-today':''}" onclick="window.app.setNavDateAndView('${ds}', 'day')">
        <div class="week-day-header">
          <div class="week-day-name">${state.DAYS[d.getDay()]}</div>
          <div class="week-day-num">${d.getDate()}</div>
        </div>
        <div class="week-day-todos">
          ${items.map(t => {
            const done = isCompleted(t,d);
            const isRec = t.recurrence && t.recurrence!=='none';
            return `<div class="week-todo-item${done?' done':''}${isRec?' recurring':''}" onclick="event.stopPropagation()">
              <div class="week-todo-check${done?' checked':''}" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'))"></div>
              <span class="week-todo-text">${esc(t.title)}</span>
              <button class="week-todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}','${ds}')">✎</button>
              <button class="week-todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}','${ds}')">×</button>
            </div>`;
          }).join('')}
          <button class="week-add-btn" onclick="event.stopPropagation();window.app.openModal(window.app.parseDS('${ds}'))" title="${state.T.addMore}">+</button>
        </div>
      </div>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDay) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
}

export function renderMonthView(todos) {
  const y = state.navDate.getFullYear(), m = state.navDate.getMonth();
  const firstDay = firstDayOfMonth(y,m);
  const days = daysInMonth(y,m);
  const todayDS = DS(new Date());
  let html = `<div class="month-view">
    <div class="month-header-bar">
      <button class="month-nav-btn" onclick="window.app.navigate(-1)">←</button>
      <div class="month-header-title">${state.MONTHS[m]} ${y}</div>
      <button class="month-nav-btn" onclick="window.app.navigate(1)">→</button>
    </div>
    <div class="month-grid-header">${state.DAYS.map(d=>`<div class="month-dow">${d}</div>`).join('')}</div>
    <div class="month-grid">`;

  // Prev month filler
  const prevDays = daysInMonth(y, m-1);
  for (let i=0; i<firstDay; i++) {
    const d2 = new Date(y, m-1, prevDays-firstDay+i+1);
    html += monthCell(d2, true, todayDS, todos);
  }
  // Current month
  for (let d=1; d<=days; d++) {
    const date = new Date(y, m, d);
    html += monthCell(date, false, todayDS, todos);
  }
  // Next month filler
  const total = firstDay + days;
  const nextCells = total%7 === 0 ? 0 : 7 - (total%7);
  for (let i=1; i<=nextCells; i++) {
    const d2 = new Date(y, m+1, i);
    html += monthCell(d2, true, todayDS, todos);
  }
  html += '</div></div>';
  return html;
}

function monthCell(date, otherMonth, todayDS, todos) {
  const ds = DS(date);
  const isT = ds===todayDS;
  const items = getTodosForDate(date, todos).filter(t => t.recurrence !== 'daily');
  const visible = items.slice(0,3);
  const more = items.length - visible.length;
  return `<div class="month-cell${otherMonth?' other-month':''}${isT?' is-today':''}"
    onclick="window.app.setNavDateAndView('${ds}', 'day')">
    <div class="month-cell-top">
      <div class="month-cell-num">${date.getDate()}</div>
      <button class="month-add-btn" onclick="event.stopPropagation();window.app.openModal(window.app.parseDS('${ds}'))">+</button>
    </div>
    ${visible.map(t => {
      const done = isCompleted(t,date);
      const isRec = t.recurrence && t.recurrence!=='none';
      return `<div class="month-todo-dot${done?' done':''}${isRec?' recurring':''}">
        <div class="month-dot-check" onclick="event.stopPropagation();window.app.toggleTodo('${t.id}',window.app.parseDS('${ds}'))"></div>
        <span class="month-todo-dot-text">${esc(t.title)}</span>
        <button class="month-todo-edit" onclick="event.stopPropagation();window.app.openEditModal('${t.id}','${ds}')">✎</button>
        <button class="month-todo-delete" onclick="event.stopPropagation();window.app.deleteTodo('${t.id}','${ds}')">×</button>
      </div>`;
    }).join('')}
    ${more>0 ? `<div class="month-more">${state.T.moreTasksCount.replace('{more}', more)}</div>` : ''}
  </div>`;
}

export function renderYearView(todos) {
  const y = state.navDate.getFullYear();
  const todayDS = DS(new Date());
  const td = new Date();
  let html = '<div class="year-view">';
  for (let m=0; m<12; m++) {
    const hasToday = td.getFullYear()===y && td.getMonth()===m;
    const days = daysInMonth(y,m);
    const firstDay = firstDayOfMonth(y,m);

    // Count todos for the month
    let total=0, done=0;
    for (let d=1; d<=days; d++) {
      const date = new Date(y,m,d);
      const items = getTodosForDate(date, todos);
      total += items.length;
      done += items.filter(t=>isCompleted(t,date)).length;
    }

    // Mini grid
    let miniHTML = '<div class="year-mini-grid">';
    miniHTML += state.DAYS.map(d=>`<div class="year-mini-dow">${d[0]}</div>`).join('');
    for (let i=0; i<firstDay; i++) miniHTML += '<div class="year-mini-day other">·</div>';
    for (let d=1; d<=days; d++) {
      const date = new Date(y,m,d);
      const ds = DS(date);
      const isT = ds===todayDS;
      const hasTodos = getTodosForDate(date, todos).length > 0;
      miniHTML += `<div class="year-mini-day${isT?' is-today':''}${hasTodos&&!isT?' has-todos':''}">${d}</div>`;
    }
    miniHTML += '</div>';

    html += `<div class="year-month-card${hasToday?' has-today':''}"
      onclick="window.app.setNavDateAndView(new Date(${y},${m},1), 'month')">
      <div class="year-month-name">${state.MONTHS[m]}</div>
      ${miniHTML}
      ${total>0 ? `<div class="year-month-stats">
        <span class="year-stat"><span class="year-stat-dot" style="background:var(--primary)"></span>${total} tasks</span>
        <span class="year-stat"><span class="year-stat-dot" style="background:var(--success)"></span>${done} ${state.T.done}</span>
      </div>` : `<div class="year-month-stats" style="color:var(--border)">${state.T.noTasks}</div>`}
    </div>`;
  }
  html += '</div>';
  return html;
}

export function renderSidebar(todos) {
  const MONTH_H = 185;
  const headerH = document.querySelector('header')?.offsetHeight ?? 65;
  const availH = window.innerHeight - headerH - 48;
  const maxMonths = Math.max(1, Math.floor(availH / MONTH_H));

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const navDate = state.navDate;

  let html = '';
  for (let i = 0; i < maxMonths; i++) {
    const monthDate = new Date(navDate.getFullYear(), navDate.getMonth() - 1 + i, 1);
    html += renderSideMonth(monthDate, todayDate, navDate, todos);
  }
  return html;
}

function renderSideMonth(monthDate, todayDate, navDate, todos) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const days = daysInMonth(y, m);
  const firstDay = firstDayOfMonth(y, m);
  const todayDS = DS(todayDate);
  const navDS = DS(navDate);

  let html = `<div class="cal-sid-month">
    <div class="cal-sid-month-title" onclick="window.app.setNavDateAndView(new Date(${y},${m},1),'month')">${state.MONTHS[m]} ${y}</div>
    <div class="cal-sid-grid">`;

  html += state.DAYS.map(d => `<div class="cal-sid-dow">${d[0]}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-sid-day other-month"></div>';
  }

  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const ds = DS(date);
    const isToday = ds === todayDS;
    const isNav = ds === navDS;
    const hasTodos = getTodosForDate(date, todos).filter(t => t.recurrence !== 'daily').length > 0;
    let cls = 'cal-sid-day';
    if (isToday) cls += ' today';
    if (isNav) cls += ' nav-date';
    if (hasTodos) cls += ' has-todos';
    html += `<div class="${cls}" data-date="${ds}" onclick="window.app.setNavDateAndView('${ds}','day')">${d}</div>`;
  }

  html += '</div></div>';
  return html;
}

export function getPeriodLabel() {
  const d = state.navDate;
  if (state.view==='day')   return '';
  if (state.view==='week') {
    return `${state.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (state.view==='month') return `${state.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (state.view==='year')  return `${d.getFullYear()}`;
}

export function getCloudsHTML(date, todos) {
  const suggestions = getSuggestions(todos);
  state.setSuggestions(suggestions);
  const recurring = todos.filter(t => t.recurrence && t.recurrence!=='none');
  if (suggestions.length===0 && recurring.length===0) return '';
  let html = '';
  if (suggestions.length > 0) {
    html += `<div class="clouds-section">
      <span class="cloud-label">${state.T.frequentlyUsed}</span>
      <div class="cloud-chips">${suggestions.map((t,i)=>`<div class="chip" onclick="window.app.openModalWithTitle(window.app.getSuggestion(${i}))">${esc(t)}</div>`).join('')}</div>
    </div>`;
  }
  if (recurring.length > 0) {
    html += `<div class="clouds-section">
      <span class="cloud-label">${state.T.recurringTasks}</span>
      <div class="cloud-chips">${recurring.map(t=>{
        const done = isCompleted(t, date);
        return `<div class="chip rec${done?' done':''}" title="${esc(recLabel(t))}"
          onclick="window.app.openModalWithRecurring('${t.id}')">${esc(t.title)}</div>`;
      }).join('')}</div>
    </div>`;
  }
  return html;
}

export function renderQACloud(todos) {
  const el = document.getElementById('qaCloud');
  if (!el) return; // Quick add panel doesn't exist
  const d = state.quickAddTarget==='today' ? new Date() : state.navDate;
  const html = getCloudsHTML(d, todos);
  if (html) {
    el.innerHTML = `<div class="qa-cloud-title">${state.T.qaTitle}</div>${html}`;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

export function setupTodoItemHoverAnimations() {
  document.querySelectorAll('.todo-item').forEach(item => {
    item.addEventListener('mouseenter', () =>
      gsap.to(item, { y: -3, duration: 0.12, ease: 'power2.out' })
    );
    item.addEventListener('mouseleave', () =>
      gsap.to(item, { y: 0, duration: 0.18, ease: 'power2.inOut' })
    );
  });
}
