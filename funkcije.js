// ============================================
// GLOBALNE SPREMENLJIVKE
// ============================================
let tasks = [];
let events = [];
let projects = [];
let members = [];
let editingTaskId = null;
let editingEventId = null;
let currentUser = { id: 1, name: 'Elvir Muhić', initials: 'EM' };
let currentDate = new Date();
let isTeamsMode = false;
let firebaseInitialized = false;  // Dodano za Firebase

const STORAGE_KEY = 'greenteam_app_data_v3';

// ============================================
// INICIALIZACIJA APLIKACIJE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Preveri, če je Teams SDK na voljo
    if (typeof microsoftTeams !== 'undefined') {
        initializeTeamsApp();
    } else {
        initializeStandaloneApp();
    }
});

async function initializeTeamsApp() {
    microsoftTeams.initialize(() => {
        microsoftTeams.getContext(async (context) => {
            console.log('Teams kontekst:', context);
            isTeamsMode = true;
            
            // Posodobi uporabnika iz Teams konteksta
            if (context.userPrincipalName) {
                const name = context.userDisplayName || context.userPrincipalName.split('@')[0];
                const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                
                currentUser = {
                    id: context.userObjectId || Date.now(),
                    name: name,
                    email: context.userPrincipalName,
                    initials: initials || 'TU',
                    teamsId: context.userObjectId,
                    isTeamsUser: true
                };
            }
            
            // INICIALIZIRAJ FIREBASE
            try {
                firebaseInitialized = await firebaseService.initialize(context);
                console.log("✅ Firebase uspešno inicializiran za Teams");
                
                // Uključi real-time osluškivanje za zadatke
                firebaseService.subscribeToTasks((firebaseTasks) => {
                    console.log("🔄 Prejete naloge iz Firebase:", firebaseTasks.length);
                    tasks = firebaseTasks;
                    renderKanban();
                    updateStats();
                });
                
                // Uključi real-time osluškivanje za događaje
                firebaseService.subscribeToEvents((firebaseEvents) => {
                    console.log("🔄 Prejeti dogodki iz Firebase:", firebaseEvents.length);
                    events = firebaseEvents;
                    renderCalendar();
                    loadUpcomingEvents();
                });
                
            } catch (error) {
                console.error("❌ Napaka pri inicializaciji Firebase:", error);
                firebaseInitialized = false;
            }
            
            // Naloži aplikacijo
            await loadAppData();
            
            // Posodobi Teams badge
            document.getElementById('teamsBadge').style.display = 'inline-flex';
            document.getElementById('teamsConnectBtn').innerHTML = '<i class="fab fa-microsoft"></i> Povezano s Teams';
            document.getElementById('teamsConnectBtn').disabled = true;
        });
    });
}

async function initializeStandaloneApp() {
    // Standardna inicializacija brez Teams
    isTeamsMode = false;
    
    // Poskusi inicializirati Firebase brez Teams
    try {
        firebaseInitialized = await firebaseService.initialize();
        console.log("✅ Firebase uspešno inicializiran za standalone");
        
        // Uključi real-time osluškivanje
        firebaseService.subscribeToTasks((firebaseTasks) => {
            tasks = firebaseTasks;
            renderKanban();
            updateStats();
        });
        
        firebaseService.subscribeToEvents((firebaseEvents) => {
            events = firebaseEvents;
            renderCalendar();
            loadUpcomingEvents();
        });
        
    } catch (error) {
        console.error("❌ Firebase ni deloval:", error);
        firebaseInitialized = false;
    }
    
    await loadAppData();
}

async function loadAppData() {
    // Najprej naloži iz localStorage
    loadFromStorage();
    
    // Če je Firebase inicializiran, sinhroniziraj
    if (firebaseInitialized) {
        try {
            const syncedData = await firebaseService.syncWithLocal(tasks, events);
            tasks = syncedData.tasks;
            events = syncedData.events;
            console.log("🔄 Podatki sinhronizirani s Firebase");
        } catch (error) {
            console.error("❌ Napaka pri sinhronizaciji s Firebase:", error);
        }
    }
    
    // Inicializiraj ostale komponente
    initializeMembers();
    initializeProjects();
    setupNavigation();
    renderKanban();
    updateStats();
    setupEventListeners();
    renderCalendar();
    loadUpcomingEvents();
    renderProjectsList();
    checkReminders();
    
    // Nastavi interval za preverjanje opomnikov
    setInterval(checkReminders, 60000);
}

// ============================================
// NAVIGACIJA
// ============================================
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.remove('active');
            });
            document.getElementById(`${section}-section`).classList.add('active');
        });
    });
}

// ============================================
// UPRAVLJANJE ČLANOV EKIPE
// ============================================
function initializeMembers() {
    members = [
        { id: 1, name: 'Elvir Muhić', initials: 'EM' },
        { id: 2, name: 'Maja Novak', initials: 'MN' },
        { id: 3, name: 'Mitja Horvat', initials: 'MH' },
        { id: 4, name: 'Boštjan Kovač', initials: 'BK' },
        { id: 5, name: 'Ana Žagar', initials: 'AŽ' },
        { id: 6, name: 'Marko Prešeren', initials: 'MP' }
    ];
    
    const filterAssignee = document.getElementById('filterAssignee');
    filterAssignee.innerHTML = '<option value="all">Vsi izvajalci</option>';
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        filterAssignee.appendChild(option);
    });
    
    renderMemberSelector();
}

function renderMemberSelector() {
    const selector = document.getElementById('memberSelector');
    selector.innerHTML = '';
    
    members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-option';
        memberDiv.dataset.memberId = member.id;
        memberDiv.innerHTML = `
            <div class="assignee-avatar">${member.initials}</div>
            <span>${member.name}</span>
        `;
        memberDiv.addEventListener('click', function() {
            document.querySelectorAll('#memberSelector .member-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
        selector.appendChild(memberDiv);
    });
}

// ============================================
// UPRAVLJANJE PROJEKTOV
// ============================================
function initializeProjects() {
    if (projects.length === 0) {
        projects = [
            { id: 1, name: 'Karavanke', color: '#00a76d' },
            { id: 2, name: 'Odvodnjevanje DARS', color: '#3498db' },
            { id: 3, name: 'Otiški Vrh – Prevalje', color: '#9b59b6' },
            { id: 4, name: 'Splošno', color: '#95a5a6' }
        ];
    }
    
    updateProjectSelectors();
}

function updateProjectSelectors() {
    const taskProjectSelect = document.getElementById('taskProject');
    taskProjectSelect.innerHTML = '<option value="general">Splošno</option>';
    
    const eventProjectSelect = document.getElementById('eventProject');
    eventProjectSelect.innerHTML = '<option value="">Brez projekta</option>';
    
    projects.forEach(project => {
        const option1 = document.createElement('option');
        option1.value = project.id;
        option1.textContent = project.name;
        taskProjectSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = project.id;
        option2.textContent = project.name;
        eventProjectSelect.appendChild(option2);
    });
}

// ============================================
// TASK MANAGEMENT - POPRAVLJENO ZA FIREBASE
// ============================================
function openTaskModal(taskId = null) {
    editingTaskId = taskId;
    const modal = document.getElementById('taskModal');
    
    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Uredi nalogo';
        document.getElementById('modalSubmitBtn').textContent = 'Posodobi nalogo';
        
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.dueDate;
        document.getElementById('taskProject').value = task.projectId || 'general';
        document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';
        
        document.querySelectorAll('#memberSelector .member-option').forEach(opt => {
            opt.classList.remove('selected');
            if (parseInt(opt.dataset.memberId) === task.assigneeId) {
                opt.classList.add('selected');
            }
        });
    } else {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-tasks"></i> Nova naloga';
        document.getElementById('modalSubmitBtn').textContent = 'Dodaj nalogo';
        document.getElementById('taskForm').reset();
        document.querySelectorAll('#memberSelector .member-option').forEach(opt => {
            opt.classList.remove('selected');
        });
    }
    
    modal.style.display = 'flex';
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
    editingTaskId = null;
}

document.getElementById('taskForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const projectId = document.getElementById('taskProject').value;
    const tags = document.getElementById('taskTags').value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    
    const selectedMember = document.querySelector('#memberSelector .member-option.selected');
    const assigneeId = selectedMember ? parseInt(selectedMember.dataset.memberId) : 1;
    const assignee = members.find(m => m.id === assigneeId);
    const project = projects.find(p => p.id == projectId);
    
    if (editingTaskId) {
        const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
        if (taskIndex !== -1) {
            const updatedTask = {
                ...tasks[taskIndex],
                title,
                description,
                priority,
                dueDate,
                projectId,
                projectName: project ? project.name : 'Splošno',
                tags,
                assigneeId,
                assigneeName: assignee.name,
                assigneeInitials: assignee.initials,
                updatedAt: new Date().toISOString()
            };
            
            tasks[taskIndex] = updatedTask;
            
            // Shrani v Firebase če je inicializiran
            if (firebaseInitialized) {
                try {
                    await firebaseService.saveTask(updatedTask);
                } catch (error) {
                    console.error("❌ Napaka pri shranjevanju v Firebase:", error);
                    saveToStorage();
                }
            } else {
                saveToStorage();
            }
        }
    } else {
        const newTask = {
            id: Date.now(),
            title,
            description: description || 'Ni opisa',
            priority,
            status: 'todo',
            dueDate,
            projectId,
            projectName: project ? project.name : 'Splošno',
            tags,
            assigneeId,
            assigneeName: assignee.name,
            assigneeInitials: assignee.initials,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        tasks.push(newTask);
        
        // Shrani v Firebase če je inicializiran
        if (firebaseInitialized) {
            try {
                await firebaseService.saveTask(newTask);
            } catch (error) {
                console.error("❌ Napaka pri shranjevanju v Firebase:", error);
                saveToStorage();
            }
        } else {
            saveToStorage();
        }
    }
    
    renderKanban();
    updateStats();
    closeTaskModal();
});

async function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (confirm(`Ali ste prepričani, da želite izbrisati nalogo "${task.title}"?`)) {
        tasks = tasks.filter(t => t.id !== taskId);
        
        // Izbriši iz Firebase če je inicializiran
        if (firebaseInitialized) {
            try {
                await firebaseService.deleteTask(taskId);
            } catch (error) {
                console.error("❌ Napaka pri brisanju iz Firebase:", error);
                saveToStorage();
            }
        } else {
            saveToStorage();
        }
        
        renderKanban();
        updateStats();
    }
}

// ============================================
// KANBAN FUNKCIONALNOSTI
// ============================================
function renderKanban() {
    const columns = [
        { id: 'todo', title: 'Čaka na začetek', icon: 'clipboard-list', color: 'var(--status-todo)' },
        { id: 'progress', title: 'V teku', icon: 'spinner', color: 'var(--status-progress)' },
        { id: 'review', title: 'V pregledu', icon: 'search', color: 'var(--status-review)' },
        { id: 'done', title: 'Opravljeno', icon: 'check-circle', color: 'var(--status-done)' }
    ];
    
    const kanbanBoard = document.getElementById('kanbanBoard');
    kanbanBoard.innerHTML = '';
    
    columns.forEach(column => {
        const columnTasks = tasks.filter(task => task.status === column.id);
        const columnElement = createKanbanColumn(column, columnTasks);
        kanbanBoard.appendChild(columnElement);
    });
    
    updateColumnCounts();
}

function createKanbanColumn(column, columnTasks) {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'kanban-column';
    columnDiv.dataset.status = column.id;
    
    columnDiv.innerHTML = `
        <div class="column-header" style="border-bottom-color: ${column.color};">
            <div class="column-title">
                <i class="fas fa-${column.icon}" style="color: ${column.color};"></i>
                ${column.title}
                <span class="column-count" style="background: ${column.color};" id="count${column.id.charAt(0).toUpperCase() + column.id.slice(1)}">
                    ${columnTasks.length}
                </span>
            </div>
        </div>
        <div class="column-content" ondrop="drop(event)" ondragover="allowDrop(event)">
            ${columnTasks.length === 0 ? `
                <div class="empty-column">
                    <i class="fas fa-${getColumnIcon(column.id)}"></i>
                    <p>Ni nalog v tem stolpcu</p>
                </div>
            ` : ''}
        </div>
    `;
    
    const columnContent = columnDiv.querySelector('.column-content');
    
    if (columnTasks.length > 0) {
        columnTasks.forEach(task => {
            const taskElement = createTaskElement(task);
            columnContent.appendChild(taskElement);
        });
    }
    
    return columnDiv;
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-card ${task.priority}`;
    div.dataset.taskId = task.id;
    div.draggable = true;
    div.ondragstart = drag;
    
    const now = new Date();
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < now && task.status !== 'done';
    
    let dueDateText = 'Ni roka';
    if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (dueDate.toDateString() === today.toDateString()) {
            dueDateText = 'Danes';
        } else if (dueDate.toDateString() === tomorrow.toDateString()) {
            dueDateText = 'Jutri';
        } else {
            dueDateText = dueDate.toLocaleDateString('sl-SI', { 
                day: 'numeric', 
                month: 'short' 
            });
        }
    }
    
    const project = projects.find(p => p.id == task.projectId);
    const projectColor = project ? project.color : '#95a5a6';
    
    div.innerHTML = `
        <div class="task-actions">
            <button class="action-btn edit" onclick="openTaskModal(${task.id})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete" onclick="deleteTask(${task.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        
        <div class="task-header">
            <div class="task-title">${task.title}</div>
            <span class="task-priority priority-${task.priority}">
                ${getPriorityText(task.priority)}
            </span>
        </div>
        
        <div class="task-description">
            ${task.description.substring(0, 120)}${task.description.length > 120 ? '...' : ''}
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            ${task.projectName ? `
                <span class="project-badge" style="background: ${projectColor}20; color: ${projectColor};">
                    ${task.projectName}
                </span>
            ` : ''}
            
            ${task.tags && task.tags.length > 0 ? `
                <div class="task-tags">
                    ${task.tags.slice(0, 2).map(tag => `<span class="task-tag">${tag}</span>`).join('')}
                    ${task.tags.length > 2 ? `<span class="task-tag">+${task.tags.length - 2}</span>` : ''}
                </div>
            ` : ''}
        </div>
        
        <div class="task-footer">
            <div class="task-assignee">
                <div class="assignee-avatar">${task.assigneeInitials}</div>
                <span class="assignee-name">${task.assigneeName}</span>
            </div>
            
            <div class="task-due-date ${isOverdue ? 'overdue' : ''}">
                <i class="far fa-calendar${isOverdue ? '-times' : ''}"></i>
                ${dueDateText}
            </div>
        </div>
    `;
    
    return div;
}

function getColumnIcon(status) {
    const icons = {
        todo: 'inbox',
        progress: 'cogs',
        review: 'eye',
        done: 'check'
    };
    return icons[status] || 'question';
}

function getPriorityText(priority) {
    const texts = {
        high: 'VISOKA',
        medium: 'SREDNJA',
        low: 'NIZKA'
    };
    return texts[priority] || priority;
}

function updateColumnCounts() {
    const counts = {
        todo: tasks.filter(t => t.status === 'todo').length,
        progress: tasks.filter(t => t.status === 'progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length
    };
    
    document.getElementById('countTodo').textContent = counts.todo;
    document.getElementById('countProgress').textContent = counts.progress;
    document.getElementById('countReview').textContent = counts.review;
    document.getElementById('countDone').textContent = counts.done;
}

// ============================================
// DRAG & DROP FUNKCIJE - POPRAVLJENO ZA FIREBASE
// ============================================
function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function drag(event) {
    event.dataTransfer.setData("text", event.target.dataset.taskId);
    event.target.classList.add('dragging');
}

async function drop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const taskId = event.dataTransfer.getData("text");
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    const newStatus = event.currentTarget.closest('.kanban-column').dataset.status;
    
    if (taskElement) {
        const task = tasks.find(t => t.id === parseInt(taskId));
        if (task && task.status !== newStatus) {
            task.status = newStatus;
            task.updatedAt = new Date().toISOString();
            
            // Ažuriraj v Firebase
            if (firebaseInitialized) {
                try {
                    await firebaseService.updateTask(taskId, {
                        status: newStatus,
                        updatedAt: task.updatedAt
                    });
                } catch (error) {
                    console.error("❌ Napaka pri ažuriranju statusa:", error);
                    saveToStorage();
                }
            } else {
                saveToStorage();
            }
            
            taskElement.classList.remove('dragging');
            renderKanban();
            updateStats();
        }
    }
}

// ============================================
// STATISTIKE
// ============================================
function updateStats() {
    const now = new Date();
    
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.status === 'done').length;
    document.getElementById('overdueTasks').textContent = tasks.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        return new Date(t.dueDate) < now;
    }).length;
    document.getElementById('inProgressTasks').textContent = tasks.filter(t => 
        t.status === 'progress' || t.status === 'review'
    ).length;
}

// ============================================
// KOLEDAR FUNKCIONALNOSTI
// ============================================
function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    const monthNames = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 
                       'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];
    document.getElementById('calendarTitle').textContent = 
        `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    const dayNames = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtak', 'Petek', 'Sobota', 'Nedelja'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    for (let i = 0; i < startDay; i++) {
        const prevDate = new Date(firstDay);
        prevDate.setDate(prevDate.getDate() - (startDay - i));
        const dayCell = createDayCell(prevDate, true);
        calendarGrid.appendChild(dayCell);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const isToday = currentDay.toDateString() === today.toDateString();
        const dayCell = createDayCell(currentDay, false, isToday);
        calendarGrid.appendChild(dayCell);
    }
    
    const totalCells = 42;
    const usedCells = startDay + lastDay.getDate();
    const remainingCells = totalCells - usedCells;
    
    for (let i = 1; i <= remainingCells; i++) {
        const nextDate = new Date(lastDay);
        nextDate.setDate(nextDate.getDate() + i);
        const dayCell = createDayCell(nextDate, true);
        calendarGrid.appendChild(dayCell);
    }
}

function createDayCell(date, isOtherMonth, isToday = false) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    if (isOtherMonth) dayCell.classList.add('other-month');
    if (isToday) dayCell.classList.add('today');
    
    dayCell.dataset.date = date.toISOString().split('T')[0];
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();
    dayCell.appendChild(dayNumber);
    
    const dayEvents = getEventsForDate(date);
    
    if (dayEvents.length > 0) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events';
        
        const eventsToShow = dayEvents.slice(0, 3);
        eventsToShow.forEach(event => {
            const eventEl = document.createElement('div');
            eventEl.className = `calendar-event event-${event.type}`;
            eventEl.title = event.title;
            eventEl.textContent = event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title;
            eventsContainer.appendChild(eventEl);
        });
        
        if (dayEvents.length > 3) {
            const moreEl = document.createElement('div');
            moreEl.className = 'more-events';
            moreEl.textContent = `+ ${dayEvents.length - 3} več`;
            eventsContainer.appendChild(moreEl);
        }
        
        dayCell.appendChild(eventsContainer);
    }
    
    dayCell.addEventListener('click', function() {
        const clickedDate = new Date(this.dataset.date);
        openEventModalForDate(clickedDate);
    });
    
    return dayCell;
}

function getEventsForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
        const eventStartDate = new Date(event.startDate).toISOString().split('T')[0];
        return eventStartDate === dateStr;
    });
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
}

function loadUpcomingEvents() {
    const container = document.getElementById('upcomingEvents');
    container.innerHTML = '';
    
    const now = new Date();
    const upcoming = events
        .filter(event => new Date(event.startDate) > now)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .slice(0, 10);
    
    if (upcoming.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-sub); padding: 20px;">Ni prihajajočih dogodkov</p>';
        return;
    }
    
    upcoming.forEach(event => {
        const eventDate = new Date(event.startDate);
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item';
        
        const project = event.projectId ? projects.find(p => p.id == event.projectId) : null;
        const projectColor = project ? project.color : getEventColor(event.type);
        
        eventDiv.innerHTML = `
            <div class="event-color" style="background: ${projectColor};"></div>
            <div class="event-time">
                ${eventDate.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="event-title">${event.title}</div>
            <div class="event-actions">
                <button class="action-btn edit" onclick="openEventModal(${event.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" onclick="deleteEvent(${event.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(eventDiv);
    });
}

function getEventColor(type) {
    const colors = {
        meeting: '#f39c12',
        task: '#9b59b6',
        holiday: '#e74c3c',
        general: '#3498db'
    };
    return colors[type] || '#3498db';
}

// ============================================
// UPRAVLJANJE DOGODKOV - POPRAVLJENO ZA FIREBASE
// ============================================
function openEventModal(eventId = null) {
    editingEventId = eventId;
    const modal = document.getElementById('eventModal');
    
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60000);
    const endDate = new Date(startDate.getTime() + 60 * 60000);
    
    document.getElementById('eventStartDate').value = formatDateTimeLocal(startDate);
    document.getElementById('eventEndDate').value = formatDateTimeLocal(endDate);
    
    if (eventId) {
        const event = events.find(e => e.id === eventId);
        if (!event) return;
        
        document.getElementById('eventModalTitle').innerHTML = '<i class="fas fa-edit"></i> Uredi dogodek';
        document.getElementById('eventSubmitBtn').textContent = 'Posodobi dogodek';
        
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDescription').value = event.description;
        document.getElementById('eventType').value = event.type;
        document.getElementById('eventStartDate').value = formatDateTimeLocal(new Date(event.startDate));
        document.getElementById('eventEndDate').value = formatDateTimeLocal(new Date(event.endDate));
        document.getElementById('eventProject').value = event.projectId || '';
        document.getElementById('eventReminder').value = event.reminder || 'none';
    } else {
        document.getElementById('eventModalTitle').innerHTML = '<i class="fas fa-calendar-plus"></i> Nov dogodek';
        document.getElementById('eventSubmitBtn').textContent = 'Dodaj dogodek';
        document.getElementById('eventForm').reset();
    }
    
    modal.style.display = 'flex';
}

function openEventModalForDate(date) {
    openEventModal();
    date.setHours(9, 0, 0);
    const endDate = new Date(date.getTime() + 60 * 60000);
    document.getElementById('eventStartDate').value = formatDateTimeLocal(date);
    document.getElementById('eventEndDate').value = formatDateTimeLocal(endDate);
}

function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
    editingEventId = null;
}

document.getElementById('eventForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const type = document.getElementById('eventType').value;
    const startDate = document.getElementById('eventStartDate').value;
    const endDate = document.getElementById('eventEndDate').value;
    const projectId = document.getElementById('eventProject').value;
    const reminder = document.getElementById('eventReminder').value;
    
    if (editingEventId) {
        const eventIndex = events.findIndex(e => e.id === editingEventId);
        if (eventIndex !== -1) {
            const updatedEvent = {
                ...events[eventIndex],
                title,
                description,
                type,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                projectId: projectId || null,
                reminder: reminder !== 'none' ? reminder : null,
                updatedAt: new Date().toISOString()
            };
            
            events[eventIndex] = updatedEvent;
            
            // Shrani v Firebase
            if (firebaseInitialized) {
                try {
                    await firebaseService.saveEvent(updatedEvent);
                } catch (error) {
                    console.error("❌ Napaka pri shranjevanju dogodka:", error);
                    saveToStorage();
                }
            } else {
                saveToStorage();
            }
        }
    } else {
        const newEvent = {
            id: Date.now(),
            title,
            description,
            type,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            projectId: projectId || null,
            reminder: reminder !== 'none' ? reminder : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        events.push(newEvent);
        
        // Shrani v Firebase
        if (firebaseInitialized) {
            try {
                await firebaseService.saveEvent(newEvent);
            } catch (error) {
                console.error("❌ Napaka pri shranjevanju dogodka:", error);
                saveToStorage();
            }
        } else {
            saveToStorage();
        }
    }
    
    renderCalendar();
    loadUpcomingEvents();
    closeEventModal();
});

async function deleteEvent(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    if (confirm(`Ali ste prepričani, da želite izbrisati dogodek "${event.title}"?`)) {
        events = events.filter(e => e.id !== eventId);
        
        // Izbriši iz Firebase
        if (firebaseInitialized) {
            try {
                await firebaseService.deleteEvent(eventId);
            } catch (error) {
                console.error("❌ Napaka pri brisanju dogodka:", error);
                saveToStorage();
            }
        } else {
            saveToStorage();
        }
        
        renderCalendar();
        loadUpcomingEvents();
    }
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ============================================
// UPRAVLJANJE PROJEKTOV
// ============================================
function renderProjectsList() {
    const container = document.getElementById('projectsList');
    container.innerHTML = '';
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-sub);">Ni projektov</p>';
        return;
    }
    
    projects.forEach(project => {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'event-item';
        projectDiv.style.padding = '20px';
        
        const projectTasks = tasks.filter(t => t.projectId == project.id).length;
        const projectEvents = events.filter(e => e.projectId == project.id).length;
        
        projectDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="event-color" style="background: ${project.color}; width: 20px; height: 20px;"></div>
                    <div>
                        <div style="font-weight: 600; font-size: 1.1rem;">${project.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-sub);">
                            ${projectTasks} nalog, ${projectEvents} dogodkov
                        </div>
                    </div>
                </div>
                <div class="event-actions">
                    ${project.id > 4 ? `
                        <button class="action-btn edit" onclick="editProject(${project.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteProject(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <span style="font-size: 0.8rem; color: var(--text-sub); padding: 0 10px;">Sistemski</span>
                    `}
                </div>
            </div>
        `;
        container.appendChild(projectDiv);
    });
}

function addProject() {
    const name = document.getElementById('newProjectName').value.trim();
    const color = document.getElementById('newProjectColor').value;
    
    if (!name) {
        alert('Prosimo, vnesite ime projekta!');
        return;
    }
    
    if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('Projekt s tem imenom že obstaja!');
        return;
    }
    
    const newProject = {
        id: Date.now(),
        name,
        color
    };
    
    projects.push(newProject);
    saveToStorage();
    updateProjectSelectors();
    renderProjectsList();
    
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectColor').value = '#00a76d';
}

function editProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const newName = prompt('Vnesite novo ime projekta:', project.name);
    if (newName && newName.trim()) {
        const newColor = prompt('Vnesite novo barvo projekta (hex):', project.color);
        if (newColor) {
            project.name = newName.trim();
            project.color = newColor;
            
            tasks.forEach(task => {
                if (task.projectId == projectId) {
                    task.projectName = project.name;
                }
            });
            
            saveToStorage();
            updateProjectSelectors();
            renderProjectsList();
            renderKanban();
        }
    }
}

function deleteProject(projectId) {
    const projectTasks = tasks.filter(t => t.projectId == projectId);
    const projectEvents = events.filter(e => e.projectId == projectId);
    
    if (projectTasks.length > 0 || projectEvents.length > 0) {
        if (!confirm(`Projekt je v uporabi (${projectTasks.length} nalog, ${projectEvents.length} dogodkov). Ali ste prepričani, da ga želite izbrisati? Vse naloge in dogodki bodo premaknjeni v Splošno.`)) {
            return;
        }
        
        tasks.forEach(task => {
            if (task.projectId == projectId) {
                task.projectId = 4;
                task.projectName = 'Splošno';
            }
        });
        
        events.forEach(event => {
            if (event.projectId == projectId) {
                event.projectId = null;
            }
        });
    }
    
    projects = projects.filter(p => p.id !== projectId);
    saveToStorage();
    updateProjectSelectors();
    renderProjectsList();
    renderKanban();
}

// ============================================
// TEAMS INTEGRACIJA
// ============================================
function connectToTeams() {
    if (isTeamsMode) {
        showNotification('Že povezano s Microsoft Teams', 'info');
        return;
    }
    
    showNotification('Povezovanje z Microsoft Teams...', 'info');
    
    if (typeof microsoftTeams !== 'undefined') {
        microsoftTeams.authentication.authenticate({
            url: window.location.origin,
            width: 600,
            height: 535,
            successCallback: function(result) {
                console.log('Teams avtentikacija uspešna:', result);
                showNotification('Uspešno povezano z Microsoft Teams', 'success');
                document.getElementById('teamsBadge').style.display = 'inline-flex';
                document.getElementById('teamsConnectBtn').innerHTML = '<i class="fab fa-microsoft"></i> Povezano s Teams';
                document.getElementById('teamsConnectBtn').disabled = true;
                isTeamsMode = true;
                
                // Ponovno naloži podatke za Teams način
                initializeTeamsApp();
            },
            failureCallback: function(reason) {
                console.error('Teams avtentikacija neuspešna:', reason);
                showNotification('Napaka pri povezovanju s Teams', 'warning');
            }
        });
    } else {
        showNotification('Microsoft Teams ni na voljo. Namestite Teams SDK ali odprite aplikacijo v Teams.', 'warning');
    }
}

// ============================================
// OPMINIKI IN OBOŠČANJA
// ============================================
function checkReminders() {
    const now = new Date();
    
    events.forEach(event => {
        if (event.reminder && !event.reminderShown) {
            const eventTime = new Date(event.startDate);
            const reminderMinutes = parseInt(event.reminder);
            const reminderTime = new Date(eventTime.getTime() - reminderMinutes * 60000);
            
            if (now >= reminderTime && now < eventTime) {
                showReminder(event);
                event.reminderShown = true;
            }
        }
    });
    
    tasks.forEach(task => {
        if (task.dueDate && task.status !== 'done' && !task.overdueNotified) {
            const dueDate = new Date(task.dueDate);
            if (now > dueDate) {
                showNotification(`Naloga "${task.title}" je zamujena!`, 'warning');
                task.overdueNotified = true;
            }
        }
    });
    
    saveToStorage();
}

function showReminder(event) {
    const eventTime = new Date(event.startDate);
    const timeStr = eventTime.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
    
    if (Notification.permission === 'granted') {
        new Notification(`Opomnik: ${event.title}`, {
            body: `Dogodek se začne ob ${timeStr}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/2098/2098641.png'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(`Opomnik: ${event.title}`, {
                    body: `Dogodek se začne ob ${timeStr}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2098/2098641.png'
                });
            }
        });
    }
    
    showNotification(`Opomnik: ${event.title} se začne ob ${timeStr}`, 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 9999;
        border-left: 4px solid ${type === 'warning' ? '#f39c12' : type === 'success' ? '#2ecc71' : '#3498db'};
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}" 
           style="color: ${type === 'warning' ? '#f39c12' : type === 'success' ? '#2ecc71' : '#3498db'};"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; margin-left: 10px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Filtri za kanban
    document.getElementById('searchTasks').addEventListener('input', renderKanban);
    document.getElementById('filterPriority').addEventListener('change', renderKanban);
    document.getElementById('filterAssignee').addEventListener('change', renderKanban);
    
    // Zapri modal z ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeTaskModal();
            closeEventModal();
        }
    });
    
    // Zapri modal s klikom zunaj
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeTaskModal();
            closeEventModal();
        }
    });
    
    // Zahtevaj dovoljenje za obvestila
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            if (confirm('Želite omogočiti obvestila za opomnike?')) {
                Notification.requestPermission();
            }
        }, 2000);
    }
}

// ============================================
// SHRANJEVANJE IN NALAGANJE PODATKOV
// ============================================
function saveToStorage() {
    try {
        const data = {
            tasks,
            events,
            projects,
            members,
            currentUser,
            lastSave: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('✅ Podatki shranjeni v localStorage');
    } catch (e) {
        console.error('❌ Napaka pri shranjevanju:', e);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            tasks = parsed.tasks || [];
            events = parsed.events || [];
            projects = parsed.projects || [];
            members = parsed.members || [];
            currentUser = parsed.currentUser || { id: 1, name: 'Elvir Muhić', initials: 'EM' };
            
            console.log(`📊 Naloženih ${tasks.length} nalog, ${events.length} dogodkov, ${projects.length} projektov`);
        } else {
            loadSampleData();
        }
    } catch (e) {
        console.error('❌ Napaka pri branju podatkov:', e);
        loadSampleData();
    }
}

function loadSampleData() {
    tasks = [
        {
            id: 1,
            title: 'Priprava PID za Karavanke',
            description: 'Priprava predhodnega informativnega dokumenta za predor Karavanke.',
            priority: 'high',
            status: 'progress',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            projectId: 1,
            projectName: 'Karavanke',
            tags: ['PID', 'predor', 'dokumentacija'],
            assigneeId: 1,
            assigneeName: 'Elvir Muhić',
            assigneeInitials: 'EM',
            createdAt: '2024-04-15T08:00:00Z',
            updatedAt: '2024-05-20T10:30:00Z'
        }
    ];
    
    events = [
        {
            id: 1,
            title: 'Sestanek ekipe',
            description: 'Mesečni sestanek GreenTeam ekipe',
            type: 'meeting',
            startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60000).toISOString(),
            projectId: 4,
            reminder: '30',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    
    saveToStorage();
    console.log('📋 Naloženi vzorčni podatki');
}
