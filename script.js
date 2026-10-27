document.addEventListener('DOMContentLoaded', () => {

  // --- Firebase 設定情報の組み込み ---
  const firebaseConfig = {
    apiKey: "AIzaSyD-IvWYOTesN28Zr7bZBW0fW-62xxV0OLE",
    authDomain: "sukezyu-ru.firebaseapp.com",
    projectId: "sukezyu-ru",
    storageBucket: "sukezyu-ru.firebasestorage.app",
    messagingSenderId: "931986575164",
    appId: "1:931986575164:web:f87459a6e9f48c4fd09839"
  };

  // Firebase 初期化
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();

  // カテゴリごとのデフォルト件名マップ
  const DEFAULT_CATEGORY_NAMES = {
    school: '授業',
    private: 'プライベート',
    work: 'バイト',
    deadline: '課題'
  };

  // --- グループID（URLパラメータ）の取得 & 自動生成 ---
  const urlParams = new URLSearchParams(window.location.search);
  let groupId = urlParams.get('group');

  if (!groupId) {
    groupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const newUrl = `${window.location.pathname}?group=${groupId}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }

  const today = new Date();
  const currentRealYear = today.getFullYear();
  const currentRealMonth = today.getMonth();
  const currentRealDate = today.getDate();

  // 16色のパレット定義
  const PERSONAL_COLORS = [
    { id: 'red', hex: '#ff3b30' }, { id: 'coral', hex: '#ff6b4a' },
    { id: 'orange', hex: '#ff9500' }, { id: 'amber', hex: '#f7b500' },
    { id: 'green', hex: '#34c759' }, { id: 'teal', hex: '#30b0c7' },
    { id: 'cyan', hex: '#32ade6' }, { id: 'blue', hex: '#007aff' },
    { id: 'indigo', hex: '#5856d6' }, { id: 'purple', hex: '#af52de' },
    { id: 'pink', hex: '#ff2d55' }, { id: 'rose', hex: '#f06292' },
    { id: 'brown', hex: '#a2845e' }, { id: 'mint', hex: '#00c7be' },
    { id: 'olive', hex: '#8e8e93' }, { id: 'dark', hex: '#3a3a3c' }
  ];

  let currentActiveTabUserId = 'all';
  let myUserId = localStorage.getItem('group_calendar_my_id') || null;
  
  let usersData = {};
  let eventsData = {};

  let personalViewMode = 'month';
  let currentViewMode = 'month';

  let displayedYear = currentRealYear;
  let displayedMonth = currentRealMonth;
  let displayedWeekStartDate = getSundayOfCurrentWeek(today);

  let selectedDateObj = null;
  let editingParentId = null;

  // DOM
  const memberTabsContainer = document.getElementById('member-tabs');
  const addMemberBtn = document.getElementById('add-member-btn');
  const viewSwitchGroup = document.getElementById('view-switch-group');
  const viewMonthBtn = document.getElementById('view-month-btn');
  const viewWeekBtn = document.getElementById('view-week-btn');
  
  const yearSelect = document.getElementById('year-select');
  const monthSelect = document.getElementById('month-select');
  const monthView = document.getElementById('month-view');
  const weekView = document.getElementById('week-view');
  const calendarDays = document.getElementById('calendar-days');

  const weekHeaderGrid = document.getElementById('week-header-grid');
  const weekGridContainer = document.getElementById('week-grid-container');

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  const timetableCard = document.getElementById('timetable-card');
  const timetableDateTitle = document.getElementById('timetable-date-title');
  const closeTimetableBtn = document.getElementById('close-timetable-btn');
  const timelineHours = document.getElementById('timeline-hours');

  // モーダルDOM
  const loginModalBackdrop = document.getElementById('login-modal-backdrop');
  const userNameInput = document.getElementById('user-name-input');
  const profileColorGrid = document.getElementById('profile-color-grid');
  const loginSubmitBtn = document.getElementById('login-submit-btn');

  const modalTitle = document.getElementById('modal-title');
  const eventModalBackdrop = document.getElementById('event-modal-backdrop');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const eventForm = document.getElementById('event-form');
  const eventTitleInput = document.getElementById('event-title');

  const titleLabel = document.getElementById('title-label');
  const datetimeLabel = document.getElementById('datetime-label');
  const sectionDuration = document.getElementById('section-duration');
  const repeatSection = document.getElementById('repeat-section');
  const sectionCompleted = document.getElementById('section-completed');
  const completedCheckbox = document.getElementById('completed-checkbox');

  const startYearSelect = document.getElementById('start-year');
  const startMonthSelect = document.getElementById('start-month');
  const startDaySelect = document.getElementById('start-day');
  const startHourSelect = document.getElementById('start-hour');
  const startMinuteSelect = document.getElementById('start-minute');

  const durationDaysSelect = document.getElementById('duration-days');
  const durationHoursSelect = document.getElementById('duration-hours');
  const durationMinutesSelect = document.getElementById('duration-minutes');

  const repeatWeeklyCheckbox = document.getElementById('repeat-weekly-checkbox');
  const repeatOptions = document.getElementById('repeat-options');
  const repeatMonthsSelect = document.getElementById('repeat-months');

  const btnDeleteEvent = document.getElementById('btn-delete-event');

  let selectedProfileColor = PERSONAL_COLORS[0].hex;

  // --- FIREBASE リアルタイムリスナー設定 ---
  function listenToFirebase() {
    db.collection('groups').doc(groupId).collection('users')
      .onSnapshot((snapshot) => {
        usersData = {};
        snapshot.forEach((doc) => {
          usersData[doc.id] = doc.data();
        });
        renderTabs();
        checkUserLogin();
      });

    db.collection('groups').doc(groupId).collection('events')
      .onSnapshot((snapshot) => {
        eventsData = {};
        snapshot.forEach((doc) => {
          const evt = doc.data();
          const dateKey = evt.dateKey;
          if (!eventsData[dateKey]) eventsData[dateKey] = [];
          eventsData[dateKey].push(evt);
        });
        renderView();
        if (selectedDateObj) renderTimelines(selectedDateObj);
      });
  }

  function getSundayOfCurrentWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  }

  function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getJapaneseHolidays(year) {
    const holidays = {};
    const add = (m, d, name) => {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      holidays[`${year}-${mm}-${dd}`] = name;
    };
    const getNthMonday = (m, n) => {
      const firstDay = new Date(year, m - 1, 1).getDay();
      let offset = (1 - firstDay + 7) % 7;
      return 1 + offset + (n - 1) * 7;
    };

    add(1, 1, '元日'); add(2, 11, '建国記念の日'); add(2, 23, '天皇誕生日');
    add(4, 29, '昭和の日'); add(5, 3, '憲法記念日'); add(5, 4, 'みどりの日');
    add(5, 5, 'こどもの日'); add(8, 11, '山の日'); add(11, 3, '文化の日'); add(11, 23, '勤労感謝の日');

    add(1, getNthMonday(1, 2), '成人の日'); add(7, getNthMonday(7, 3), '海の日');
    add(9, getNthMonday(9, 3), '敬老の日'); add(10, getNthMonday(10, 2), 'スポーツの日');

    const vernalEquinox = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    const autumnalEquinox = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    add(3, vernalEquinox, '春分の日'); add(9, autumnalEquinox, '秋分の日');

    Object.keys(holidays).sort().forEach(dateStr => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (dt.getDay() === 0) {
        let subDate = new Date(y, m - 1, d + 1);
        while (holidays[formatDateKey(subDate)]) subDate.setDate(subDate.getDate() + 1);
        holidays[formatDateKey(subDate)] = '振替休日';
      }
    });

    return holidays;
  }

  function initProfileColorPicker() {
    profileColorGrid.innerHTML = '';
    PERSONAL_COLORS.forEach((color, index) => {
      const item = document.createElement('div');
      item.classList.add('profile-color-item');
      item.style.backgroundColor = color.hex;
      if (index === 0) item.classList.add('selected');

      item.addEventListener('click', () => {
        document.querySelectorAll('.profile-color-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedProfileColor = color.hex;
      });

      profileColorGrid.appendChild(item);
    });
  }

  function checkUserLogin() {
    if (!myUserId || !usersData[myUserId]) {
      initProfileColorPicker();
      loginModalBackdrop.classList.remove('hidden');
    } else {
      loginModalBackdrop.classList.add('hidden');
    }
  }

  loginSubmitBtn.addEventListener('click', () => {
    const name = userNameInput.value.trim();
    if (!name) {
      alert('お名前を入力してください。');
      return;
    }

    myUserId = 'user_' + Date.now();
    const newUser = {
      id: myUserId,
      name: name,
      color: selectedProfileColor
    };

    localStorage.setItem('group_calendar_my_id', myUserId);

    db.collection('groups').doc(groupId).collection('users').doc(myUserId).set(newUser)
      .then(() => {
        loginModalBackdrop.classList.add('hidden');
        currentActiveTabUserId = myUserId;
      });
  });

  function removeMember(userId) {
    const targetUser = usersData[userId];
    if (!targetUser) return;

    if (confirm(`${targetUser.name} さんのタブを削除しますか？`)) {
      db.collection('groups').doc(groupId).collection('users').doc(userId).delete();

      db.collection('groups').doc(groupId).collection('events')
        .where('userId', '==', userId).get()
        .then((snapshot) => {
          const batch = db.batch();
          snapshot.forEach((doc) => batch.delete(doc.ref));
          return batch.commit();
        });

      if (currentActiveTabUserId === userId) {
        switchTab('all');
      }
    }
  }

  function renderTabs() {
    memberTabsContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.classList.add('tab-btn');
    if (currentActiveTabUserId === 'all') allBtn.classList.add('active');
    allBtn.innerHTML = `👥 全員`;
    allBtn.addEventListener('click', () => switchTab('all'));
    memberTabsContainer.appendChild(allBtn);

    Object.values(usersData).forEach(u => {
      const btn = document.createElement('button');
      btn.classList.add('tab-btn');
      if (currentActiveTabUserId === u.id) btn.classList.add('active');

      const isMe = u.id === myUserId;
      btn.innerHTML = `
        <span class="tab-color-dot" style="background-color: ${u.color}"></span>
        ${u.name}${isMe ? ' (自分)' : ''}
      `;

      btn.addEventListener('click', () => switchTab(u.id));

      if (!isMe) {
        btn.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          removeMember(u.id);
        });
      }

      memberTabsContainer.appendChild(btn);
    });
  }

  function switchTab(userId) {
    currentActiveTabUserId = userId;

    if (userId === 'all') {
      currentViewMode = 'week';
      viewSwitchGroup.classList.add('hidden');
    } else {
      currentViewMode = personalViewMode;
      viewSwitchGroup.classList.remove('hidden');

      if (currentViewMode === 'month') {
        viewMonthBtn.classList.add('active');
        viewWeekBtn.classList.remove('active');
      } else {
        viewWeekBtn.classList.add('active');
        viewMonthBtn.classList.remove('active');
      }
    }

    renderTabs();
    renderView();
  }

  addMemberBtn.addEventListener('click', () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('グループ共有URLをコピーしました！\nLINEやチャットでメンバーに送信してください。');
    }).catch(() => {
      prompt('以下の共有URLをコピーしてLINEグループ等で送信してください:', shareUrl);
    });
  });

  function deleteEventGroup(parentId) {
    db.collection('groups').doc(groupId).collection('events')
      .where('parentId', '==', parentId).get()
      .then((snapshot) => {
        const batch = db.batch();
        snapshot.forEach((doc) => batch.delete(doc.ref));
        return batch.commit();
      });
  }

  function initSelectOptions() {
    const startYear = currentRealYear - 5;
    const endYear = currentRealYear + 10;
    
    yearSelect.innerHTML = '';
    for (let y = startYear; y <= endYear; y++) yearSelect.appendChild(new Option(`${y}年`, y));

    monthSelect.innerHTML = '';
    for (let m = 0; m < 12; m++) monthSelect.appendChild(new Option(`${m + 1}月`, m));

    startYearSelect.innerHTML = '';
    for (let y = startYear; y <= endYear; y++) startYearSelect.appendChild(new Option(`${y}年`, y));

    startMonthSelect.innerHTML = '';
    for (let m = 1; m <= 12; m++) startMonthSelect.appendChild(new Option(`${m}月`, m));

    startHourSelect.innerHTML = '';
    for (let h = 0; h < 24; h++) startHourSelect.appendChild(new Option(`${h}時`, h));

    startMinuteSelect.innerHTML = '';
    for (let min = 0; min < 60; min += 5) startMinuteSelect.appendChild(new Option(`${String(min).padStart(2, '0')}分`, min));

    durationDaysSelect.innerHTML = '';
    for (let d = 0; d <= 14; d++) durationDaysSelect.appendChild(new Option(d, d));

    durationHoursSelect.innerHTML = '';
    for (let h = 0; h <= 24; h++) durationHoursSelect.appendChild(new Option(h, h));

    durationMinutesSelect.innerHTML = '';
    for (let min = 0; min <= 60; min += 5) durationMinutesSelect.appendChild(new Option(min, min));
  }

  function updateStartDayOptions() {
    const y = parseInt(startYearSelect.value);
    const m = parseInt(startMonthSelect.value);
    const daysInMonth = new Date(y, m, 0).getDate();
    const currentSelectedDay = parseInt(startDaySelect.value) || 1;

    startDaySelect.innerHTML = '';
    for (let d = 1; d <= daysInMonth; d++) startDaySelect.appendChild(new Option(`${d}日`, d));
    startDaySelect.value = Math.min(currentSelectedDay, daysInMonth);
  }

  function renderView() {
    if (currentViewMode === 'month' && currentActiveTabUserId !== 'all') {
      monthView.classList.remove('hidden');
      weekView.classList.add('hidden');
      renderMonthCalendar();
    } else {
      monthView.classList.add('hidden');
      weekView.classList.remove('hidden');
      renderWeekCalendar();
    }
  }

  function getFilteredEvents(dateKey) {
    const rawEvents = eventsData[dateKey] || [];

    if (currentActiveTabUserId === 'all') {
      return rawEvents.filter(e => e.type !== 'deadline');
    } else {
      return rawEvents.filter(e => e.userId === currentActiveTabUserId);
    }
  }

  function renderMonthCalendar() {
    yearSelect.value = displayedYear;
    monthSelect.value = displayedMonth;
    calendarDays.innerHTML = '';

    const holidayCache = getJapaneseHolidays(displayedYear);
    const firstDayIndex = new Date(displayedYear, displayedMonth, 1).getDay();
    const totalDaysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();
    const prevMonthDays = new Date(displayedYear, displayedMonth, 0).getDate();

    const prevYear = displayedMonth === 0 ? displayedYear - 1 : displayedYear;
    const prevMonth = displayedMonth === 0 ? 11 : displayedMonth - 1;

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const cell = createDayCell(new Date(prevYear, prevMonth, prevMonthDays - i), true, holidayCache);
      calendarDays.appendChild(cell);
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const cell = createDayCell(new Date(displayedYear, displayedMonth, d), false, holidayCache);
      calendarDays.appendChild(cell);
    }

    const totalCellsSoFar = firstDayIndex + totalDaysInMonth;
    const nextCellsNeeded = (totalCellsSoFar > 35 ? 42 : 35) - totalCellsSoFar;
    const nextYear = displayedMonth === 11 ? displayedYear + 1 : displayedYear;
    const nextMonth = displayedMonth === 11 ? 0 : displayedMonth + 1;

    for (let d = 1; d <= nextCellsNeeded; d++) {
      const cell = createDayCell(new Date(nextYear, nextMonth, d), true, holidayCache);
      calendarDays.appendChild(cell);
    }
  }

  function createDayCell(dateObj, isOtherMonth, holidayCache) {
    const cell = document.createElement('div');
    cell.classList.add('day-cell');

    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0) cell.classList.add('is-sunday');
    if (dayOfWeek === 6) cell.classList.add('is-saturday');
    if (isOtherMonth) cell.classList.add('other-month');

    const dateKey = formatDateKey(dateObj);
    const holidayName = holidayCache[dateKey];
    if (holidayName) cell.classList.add('is-holiday');

    if (
      dateObj.getFullYear() === currentRealYear &&
      dateObj.getMonth() === currentRealMonth &&
      dateObj.getDate() === currentRealDate
    ) {
      cell.classList.add('is-today');
    }

    if (selectedDateObj && formatDateKey(dateObj) === formatDateKey(selectedDateObj)) {
      cell.classList.add('selected-day');
    }

    const dayNumber = document.createElement('div');
    dayNumber.classList.add('day-number');
    dayNumber.textContent = dateObj.getDate();
    cell.appendChild(dayNumber);

    const contentContainer = document.createElement('div');
    contentContainer.classList.add('cell-content-container');

    const filteredEvents = getFilteredEvents(dateKey);

    if (filteredEvents.length > 0) {
      const displayedParents = new Set();

      filteredEvents.forEach(evt => {
        if (displayedParents.has(evt.parentId)) return;
        displayedParents.add(evt.parentId);

        const item = document.createElement('div');
        item.classList.add('calendar-event-item');

        if (evt.type === 'deadline') {
          item.classList.add('evt-deadline');
          const formattedTime = `${String(evt.startHour).padStart(2, '0')}:${String(evt.startMinute).padStart(2, '0')}`;
          item.textContent = `📌 ${formattedTime} ${evt.title}`;
          if (evt.isCompleted) item.classList.add('is-completed');
        } else {
          item.classList.add(`evt-${evt.color || 'school'}`);
          item.textContent = evt.title;
        }

        if (evt.userId === myUserId) {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(evt.parentId);
          });
        }

        contentContainer.appendChild(item);
      });
    }

    if (holidayName) {
      const holidayLabel = document.createElement('div');
      holidayLabel.classList.add('holiday-label');
      holidayLabel.textContent = holidayName;
      contentContainer.appendChild(holidayLabel);
    }

    cell.appendChild(contentContainer);

    cell.addEventListener('click', () => {
      document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected-day'));
      cell.classList.add('selected-day');
      selectedDateObj = dateObj;
      openTimetable(dateObj);
    });

    cell.addEventListener('dblclick', () => {
      if (currentActiveTabUserId !== 'all' && currentActiveTabUserId !== myUserId) return;
      selectedDateObj = dateObj;
      openAddModal(dateObj);
    });

    return cell;
  }

  function renderWeekCalendar() {
    yearSelect.value = displayedWeekStartDate.getFullYear();
    monthSelect.value = displayedWeekStartDate.getMonth();

    weekHeaderGrid.innerHTML = '<div class="time-corner-cell"></div>';
    weekGridContainer.innerHTML = '';

    const timeCol = document.createElement('div');
    timeCol.classList.add('week-time-col');
    for (let h = 0; h < 24; h++) {
      const timeCell = document.createElement('div');
      timeCell.classList.add('week-time-cell');
      timeCell.textContent = `${String(h).padStart(2, '0')}:00`;
      timeCol.appendChild(timeCell);
    }
    weekGridContainer.appendChild(timeCol);

    const holidayCache = getJapaneseHolidays(displayedWeekStartDate.getFullYear());
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    for (let i = 0; i < 7; i++) {
      const currDate = new Date(displayedWeekStartDate);
      currDate.setDate(currDate.getDate() + i);
      const dateKey = formatDateKey(currDate);
      const holidayName = holidayCache[dateKey];

      const headerCell = document.createElement('div');
      headerCell.classList.add('week-day-header');
      if (currDate.getDay() === 0) headerCell.classList.add('is-sunday');
      if (currDate.getDay() === 6) headerCell.classList.add('is-saturday');
      if (holidayName) headerCell.classList.add('is-holiday');

      if (
        currDate.getFullYear() === currentRealYear &&
        currDate.getMonth() === currentRealMonth &&
        currDate.getDate() === currentRealDate
      ) {
        headerCell.classList.add('is-today');
      }

      headerCell.innerHTML = `
        <span class="week-day-name">${dayNames[i]}</span>
        <span class="week-day-num">${currDate.getDate()}</span>
      `;
      weekHeaderGrid.appendChild(headerCell);

      const dayCol = document.createElement('div');
      dayCol.classList.add('week-day-col');

      for (let h = 0; h < 24; h++) {
        const row = document.createElement('div');
        row.classList.add('week-hour-row');
        row.addEventListener('dblclick', () => {
          if (currentActiveTabUserId !== 'all' && currentActiveTabUserId !== myUserId) return;
          const targetDt = new Date(currDate);
          targetDt.setHours(h, 0, 0, 0);
          openAddModal(targetDt);
        });
        dayCol.appendChild(row);
      }

      const dayEvents = getFilteredEvents(dateKey);

      dayEvents.forEach(evt => {
        const block = document.createElement('div');
        const startTop = (evt.startHour * 48) + ((evt.startMinute / 60) * 48);

        if (currentActiveTabUserId === 'all') {
          const owner = usersData[evt.userId];
          const baseColor = owner ? owner.color : '#007aff';
          const userName = owner ? owner.name : '不明';

          block.classList.add('week-event-block');
          block.style.backgroundColor = `${baseColor}33`;
          block.style.borderLeft = `4px solid ${baseColor}`;
          block.style.color = '#1c1c1e';
          block.style.top = `${startTop}px`;
          const height = Math.max((evt.durationMinutes / 60) * 48, 18);
          block.style.height = `${height}px`;
          block.textContent = `${userName}: ${evt.title}`;

        } else {
          if (evt.type === 'deadline') {
            block.classList.add('week-event-block', 'deadline-pin-block', 'evt-deadline');
            if (evt.isCompleted) block.classList.add('is-completed');
            block.textContent = `📌 ${evt.title}`;
            block.style.top = `${startTop}px`;
          } else {
            block.classList.add('week-event-block', `evt-${evt.color || 'school'}`);
            block.textContent = evt.title;
            const height = Math.max((evt.durationMinutes / 60) * 48, 18);
            block.style.top = `${startTop}px`;
            block.style.height = `${height}px`;
          }
        }

        if (evt.userId === myUserId) {
          block.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(evt.parentId);
          });
        }

        dayCol.appendChild(block);
      });

      weekGridContainer.appendChild(dayCol);
    }
  }

  function openTimetable(dateObj) {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth() + 1;
    const d = dateObj.getDate();
    const dayName = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];

    timetableDateTitle.textContent = `${y}年${m}月${d}日 (${dayName})`;
    timetableCard.classList.remove('hidden');
    renderTimelines(dateObj);
  }

  function renderTimelines(dateObj) {
    timelineHours.innerHTML = '';
    const dateKey = formatDateKey(dateObj);

    for (let h = 0; h < 24; h++) {
      const row = document.createElement('div');
      row.classList.add('time-row');
      const label = document.createElement('div');
      label.classList.add('time-label');
      label.textContent = `${String(h).padStart(2, '0')}:00`;
      row.appendChild(label);

      row.addEventListener('dblclick', () => {
        if (currentActiveTabUserId !== 'all' && currentActiveTabUserId !== myUserId) return;
        const targetDt = new Date(dateObj);
        targetDt.setHours(h, 0, 0, 0);
        openAddModal(targetDt);
      });

      timelineHours.appendChild(row);
    }

    const dayEvents = getFilteredEvents(dateKey);

    dayEvents.forEach(evt => {
      const block = document.createElement('div');
      const startTop = (evt.startHour * 48) + ((evt.startMinute / 60) * 48);

      if (currentActiveTabUserId === 'all') {
        const owner = usersData[evt.userId];
        const baseColor = owner ? owner.color : '#007aff';
        const userName = owner ? owner.name : '不明';

        block.classList.add('event-block');
        block.style.backgroundColor = `${baseColor}33`;
        block.style.borderLeft = `4px solid ${baseColor}`;
        block.style.color = '#1c1c1e';
        block.style.top = `${startTop}px`;
        const height = Math.max((evt.durationMinutes / 60) * 48, 18);
        block.style.height = `${height}px`;
        block.textContent = `${userName}: ${evt.title}`;
      } else {
        if (evt.type === 'deadline') {
          block.classList.add('event-block', 'deadline-pin-block', 'evt-deadline');
          if (evt.isCompleted) block.classList.add('is-completed');
          block.textContent = `📌 締切: ${evt.title}`;
          block.style.top = `${startTop}px`;
        } else {
          block.classList.add('event-block', `evt-${evt.color || 'school'}`);
          block.textContent = evt.title;
          const height = Math.max((evt.durationMinutes / 60) * 48, 18);
          block.style.top = `${startTop}px`;
          block.style.height = `${height}px`;
        }
      }

      if (evt.userId === myUserId) {
        block.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditModal(evt.parentId);
        });
      }

      timelineHours.appendChild(block);
    });
  }

  function updateCategoryUI(selectedCategory) {
    if (selectedCategory === 'deadline') {
      titleLabel.textContent = 'メモ';
      datetimeLabel.textContent = '提出期限（日時）';
      sectionDuration.classList.add('hidden');
      repeatSection.classList.add('hidden');
      if (editingParentId) sectionCompleted.classList.remove('hidden');
    } else {
      titleLabel.textContent = 'メモ';
      datetimeLabel.textContent = '開始日時';
      sectionDuration.classList.remove('hidden');
      if (!editingParentId) repeatSection.classList.remove('hidden');
      sectionCompleted.classList.add('hidden');
    }

    // 新規追加時のみ、カテゴリ切替時にメモ欄へカテゴリ名を自動補完
    if (!editingParentId) {
      eventTitleInput.value = DEFAULT_CATEGORY_NAMES[selectedCategory] || '';
    }
  }

  function openAddModal(targetDate = new Date()) {
    editingParentId = null;
    modalTitle.textContent = 'スケジュールを追加';
    btnDeleteEvent.classList.add('hidden');

    startYearSelect.value = targetDate.getFullYear();
    startMonthSelect.value = targetDate.getMonth() + 1;
    updateStartDayOptions();
    startDaySelect.value = targetDate.getDate();
    startHourSelect.value = targetDate.getHours();
    startMinuteSelect.value = Math.floor(targetDate.getMinutes() / 5) * 5;

    durationDaysSelect.value = 0;
    durationHoursSelect.value = 1;
    durationMinutesSelect.value = 0;

    // デフォルトで「授業」をメモ欄に自動入力
    eventTitleInput.value = '授業';
    const schoolRadio = document.querySelector('input[name="event-color"][value="school"]');
    if (schoolRadio) schoolRadio.checked = true;

    repeatWeeklyCheckbox.checked = false;
    repeatOptions.classList.add('hidden');
    completedCheckbox.checked = false;

    updateCategoryUI('school');
    eventModalBackdrop.classList.remove('hidden');
  }

  function openEditModal(parentId) {
    editingParentId = parentId;
    modalTitle.textContent = 'スケジュールを変更';
    btnDeleteEvent.classList.remove('hidden');

    let targetEvt = null;

    for (const dKey in eventsData) {
      const found = eventsData[dKey].find(e => e.parentId === parentId);
      if (found) {
        targetEvt = found;
        break;
      }
    }

    if (!targetEvt) return;

    const [y, m, d] = targetEvt.dateKey.split('-').map(Number);
    startYearSelect.value = y;
    startMonthSelect.value = m;
    updateStartDayOptions();
    startDaySelect.value = d;
    startHourSelect.value = targetEvt.startHour;
    startMinuteSelect.value = targetEvt.startMinute;

    eventTitleInput.value = targetEvt.title;

    const catValue = targetEvt.type === 'deadline' ? 'deadline' : (targetEvt.color || 'school');
    const colorRadio = document.querySelector(`input[name="event-color"][value="${catValue}"]`);
    if (colorRadio) colorRadio.checked = true;

    updateCategoryUI(catValue);

    if (targetEvt.type === 'event') {
      durationDaysSelect.value = 0;
      durationHoursSelect.value = Math.floor(targetEvt.durationMinutes / 60);
      durationMinutesSelect.value = targetEvt.durationMinutes % 60;
    } else {
      completedCheckbox.checked = !!targetEvt.isCompleted;
    }

    eventModalBackdrop.classList.remove('hidden');
  }

  function closeAddModal() {
    eventModalBackdrop.classList.add('hidden');
  }

  document.querySelectorAll('input[name="event-color"]').forEach(radio => {
    radio.addEventListener('change', (e) => updateCategoryUI(e.target.value));
  });

  repeatWeeklyCheckbox.addEventListener('change', () => {
    if (repeatWeeklyCheckbox.checked) repeatOptions.classList.remove('hidden');
    else repeatOptions.classList.add('hidden');
  });

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedCategory = document.querySelector('input[name="event-color"]:checked').value;
    
    // メモが空欄の場合は選択したカテゴリ名をデフォルト値として保存
    let title = eventTitleInput.value.trim();
    if (!title) {
      title = DEFAULT_CATEGORY_NAMES[selectedCategory] || '予定';
    }

    const sYear = parseInt(startYearSelect.value);
    const sMonth = parseInt(startMonthSelect.value) - 1;
    const sDay = parseInt(startDaySelect.value);
    const sHour = parseInt(startHourSelect.value);
    const sMin = parseInt(startMinuteSelect.value);

    if (editingParentId) {
      deleteEventGroup(editingParentId);
    }

    const batch = db.batch();

    if (selectedCategory === 'deadline') {
      const parentId = editingParentId || (Date.now() + '_' + Math.random().toString(36).substr(2, 4));
      const dateKey = formatDateKey(new Date(sYear, sMonth, sDay));
      const docId = `${parentId}_${dateKey}`;

      const newDeadline = {
        id: docId,
        parentId: parentId,
        userId: myUserId,
        type: 'deadline',
        title: title,
        dateKey: dateKey,
        startHour: sHour,
        startMinute: sMin,
        isCompleted: completedCheckbox.checked
      };

      const docRef = db.collection('groups').doc(groupId).collection('events').doc(docId);
      batch.set(docRef, newDeadline);

    } else {
      const dDays = parseInt(durationDaysSelect.value);
      const dHours = parseInt(durationHoursSelect.value);
      const dMins = parseInt(durationMinutesSelect.value);

      const totalDurationMs = ((dDays * 24 * 60) + (dHours * 60) + dMins) * 60 * 1000;
      if (totalDurationMs <= 0) return;

      const baseStartDate = new Date(sYear, sMonth, sDay, sHour, sMin);
      let repeatWeeksCount = 1;

      if (!editingParentId && repeatWeeklyCheckbox.checked) {
        const months = parseInt(repeatMonthsSelect.value);
        repeatWeeksCount = Math.floor((months * 30) / 7);
      }

      for (let w = 0; w < repeatWeeksCount; w++) {
        const parentId = Date.now() + '_' + w + '_' + Math.random().toString(36).substr(2, 4);
        let currentStart = new Date(baseStartDate.getTime() + (w * 7 * 24 * 60 * 60 * 1000));
        const overallEnd = new Date(currentStart.getTime() + totalDurationMs);

        while (currentStart < overallEnd) {
          const dateKey = formatDateKey(currentStart);
          const dayEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate(), 23, 59, 59, 999);
          const currentSegmentEnd = overallEnd < dayEnd ? overallEnd : new Date(dayEnd.getTime() + 1);

          const segmentDurationMinutes = Math.round((currentSegmentEnd - currentStart) / (1000 * 60));

          if (segmentDurationMinutes > 0) {
            const docId = `${parentId}_${dateKey}`;
            const newEventSegment = {
              id: docId,
              parentId: parentId,
              userId: myUserId,
              type: 'event',
              title: title,
              color: selectedCategory,
              dateKey: dateKey,
              startHour: currentStart.getHours(),
              startMinute: currentStart.getMinutes(),
              durationMinutes: segmentDurationMinutes
            };

            const docRef = db.collection('groups').doc(groupId).collection('events').doc(docId);
            batch.set(docRef, newEventSegment);
          }
          currentStart = currentSegmentEnd;
        }
      }
    }

    batch.commit().then(() => {
      closeAddModal();
    });
  });

  btnDeleteEvent.addEventListener('click', () => {
    if (editingParentId && confirm('削除してもよろしいですか？')) {
      deleteEventGroup(editingParentId);
      closeAddModal();
    }
  });

  closeModalBtn.addEventListener('click', closeAddModal);
  eventModalBackdrop.addEventListener('click', (e) => { if (e.target === eventModalBackdrop) closeAddModal(); });

  startYearSelect.addEventListener('change', updateStartDayOptions);
  startMonthSelect.addEventListener('change', updateStartDayOptions);

  closeTimetableBtn.addEventListener('click', () => {
    timetableCard.classList.add('hidden');
    document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected-day'));
    selectedDateObj = null;
  });

  viewMonthBtn.addEventListener('click', () => {
    if (currentActiveTabUserId === 'all') return;
    personalViewMode = 'month';
    currentViewMode = 'month';
    viewMonthBtn.classList.add('active');
    viewWeekBtn.classList.remove('active');
    renderView();
  });

  viewWeekBtn.addEventListener('click', () => {
    if (currentActiveTabUserId !== 'all') {
      personalViewMode = 'week';
    }
    currentViewMode = 'week';
    viewWeekBtn.classList.add('active');
    viewMonthBtn.classList.remove('active');
    renderView();
  });

  yearSelect.addEventListener('change', () => {
    displayedYear = parseInt(yearSelect.value);
    displayedWeekStartDate = getSundayOfCurrentWeek(new Date(displayedYear, displayedMonth, 1));
    renderView();
  });

  monthSelect.addEventListener('change', () => {
    displayedMonth = parseInt(monthSelect.value);
    displayedWeekStartDate = getSundayOfCurrentWeek(new Date(displayedYear, displayedMonth, 1));
    renderView();
  });

  prevBtn.addEventListener('click', () => {
    if (currentViewMode === 'month') {
      displayedMonth--;
      if (displayedMonth < 0) { displayedMonth = 11; displayedYear--; }
    } else {
      displayedWeekStartDate.setDate(displayedWeekStartDate.getDate() - 7);
      displayedYear = displayedWeekStartDate.getFullYear();
      displayedMonth = displayedWeekStartDate.getMonth();
    }
    renderView();
  });

  nextBtn.addEventListener('click', () => {
    if (currentViewMode === 'month') {
      displayedMonth++;
      if (displayedMonth > 11) { displayedMonth = 0; displayedYear++; }
    } else {
      displayedWeekStartDate.setDate(displayedWeekStartDate.getDate() + 7);
      displayedYear = displayedWeekStartDate.getFullYear();
      displayedMonth = displayedWeekStartDate.getMonth();
    }
    renderView();
  });

  initSelectOptions();
  listenToFirebase();
});