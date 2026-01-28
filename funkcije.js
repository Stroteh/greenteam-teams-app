// ============================================
// GLOBALNE SPREMENLJIVKE
// ============================================
let tasks = [];
let events = [];
let projects = [];
let members = [];
let editingTaskId = null;
let editingEventId = null;
let currentUser = null;
let currentDate = new Date();
let isTeamsMode = false;
let firebaseInitialized = false;

const STORAGE_KEY = 'greenteam_app_data_v6';

// ============================================
// NAVIGACIJA - DODAJTE TO FUNKCIJO
// ============================================
function setupNavigation() {
    console.log("📱 Setup navigation...");
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            
            // Odstrani active class od vseh gumbov
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // Dodaj active trenutnemu gumbu
            this.classList.add('active');
            
            // Skrij vse sekcije
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.remove('active');
            });
            
            // Prikaži ciljno sekcijo
            const targetSection = document.getElementById(`${section}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Prikaži/projektni pregled samo za kanban
                const overview = document.getElementById('projectOverviewContainer');
                if (overview) {
                    overview.style.display = section === 'kanban' ? 'block' : 'none';
                }
            }
        });
    });
}

// ============================================
// EVENT LISTENERJI - DODAJTE TUDI TO
// ============================================
function setupEventListeners() {
    console.log("🎮 Setup event listeners...");
    
    // Event listenerji za filtre (če obstajajo)
    const searchInput = document.getElementById('searchTasks');
    const priorityFilter = document.getElementById('filterPriority');
    const assigneeFilter = document.getElementById('filterAssignee');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            if (typeof renderKanban === 'function') renderKanban();
        });
    }
    
    if (priorityFilter) {
        priorityFilter.addEventListener('change', function() {
            if (typeof renderKanban === 'function') renderKanban();
        });
    }
    
    if (assigneeFilter) {
        assigneeFilter.addEventListener('change', function() {
            if (typeof renderKanban === 'function') renderKanban();
        });
    }
    
    // Zapri modal z ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (typeof closeTaskModal === 'function') closeTaskModal();
            if (typeof closeEventModal === 'function') closeEventModal();
            const birthdayModal = document.getElementById('birthdayModal');
            if (birthdayModal) {
                birthdayModal.remove();
            }
        }
    });
    
    // Zapri modal s klikom zunaj
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            if (typeof closeTaskModal === 'function') closeTaskModal();
            if (typeof closeEventModal === 'function') closeEventModal();
            const birthdayModal = document.getElementById('birthdayModal');
            if (birthdayModal) {
                birthdayModal.remove();
            }
        }
    });
}

// ============================================
// INICIALIZACIJA APLIKACIJE - POPRAVLJENO
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 GreenTeam se zagnal...");
    
    // Setup osnovnih event listenerjev
    setupEventListeners();
    setupNavigation();
    
    // Zaženi aplikacijo v demo načinu za začetek
    await initializeAppDemoMode();
});

// Demo način za začetek (brez Teams in Firebase)
async function initializeAppDemoMode() {
    try {
        console.log("🏠 Začenjam v demo načinu...");
        
        // 1. Nastavi demo uporabnika
        currentUser = {
            id: `user_${Date.now()}`,
            name: 'Demo Uporabnik',
            initials: 'DU',
            isTeamsUser: false,
            teamId: 'personal'
        };
        members = [currentUser];
        
        // 2. Posodobi avatar
        updateUserAvatar();
        
        // 3. Poskusi inicializirati Firebase, če je možno
        try {
            if (window.firebaseService && window.firebaseConfig) {
                console.log("🔄 Poskušam inicializirati Firebase...");
                const teamsContext = null; // Ni Teams
                firebaseInitialized = await firebaseService.initialize(teamsContext);
                
                if (firebaseInitialized) {
                    console.log("✅ Firebase uspešno inicializiran");
                    
                    // Nastavi real-time osluškivanje
                    setupFirebaseListeners();
                    
                    // Sinhroniziraj podatke
                    await syncDataWithFirebase();
                } else {
                    console.log("ℹ️ Firebase ni inicializiran, uporabljam localStorage");
                    await loadFromStorage();
                }
            } else {
                console.log("ℹ️ FirebaseService ni na voljo, uporabljam localStorage");
                await loadFromStorage();
            }
        } catch (firebaseError) {
            console.error("⚠️ Firebase napaka:", firebaseError);
            await loadFromStorage();
        }
        
        // 4. Inicializiraj UI
        initializeUI();
        
        // 5. Zaženi periodične preverjanja
        startPeriodicChecks();
        
        console.log("🎉 Aplikacija uspešno zagnana!");
        
    } catch (error) {
        console.error("❌ Napaka pri zagonu aplikacije:", error);
        showNotification("Aplikacija zagnana v demo načinu", 'info');
    }
}

// ============================================
// KOLEDAR FUNKCIJE
// ============================================

let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();

function renderCalendar() {
    console.log("📅 Render koledarja...");
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;
    
    // Posodobi naslov
    const monthNames = ["Januar", "Februar", "Marec", "April", "Maj", "Junij", 
                       "Julij", "Avgust", "September", "Oktober", "November", "December"];
    document.getElementById('calendarTitle').textContent = 
        `${monthNames[calendarCurrentMonth]} ${calendarCurrentYear}`;
    
    // Pripravi dan v mesecu
    const firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1);
    const lastDay = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayIndex = firstDay.getDay();
    
    // Nastavi dneve v tednu
    const dayNames = ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"];
    let calendarHTML = '';
    
    // Dnevi v tednu
    dayNames.forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Prazni prostor pred prvim dnem
    for (let i = 0; i < firstDayIndex; i++) {
        calendarHTML += `<div class="calendar-day other-month"></div>`;
    }
    
    // Dnevi v mesecu
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(calendarCurrentYear, calendarCurrentMonth, day);
        const isToday = day === today.getDate() && 
                       calendarCurrentMonth === currentMonth && 
                       calendarCurrentYear === currentYear;
        
        let dayEvents = events.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate.getDate() === day && 
                   eventDate.getMonth() === calendarCurrentMonth &&
                   eventDate.getFullYear() === calendarCurrentYear;
        }).slice(0, 3);
        
        const moreEvents = events.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate.getDate() === day && 
                   eventDate.getMonth() === calendarCurrentMonth &&
                   eventDate.getFullYear() === calendarCurrentYear;
        }).length - 3;
        
        let dayClass = "calendar-day";
        if (isToday) dayClass += " today";
        if (date.getDay() === 0 || date.getDay() === 6) dayClass += " weekend";
        
        calendarHTML += `
            <div class="${dayClass}" onclick="openDayEvents(${day}, ${calendarCurrentMonth}, ${calendarCurrentYear})">
                <div class="day-number">${day}</div>
                <div class="day-events">
                    ${dayEvents.map(event => {
                        let eventClass = "calendar-event";
                        if (event.type) eventClass += ` event-${event.type}`;
                        else if (event.priority) eventClass += ` event-${event.priority}`;
                        
                        return `<div class="${eventClass}" title="${event.title}">${event.title.substring(0, 15)}${event.title.length > 15 ? '...' : ''}</div>`;
                    }).join('')}
                    ${moreEvents > 0 ? `<div class="more-events">+${moreEvents} več</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Prazni prostor za konec meseca
    const totalCells = 42;
    const usedCells = firstDayIndex + daysInMonth;
    for (let i = usedCells; i < totalCells; i++) {
        calendarHTML += `<div class="calendar-day other-month"></div>`;
    }
    
    calendarGrid.innerHTML = calendarHTML;
}

function changeMonth(delta) {
    calendarCurrentMonth += delta;
    
    if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
    } else if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
    }
    
    renderCalendar();
}

function goToToday() {
    const today = new Date();
    calendarCurrentMonth = today.getMonth();
    calendarCurrentYear = today.getFullYear();
    renderCalendar();
}

function openDayEvents(day, month, year) {
    const date = new Date(year, month, day);
    const dayEvents = events.filter(event => {
        const eventDate = new Date(event.startDate);
        return eventDate.getDate() === day && 
               eventDate.getMonth() === month &&
               eventDate.getFullYear() === year;
    });
    
    if (dayEvents.length > 0) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2><i class="fas fa-calendar-day"></i> Dogodki za ${day}. ${month + 1}. ${year}</h2>
                <div class="event-list-modal">
                    ${dayEvents.map(event => `
                        <div class="event-item">
                            <div class="event-color" style="background: ${getEventColor(event)}"></div>
                            <div class="event-time">${new Date(event.startDate).toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}</div>
                            <div class="event-title">${event.title}</div>
                            <div class="event-actions">
                                <button class="action-btn edit" onclick="editEvent(${event.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete" onclick="deleteEvent(${event.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('dayEventsModal')">Zapri</button>
                    <button class="btn btn-primary" onclick="openEventModal(null, ${day}, ${month}, ${year})">
                        <i class="fas fa-plus"></i> Dodaj dogodek
                    </button>
                </div>
            </div>
        `;
        modal.id = 'dayEventsModal';
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    } else {
        openEventModal(null, day, month, year);
    }
}

function getEventColor(event) {
    switch(event.type) {
        case 'meeting': return 'var(--calendar-meeting)';
        case 'task': return 'var(--calendar-task)';
        case 'holiday': return 'var(--calendar-holiday)';
        case 'birthday': return 'var(--calendar-birthday)';
        default: return 'var(--calendar-event)';
    }
}

// ============================================
// DOGODKI FUNKCIJE
// ============================================

function openEventModal(eventId = null, day = null, month = null, year = null) {
    editingEventId = eventId;
    const modal = document.getElementById('eventModal');
    
    if (eventId) {
        const event = events.find(e => e.id === eventId);
        if (!event) return;
        
        document.getElementById('eventModalTitle').innerHTML = '<i class="fas fa-edit"></i> Uredi dogodek';
        document.getElementById('eventSubmitBtn').textContent = 'Posodobi dogodek';
        
        // Nastavi vrednosti
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventType').value = event.type || 'general';
        
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        document.getElementById('eventStartDate').value = formatDateTimeLocal(startDate);
        document.getElementById('eventEndDate').value = formatDateTimeLocal(endDate);
        document.getElementById('eventProject').value = event.projectId || '';
        document.getElementById('eventReminder').value = event.reminder || 'none';
        
    } else {
        document.getElementById('eventModalTitle').innerHTML = '<i class="fas fa-calendar-plus"></i> Nov dogodek';
        document.getElementById('eventSubmitBtn').textContent = 'Dodaj dogodek';
        document.getElementById('eventForm').reset();
        
        if (day !== null) {
            const date = new Date(year, month, day, 9, 0);
            document.getElementById('eventStartDate').value = formatDateTimeLocal(date);
            
            const endDate = new Date(year, month, day, 10, 0);
            document.getElementById('eventEndDate').value = formatDateTimeLocal(endDate);
        } else {
            const start = new Date();
            start.setHours(start.getHours() + 1, 0, 0, 0);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            
            document.getElementById('eventStartDate').value = formatDateTimeLocal(start);
            document.getElementById('eventEndDate').value = formatDateTimeLocal(end);
        }
    }
    
    modal.style.display = 'flex';
}

function formatDateTimeLocal(date) {
    return date.toISOString().slice(0, 16);
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
    
    if (!title || !startDate || !endDate) {
        showNotification('Izpolnite vsa obvezna polja', 'warning');
        return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        showNotification('Začetni datum mora biti pred končnim', 'warning');
        return;
    }
    
    if (editingEventId) {
        const eventIndex = events.findIndex(e => e.id === editingEventId);
        if (eventIndex !== -1) {
            const project = projects.find(p => p.id == projectId);
            
            const updatedEvent = {
                ...events[eventIndex],
                title,
                description,
                type,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                projectId,
                projectName: project ? project.name : '',
                reminder,
                updatedAt: new Date().toISOString()
            };
            
            events[eventIndex] = updatedEvent;
            
            if (firebaseInitialized && window.firebaseService) {
                await window.firebaseService.saveEvent(updatedEvent);
            } else {
                saveToStorage();
            }
        }
    } else {
        const project = projects.find(p => p.id == projectId);
        
        const newEvent = {
            id: Date.now(),
            title,
            description,
            type,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            projectId,
            projectName: project ? project.name : '',
            reminder,
            createdBy: currentUser,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        events.push(newEvent);
        
        if (firebaseInitialized && window.firebaseService) {
            await window.firebaseService.saveEvent(newEvent);
        } else {
            saveToStorage();
        }
    }
    
    renderCalendar();
    loadUpcomingEvents();
    closeEventModal();
    showNotification(editingEventId ? 'Dogodek posodobljen' : 'Dogodek dodan', 'success');
});

function deleteEvent(eventId) {
    if (!confirm('Ali ste prepričani, da želite izbrisati ta dogodek?')) return;
    
    try {
        if (firebaseInitialized && window.firebaseService) {
            window.firebaseService.deleteEvent(eventId);
        } else {
            events = events.filter(e => e.id !== eventId);
            saveToStorage();
            renderCalendar();
            loadUpcomingEvents();
        }
        
        showNotification('Dogodek izbrisan', 'success');
    } catch (error) {
        console.error("❌ Napaka pri brisanju dogodka:", error);
        showNotification('Napaka pri brisanju dogodka', 'error');
    }
}

function loadUpcomingEvents() {
    const upcomingEvents = document.getElementById('upcomingEvents');
    if (!upcomingEvents) return;
    
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const upcoming = events
        .filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate >= now && eventDate <= nextWeek;
        })
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .slice(0, 10);
    
    if (upcoming.length === 0) {
        upcomingEvents.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-check"></i>
                <p>Ni prihajajočih dogodkov v naslednjih 7 dneh</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    upcoming.forEach(event => {
        const eventDate = new Date(event.startDate);
        const eventColor = getEventColor(event);
        
        html += `
            <div class="event-item">
                <div class="event-color" style="background: ${eventColor}"></div>
                <div class="event-time">
                    ${eventDate.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric' })}<br>
                    ${eventDate.toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}
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
            </div>
        `;
    });
    
    upcomingEvents.innerHTML = html;
}

// ============================================
// PROJEKTI FUNKCIJE
// ============================================

function updateProjectSelectors() {
    console.log("🔄 Posodabljam izbire projektov...");
    
    // Selector za naloge
    const taskProjectSelector = document.getElementById('taskProject');
    if (taskProjectSelector) {
        taskProjectSelector.innerHTML = '<option value="general">Splošno</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            taskProjectSelector.appendChild(option);
        });
    }
    
    // Selector za dogodke
    const eventProjectSelector = document.getElementById('eventProject');
    if (eventProjectSelector) {
        eventProjectSelector.innerHTML = '<option value="">Brez projekta</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            eventProjectSelector.appendChild(option);
        });
    }
}

function renderProjectsList() {
    console.log("📋 Render seznama projektov...");
    const projectsList = document.getElementById('projectsList');
    if (!projectsList) return;
    
    if (projects.length === 0) {
        projectsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-project-diagram"></i>
                <p>Ni projektov</p>
                <small>Dodajte prvi projekt z zgornjim obrazcem</small>
            </div>
        `;
        return;
    }
    
    let html = '<div class="projects-grid">';
    
    projects.forEach(project => {
        const projectTasks = tasks.filter(t => t.projectId == project.id);
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        const completionRate = projectTasks.length > 0 ? 
            Math.round((completedTasks / projectTasks.length) * 100) : 0;
        
        html += `
            <div class="project-card" style="border-left-color: ${project.color || '#00a76d'}">
                <div class="project-card-header">
                    <div class="project-color" style="background: ${project.color || '#00a76d'}"></div>
                    <h3>${project.name}</h3>
                    <div class="project-actions">
                        <button class="action-btn edit" onclick="editProject(${project.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteProject(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="project-stats">
                    <div class="project-stat">
                        <i class="fas fa-tasks"></i>
                        <span>${projectTasks.length} nalog</span>
                    </div>
                    <div class="project-stat">
                        <i class="fas fa-check-circle"></i>
                        <span>${completionRate}% opravljeno</span>
                    </div>
                </div>
                
                <div class="progress-bar" style="margin: 10px 0;">
                    <div class="progress-fill" style="width: ${completionRate}%; background: ${project.color || '#00a76d'}"></div>
                </div>
                
                <div class="project-tasks">
                    <small>Zadnje naloge:</small>
                    ${projectTasks.slice(0, 3).map(task => `
                        <div class="project-task-item ${task.status}">
                            <i class="fas fa-${getTaskIcon(task.status)}"></i>
                            <span>${task.title}</span>
                        </div>
                    `).join('')}
                    ${projectTasks.length > 3 ? `<div class="project-more">+${projectTasks.length - 3} več</div>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    projectsList.innerHTML = html;
}

function getTaskIcon(status) {
    switch(status) {
        case 'todo': return 'clipboard';
        case 'progress': return 'spinner';
        case 'review': return 'search';
        case 'done': return 'check';
        default: return 'question';
    }
}

function addProject() {
    const nameInput = document.getElementById('newProjectName');
    const colorInput = document.getElementById('newProjectColor');
    
    const name = nameInput?.value.trim();
    const color = colorInput?.value;
    
    if (!name) {
        showNotification('Vnesite ime projekta', 'warning');
        return;
    }
    
    const newProject = {
        id: Date.now(),
        name: name,
        color: color,
        createdAt: new Date().toISOString(),
        createdBy: currentUser
    };
    
    projects.push(newProject);
    
    if (firebaseInitialized && window.firebaseService) {
        window.firebaseService.saveProject(newProject);
    } else {
        saveToStorage();
    }
    
    if (nameInput) nameInput.value = '';
    if (colorInput) colorInput.value = '#00a76d';
    
    updateProjectSelectors();
    renderProjectsList();
    updateProjectOverview();
    
    showNotification(`Projekt "${name}" dodan`, 'success');
}

function editProject(projectId) {
    const project = projects.find(p => p.id == projectId);
    if (!project) return;
    
    const newName = prompt('Novo ime projekta:', project.name);
    if (!newName || newName.trim() === '') return;
    
    const newColor = prompt('Nova barva (hex format):', project.color || '#00a76d');
    if (!newColor) return;
    
    project.name = newName.trim();
    project.color = newColor;
    project.updatedAt = new Date().toISOString();
    
    if (firebaseInitialized && window.firebaseService) {
        window.firebaseService.saveProject(project);
    } else {
        saveToStorage();
    }
    
    tasks.forEach(task => {
        if (task.projectId == projectId) {
            task.projectName = newName;
        }
    });
    
    updateProjectSelectors();
    renderProjectsList();
    renderKanban();
    updateProjectOverview();
    
    showNotification('Projekt posodobljen', 'success');
}

function deleteProject(projectId) {
    if (!confirm('Ali ste prepričani, da želite izbrisati ta projekt? Naloge tega projekta bodo premaknjene v Splošno.')) return;
    
    try {
        tasks.forEach(task => {
            if (task.projectId == projectId) {
                task.projectId = 'general';
                task.projectName = 'Splošno';
            }
        });
        
        projects = projects.filter(p => p.id != projectId);
        
        if (firebaseInitialized && window.firebaseService) {
            tasks.filter(t => t.projectId == 'general').forEach(async task => {
                await window.firebaseService.updateTask(task.id, {
                    projectId: 'general',
                    projectName: 'Splošno'
                });
            });
            
            window.firebaseService.deleteProject(projectId);
        } else {
            saveToStorage();
        }
        
        updateProjectSelectors();
        renderProjectsList();
        renderKanban();
        updateProjectOverview();
        
        showNotification('Projekt izbrisan', 'success');
    } catch (error) {
        console.error("❌ Napaka pri brisanju projekta:", error);
        showNotification('Napaka pri brisanju projekta', 'error');
    }
}

// ============================================
// OSNOVNE FUNKCIJE
// ============================================

function setupFirebaseListeners() {
    if (window.firebaseService && window.firebaseService.subscribeToTasks) {
        window.firebaseService.subscribeToTasks((firebaseTasks) => {
            tasks = firebaseTasks;
            renderKanban();
            updateStats();
            updateProjectOverview();
        });
    }
    
    if (window.firebaseService && window.firebaseService.subscribeToEvents) {
        window.firebaseService.subscribeToEvents((firebaseEvents) => {
            events = firebaseEvents;
            renderCalendar();
            loadUpcomingEvents();
        });
    }
    
    if (window.firebaseService && window.firebaseService.subscribeToProjects) {
        window.firebaseService.subscribeToProjects((firebaseProjects) => {
            projects = firebaseProjects;
            updateProjectSelectors();
            renderProjectsList();
            updateProjectOverview();
        });
    }
    
    loadTeamMembersFromFirebase();
}

async function loadTeamMembersFromFirebase() {
    try {
        if (!window.firebaseService || !window.firebaseService.getTeamMembers) {
            return;
        }
        
        const firebaseMembers = await window.firebaseService.getTeamMembers();
        
        if (firebaseMembers.length > 0) {
            members = firebaseMembers;
            console.log("👥 Člani ekipe naloženi iz Firebase:", members.length);
        }
        
        renderMemberSelector();
        updateAssigneeFilter();
        
    } catch (error) {
        console.error("❌ Napaka pri nalaganju članov:", error);
    }
}

async function syncDataWithFirebase() {
    try {
        if (!window.firebaseService || !window.firebaseService.syncWithLocal) {
            await loadFromStorage();
            return;
        }
        
        const syncedData = await window.firebaseService.syncWithLocal(tasks, events, projects);
        
        tasks = syncedData.tasks;
        events = syncedData.events;
        projects = syncedData.projects;
        
        console.log(`🔄 Sinhronizirano: ${tasks.length} nalog, ${events.length} dogodkov, ${projects.length} projektov`);
        
    } catch (error) {
        console.error("❌ Napaka pri sinhronizaciji:", error);
        await loadFromStorage();
    }
}

// ============================================
// INICIALIZACIJA UI
// ============================================
function initializeUI() {
    const overview = document.getElementById('projectOverviewContainer');
    if (overview) overview.style.display = 'block';
    
    updateProjectSelectors();
    renderKanban();
    updateStats();
    updateProjectOverview();
    renderCalendar();
    loadUpcomingEvents();
    renderProjectsList();
    renderMemberSelector();
    updateAssigneeFilter();
    updateLiveClock();
}

function startPeriodicChecks() {
    setInterval(checkBirthdays, 3600000);
    setInterval(updateLiveClock, 1000);
    setInterval(updateProjectOverview, 300000);
    setInterval(checkReminders, 60000);
}

// ============================================
// MANJKAJOČE POMOŽNE FUNKCIJE
// ============================================

function updateAssigneeFilter() {
    const filterAssignee = document.getElementById('filterAssignee');
    if (!filterAssignee) return;
    
    filterAssignee.innerHTML = '<option value="all">Vsi izvajalci</option>' +
                               '<option value="me">Samo moje naloge</option>';
    
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name + (member.id === currentUser?.id ? ' (Jaz)' : '');
        filterAssignee.appendChild(option);
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

function checkReminders() {
    const now = new Date();
    
    events.forEach(event => {
        if (event.reminder && event.reminder !== 'none' && !event.reminderShown) {
            const eventTime = new Date(event.startDate);
            const reminderMinutes = parseInt(event.reminder);
            const reminderTime = new Date(eventTime.getTime() - reminderMinutes * 60 * 1000);
            
            if (now >= reminderTime && now < eventTime) {
                showNotification(`Opomnik: ${event.title} začne ob ${eventTime.toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}`, 'info');
                event.reminderShown = true;
                
                if (firebaseInitialized && window.firebaseService) {
                    window.firebaseService.saveEvent(event);
                } else {
                    saveToStorage();
                }
            }
        }
    });
}

// ============================================
// LOCALSTORAGE FUNKCIJE
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
        console.log('💾 Podatki shranjeni v localStorage');
    } catch (error) {
        console.error('❌ Napaka pri shranjevanju:', error);
    }
}

async function loadFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            tasks = parsed.tasks || [];
            events = parsed.events || [];
            projects = parsed.projects || [];
            members = parsed.members || [];
            currentUser = parsed.currentUser || currentUser;
            
            console.log(`📂 Naloženo iz localStorage: ${tasks.length} nalog, ${events.length} dogodkov, ${projects.length} projektov`);
        } else {
            tasks = [];
            events = [];
            projects = [];
            members = [currentUser];
            
            projects.push({
                id: 1,
                name: 'Demo Projekt',
                color: '#00a76d',
                createdAt: new Date().toISOString(),
                createdBy: currentUser
            });
        }
    } catch (error) {
        console.error('❌ Napaka pri nalaganju:', error);
    }
}

// ============================================
// KANBAN FUNKCIJE
// ============================================

function renderKanban() {
    const kanbanBoard = document.getElementById('kanbanBoard');
    if (!kanbanBoard) return;
    
    const searchTerm = document.getElementById('searchTasks')?.value.toLowerCase() || '';
    const priorityFilter = document.getElementById('filterPriority')?.value || 'all';
    const assigneeFilter = document.getElementById('filterAssignee')?.value || 'all';
    
    const columns = [
        { id: 'todo', title: 'Čaka na začetek', icon: 'clipboard-list', color: 'var(--status-todo)' },
        { id: 'progress', title: 'V teku', icon: 'spinner', color: 'var(--status-progress)' },
        { id: 'review', title: 'V pregledu', icon: 'search', color: 'var(--status-review)' },
        { id: 'done', title: 'Opravljeno', icon: 'check-circle', color: 'var(--status-done)' }
    ];
    
    kanbanBoard.innerHTML = '';
    
    columns.forEach(column => {
        let columnTasks = tasks.filter(task => task.status === column.id);
        
        if (searchTerm) {
            columnTasks = columnTasks.filter(task => 
                task.title.toLowerCase().includes(searchTerm) ||
                task.description.toLowerCase().includes(searchTerm) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );
        }
        
        if (priorityFilter !== 'all') {
            columnTasks = columnTasks.filter(task => task.priority === priorityFilter);
        }
        
        if (assigneeFilter !== 'all') {
            if (assigneeFilter === 'me' && currentUser) {
                columnTasks = columnTasks.filter(task => 
                    task.assigneeIds && task.assigneeIds.includes(currentUser.id.toString())
                );
            } else {
                columnTasks = columnTasks.filter(task => 
                    task.assigneeIds && task.assigneeIds.includes(assigneeFilter)
                );
            }
        }
        
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
                <span class="column-count" style="background: ${column.color};" 
                      id="count${column.id.charAt(0).toUpperCase() + column.id.slice(1)}">
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
    
    const userCanSeeTask = task.assigneeIds && currentUser && 
                          task.assigneeIds.includes(currentUser.id.toString());
    
    if (!userCanSeeTask) {
        div.style.opacity = '0.7';
        div.style.filter = 'grayscale(20%)';
    }
    
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
    
    const assigneeAvatars = (task.assignees || []).slice(0, 3).map((assignee, index) => {
        return `
            <div class="assignee-avatar multiple" title="${assignee.name}">
                ${assignee.initials}
            </div>
        `;
    }).join('');
    
    const moreAssignees = (task.assignees || []).length > 3 
        ? `<div class="assignee-avatar more" title="${task.assigneeNames}">+${(task.assignees || []).length - 3}</div>`
        : '';
    
    div.innerHTML = `
        <div class="task-actions">
            ${userCanSeeTask ? `
                <button class="action-btn edit" onclick="openTaskModal(${task.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            ` : `
                <span class="action-btn view-only" title="Samo za ogled - naloga vam ni dodeljena">
                    <i class="fas fa-eye"></i>
                </span>
            `}
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
                ${assigneeAvatars}${moreAssignees}
                <span class="assignee-count" title="${task.assigneeNames}">
                    ${task.assignees ? task.assignees.length : 1} oseb
                </span>
            </div>
            
            <div class="task-due-date ${isOverdue ? 'overdue' : ''}">
                <i class="far fa-calendar${isOverdue ? '-times' : ''}"></i>
                ${dueDateText}
            </div>
        </div>
        
        ${task.createdBy ? `
            <div class="task-creator">
                <small>Ustvaril: ${task.createdBy.name}</small>
            </div>
        ` : ''}
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
// DRAG & DROP
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
        const task = tasks.find(t => t.id.toString() === taskId);
        if (task && task.status !== newStatus) {
            task.status = newStatus;
            task.updatedAt = new Date().toISOString();
            
            if (firebaseInitialized && window.firebaseService) {
                await window.firebaseService.updateTask(taskId, {
                    status: newStatus,
                    updatedAt: task.updatedAt
                });
            } else {
                saveToStorage();
            }
            
            taskElement.classList.remove('dragging');
            renderKanban();
            updateStats();
            updateProjectOverview();
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
// PROJEKTNI PREGLED
// ============================================
function updateProjectOverview() {
    const container = document.getElementById('projectOverview');
    if (!container) return;
    
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const projectStats = projects.map(project => {
        const projectTasks = tasks.filter(task => task.projectId == project.id);
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        const activeTasks = projectTasks.filter(t => t.status !== 'done').length;
        
        let priorityScore = 0;
        priorityScore += projectTasks.filter(t => t.priority === 'high').length * 3;
        priorityScore += projectTasks.filter(t => t.priority === 'medium').length * 2;
        
        const overdueTasks = projectTasks.filter(t => {
            if (!t.dueDate || t.status === 'done') return false;
            return new Date(t.dueDate) < now;
        });
        priorityScore += overdueTasks.length * 5;
        
        const urgentTasks = projectTasks.filter(t => {
            if (!t.dueDate || t.status === 'done') return false;
            const dueDate = new Date(t.dueDate);
            return dueDate >= now && dueDate <= nextWeek;
        });
        priorityScore += urgentTasks.length * 2;
        
        const completionRate = projectTasks.length > 0 
            ? Math.round((completedTasks / projectTasks.length) * 100) 
            : 0;
        
        return {
            ...project,
            totalTasks: projectTasks.length,
            completedTasks,
            activeTasks,
            completionRate,
            priorityScore,
            overdueTasks: overdueTasks.length,
            urgentTasks: urgentTasks.length,
            highPriorityTasks: projectTasks.filter(t => t.priority === 'high').length,
            mediumPriorityTasks: projectTasks.filter(t => t.priority === 'medium').length
        };
    });
    
    projectStats.sort((a, b) => b.priorityScore - a.priorityScore);
    
    let html = `
        <div class="project-overview-header">
            <h3><i class="fas fa-trophy"></i> Projekti s prioriteto ta teden</h3>
            <small>${now.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small>
        </div>
    `;
    
    if (projectStats.length === 0) {
        html += `
            <div class="empty-state">
                <i class="fas fa-project-diagram"></i>
                <p>Ni aktivnih projektov</p>
                <button class="btn btn-primary" style="margin-top: 10px;" onclick="document.getElementById('projects-section').click()">
                    Dodaj prvi projekt
                </button>
            </div>
        `;
    } else {
        const topProjects = projectStats.slice(0, 3);
        
        topProjects.forEach((project, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            
            html += `
                <div class="project-overview-card" style="border-left-color: ${project.color || '#00a76d'}">
                    <div class="project-overview-title">
                        <span class="project-medal">${medal}</span>
                        <div>
                            <strong>${project.name}</strong>
                            <small>Prioriteta: ${project.priorityScore} točk</small>
                        </div>
                        <div class="project-stats">
                            ${project.overdueTasks > 0 ? `<span class="project-stat overdue" title="Zamujene naloge">${project.overdueTasks} ⏰</span>` : ''}
                            ${project.urgentTasks > 0 ? `<span class="project-stat urgent" title="Nujne naloge">${project.urgentTasks} ⚠️</span>` : ''}
                            ${project.highPriorityTasks > 0 ? `<span class="project-stat high" title="Visoka prioriteta">${project.highPriorityTasks} 🔴</span>` : ''}
                            <span class="project-stat completed" title="Opravljeno">${project.completedTasks} ✅</span>
                        </div>
                    </div>
                    
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.completionRate}%; background: ${project.color || '#00a76d'}"></div>
                    </div>
                    
                    <div class="project-overview-footer">
                        <span><i class="fas fa-check-circle"></i> ${project.completionRate}%</span>
                        <span><i class="fas fa-tasks"></i> ${project.totalTasks} nalog</span>
                        <span><i class="fas fa-user-friends"></i> ${getProjectAssigneeCount(project.id)} ljudi</span>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    
    updateLiveClock();
}

function getProjectAssigneeCount(projectId) {
    const projectTasks = tasks.filter(task => task.projectId == projectId);
    const assigneeSet = new Set();
    
    projectTasks.forEach(task => {
        if (task.assigneeIds) {
            task.assigneeIds.forEach(id => assigneeSet.add(id));
        }
    });
    
    return assigneeSet.size;
}

// ============================================
// ŽIVA URA IN DATUM
// ============================================
function updateLiveClock() {
    const clockElement = document.getElementById('liveClock');
    if (!clockElement) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('sl-SI', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    const dateString = now.toLocaleDateString('sl-SI', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    clockElement.innerHTML = `
        <div class="clock-time">${timeString}</div>
        <div class="clock-date">${dateString}</div>
    `;
}

// ============================================
// ROJSTNI DANI
// ============================================
function checkBirthdays() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0].substring(5);
    
    events.forEach(event => {
        if (event.type === 'birthday' && !event.notifiedThisYear) {
            const eventDate = new Date(event.startDate);
            const eventStr = eventDate.toISOString().split('T')[0].substring(5);
            
            if (eventStr === todayStr) {
                showBirthdayNotification(event);
                event.notifiedThisYear = true;
                
                if (firebaseInitialized && window.firebaseService) {
                    window.firebaseService.saveEvent(event);
                }
            }
        }
    });
}

function showBirthdayNotification(event) {
    const person = event.personName || event.title.replace('🎂 ', '');
    const message = `🎉 Danes ima rojstni dan ${person}!`;
    
    if (Notification.permission === 'granted') {
        new Notification('🎂 Rojstni dan!', {
            body: message,
            icon: 'https://img.icons8.com/color/96/000000/birthday-cake.png',
            requireInteraction: true
        });
    }
    
    showNotification(message, 'birthday');
}

// ============================================
// NOTIFIKACIJE
// ============================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle',
        birthday: 'birthday-cake'
    };
    return icons[type] || 'info-circle';
}

// ============================================
// TEAMS INTEGRACIJA
// ============================================
async function connectToTeams() {
    if (isTeamsMode) {
        showNotification('Že povezano s Microsoft Teams', 'info');
        return;
    }
    
    showNotification('Povezovanje z Microsoft Teams...', 'info');
    
    if (typeof microsoftTeams !== 'undefined') {
        try {
            await teamsIntegration.initialize();
            isTeamsMode = true;
            showNotification('Povezava z Teams uspešna', 'success');
            
            location.reload();
            
        } catch (error) {
            console.error('Teams napaka:', error);
            showNotification('Napaka pri povezavi s Teams', 'error');
        }
    } else {
        showNotification('Teams SDK ni na voljo. Odprite aplikacijo v Microsoft Teams.', 'warning');
    }
}

// ============================================
// UPORABNIŠKI AVATAR
// ============================================
function updateUserAvatar() {
    const avatarCircle = document.getElementById('avatarCircle');
    const avatarInitials = document.getElementById('avatarInitials');
    const userName = document.getElementById('userName');
    const userTeam = document.getElementById('userTeam');
    const avatarContainer = document.getElementById('userAvatarContainer');
    
    if (!currentUser || !avatarCircle) return;
    
    if (avatarContainer) {
        avatarContainer.style.display = 'flex';
    }
    
    if (avatarInitials) {
        avatarInitials.textContent = currentUser.initials;
    }
    
    if (userName) {
        userName.textContent = currentUser.name;
    }
    if (userTeam) {
        userTeam.textContent = currentUser.teamId === 'personal' ? 'Personal' : currentUser.teamName || 'Ekipa';
    }
    
    if (currentUser.isTeamsUser) {
        avatarCircle.classList.add('teams-user');
        avatarCircle.style.background = 'linear-gradient(135deg, var(--teams-purple), var(--teams-purple-light))';
    }
}

// ============================================
// UPRAVLJANJE ČLANOV EKIPE
// ============================================
function renderMemberSelector() {
    const selector = document.getElementById('memberSelector');
    if (!selector) return;
    
    selector.innerHTML = '';
    
    if (currentUser) {
        const currentMember = document.createElement('div');
        currentMember.className = 'member-option';
        currentMember.innerHTML = `
            <input type="checkbox" id="member_${currentUser.id}" class="member-checkbox" checked />
            <label for="member_${currentUser.id}" class="member-label">
                <div class="assignee-avatar current-user">${currentUser.initials}</div>
                <span>${currentUser.name} (Jaz)</span>
                <span class="current-user-badge">Trenutni</span>
            </label>
        `;
        currentMember.classList.add('selected');
        selector.appendChild(currentMember);
        
        currentMember.querySelector('.member-checkbox').addEventListener('change', function() {
            currentMember.classList.toggle('selected', this.checked);
        });
    }
    
    members.filter(m => m.id !== currentUser?.id).forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-option';
        memberDiv.innerHTML = `
            <input type="checkbox" id="member_${member.id}" class="member-checkbox" />
            <label for="member_${member.id}" class="member-label">
                <div class="assignee-avatar">${member.initials}</div>
                <span>${member.name}</span>
                ${member.isTeamsUser ? '<span class="current-user-badge" style="background: var(--teams-purple);">Teams</span>' : ''}
            </label>
        `;
        selector.appendChild(memberDiv);
        
        memberDiv.querySelector('.member-checkbox').addEventListener('change', function() {
            memberDiv.classList.toggle('selected', this.checked);
        });
    });
}

async function addTeamMember() {
    const nameInput = document.getElementById('newMemberName');
    const emailInput = document.getElementById('newMemberEmail');
    
    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    
    if (!name) {
        showNotification('Vnesite ime člana', 'warning');
        return;
    }
    
    try {
        const newMember = {
            name: name,
            email: email,
            initials: name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??'
        };
        
        let addedMember;
        
        if (firebaseInitialized && window.firebaseService) {
            addedMember = await window.firebaseService.addTeamMember(newMember);
        } else {
            addedMember = {
                ...newMember,
                id: `local_${Date.now()}`,
                isManual: true,
                teamId: currentUser.teamId
            };
        }
        
        members.push(addedMember);
        
        renderMemberSelector();
        updateAssigneeFilter();
        
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        
        showNotification(`Član ${name} dodan`, 'success');
        
    } catch (error) {
        console.error("❌ Napaka pri dodajanju člana:", error);
        showNotification('Napaka pri dodajanju člana', 'error');
    }
}

// ============================================
// UPRAVLJANJE NALOG - VEČ IZVAJALCEV
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
        
        setTimeout(() => {
            document.querySelectorAll('#memberSelector .member-checkbox').forEach(checkbox => {
                const memberId = checkbox.id.replace('member_', '');
                const isChecked = task.assigneeIds && task.assigneeIds.includes(memberId) || 
                                 (task.assigneeId && task.assigneeId.toString() === memberId);
                checkbox.checked = isChecked;
                checkbox.parentElement.parentElement.classList.toggle('selected', isChecked);
            });
        }, 100);
        
    } else {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-tasks"></i> Nova naloga';
        document.getElementById('modalSubmitBtn').textContent = 'Dodaj nalogo';
        document.getElementById('taskForm').reset();
        
        setTimeout(() => {
            document.querySelectorAll('#memberSelector .member-checkbox').forEach(checkbox => {
                const memberId = checkbox.id.replace('member_', '');
                const isCurrentUser = memberId === currentUser?.id.toString();
                checkbox.checked = isCurrentUser;
                checkbox.parentElement.parentElement.classList.toggle('selected', isCurrentUser);
            });
        }, 100);
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
    
    const selectedCheckboxes = document.querySelectorAll('#memberSelector .member-checkbox:checked');
    const assigneeIds = Array.from(selectedCheckboxes).map(cb => 
        cb.id.replace('member_', '')
    );
    
    if (assigneeIds.length === 0 && currentUser) {
        assigneeIds.push(currentUser.id.toString());
    }
    
    const assignees = members.filter(m => assigneeIds.includes(m.id.toString()));
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
                assigneeIds,
                assignees,
                assigneeNames: assignees.map(a => a.name).join(', '),
                assigneeInitials: assignees.map(a => a.initials),
                updatedAt: new Date().toISOString()
            };
            
            tasks[taskIndex] = updatedTask;
            
            if (firebaseInitialized && window.firebaseService) {
                await window.firebaseService.saveTask(updatedTask);
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
            assigneeIds,
            assignees,
            assigneeNames: assignees.map(a => a.name).join(', '),
            assigneeInitials: assignees.map(a => a.initials),
            createdBy: currentUser,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        tasks.push(newTask);
        
        if (firebaseInitialized && window.firebaseService) {
            await window.firebaseService.saveTask(newTask);
        } else {
            saveToStorage();
        }
    }
    
    renderKanban();
    updateStats();
    updateProjectOverview();
    closeTaskModal();
    showNotification(editingTaskId ? 'Naloga posodobljena' : 'Naloga dodana', 'success');
});

async function deleteTask(taskId) {
    if (!confirm('Ali ste prepričani, da želite izbrisati to nalogo?')) return;
    
    try {
        if (firebaseInitialized && window.firebaseService) {
            await window.firebaseService.deleteTask(taskId);
        } else {
            tasks = tasks.filter(t => t.id !== taskId);
            saveToStorage();
            renderKanban();
            updateStats();
            updateProjectOverview();
        }
        
        showNotification('Naloga izbrisana', 'success');
    } catch (error) {
        console.error("❌ Napaka pri brisanju naloge:", error);
        showNotification('Napaka pri brisanju naloge', 'error');
    }
}

// ============================================
// ROJSTNI DAN MODAL
// ============================================
function openBirthdayModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'birthdayModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h2><i class="fas fa-birthday-cake"></i> Dodaj Rojstni Dan</h2>
            <form id="birthdayForm">
                <div class="form-group">
                    <label for="birthdayPerson">Ime in priimek *</label>
                    <input type="text" id="birthdayPerson" class="form-control" required 
                           placeholder="Vnesite ime osebe">
                </div>
                <div class="form-group">
                    <label for="birthdayDate">Datum rojstnega dne *</label>
                    <input type="date" id="birthdayDate" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="birthdayNotes">Opombe (izbirno)</label>
                    <textarea id="birthdayNotes" class="form-control" rows="3" 
                              placeholder="Dodatne informacije..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('birthdayModal')">Prekliči</button>
                    <button type="submit" class="btn btn-birthday">Shrani Rojstni Dan</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('birthdayDate').value = today;
    
    document.getElementById('birthdayForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveBirthday();
    });
}

async function saveBirthday() {
    const person = document.getElementById('birthdayPerson').value.trim();
    const date = document.getElementById('birthdayDate').value;
    const notes = document.getElementById('birthdayNotes').value.trim();
    
    if (!person || !date) {
        showNotification('Vnesite vsa obvezna polja', 'warning');
        return;
    }
    
    const birthdayEvent = {
        id: Date.now(),
        title: `🎂 ${person}`,
        description: notes || `Rojstni dan ${person}`,
        type: 'birthday',
        startDate: new Date(date).toISOString(),
        endDate: new Date(date + 'T23:59:59').toISOString(),
        personName: person,
        isRecurring: true,
        recurringType: 'yearly',
        birthdayYear: new Date(date).getFullYear(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (firebaseInitialized && window.firebaseService) {
            await window.firebaseService.saveEvent(birthdayEvent);
        } else {
            events.push(birthdayEvent);
            saveToStorage();
        }
        
        closeModal('birthdayModal');
        showNotification(`Rojstni dan za ${person} shranjen!`, 'success');
        renderCalendar();
        loadUpcomingEvents();
        
    } catch (error) {
        console.error("❌ Napaka pri shranjevanju rojstnega dne:", error);
        showNotification('Napaka pri shranjevanju', 'error');
    }
}
