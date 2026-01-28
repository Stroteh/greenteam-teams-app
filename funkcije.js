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
// INICIALIZACIJA APLIKACIJE
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log("🚀 GreenTeam se zagnal...");
    
    // Setup osnovnih event listenerjev
    setupEventListeners();
    setupNavigation();
    
    // Zaženi aplikacijo
    await initializeApp();
});

async function initializeApp() {
    try {
        // 1. Preveri Teams
        const teamsSuccess = await teamsIntegration.initialize();
        isTeamsMode = teamsSuccess;
        
        if (teamsSuccess) {
            console.log("✅ Teams uspešno inicializiran");
            currentUser = teamsIntegration.currentUser;
            members = teamsIntegration.members;
            
            // Posodobi Teams badge
            document.getElementById('teamsBadge').style.display = 'inline-flex';
            document.getElementById('teamsConnectBtn').innerHTML = '<i class="fab fa-microsoft"></i> Povezano s Teams';
            document.getElementById('teamsConnectBtn').disabled = true;
        } else {
            // Standalone način
            console.log("🏠 Standalone način");
            currentUser = {
                id: `user_${Date.now()}`,
                name: 'Trenutni Uporabnik',
                initials: 'TU',
                isTeamsUser: false,
                teamId: 'personal'
            };
            members = [currentUser];
        }
        
        // 2. Posodobi avatar
        updateUserAvatar();
        
        // 3. Inicializiraj Firebase
        const teamsContext = teamsSuccess ? await teamsIntegration.getContextForFirebase() : null;
        firebaseInitialized = await firebaseService.initialize(teamsContext);
        
        if (firebaseInitialized) {
            console.log("✅ Firebase uspešno inicializiran");
            
            // Nastavi real-time osluškivanje
            setupFirebaseListeners();
            
            // Sinhroniziraj podatke
            await syncDataWithFirebase();
            
        } else {
            console.warn("⚠️ Firebase ni inicializiran, uporabljam localStorage");
            await loadFromStorage();
        }
        
        // 4. Inicializiraj UI
        initializeUI();
        
        // 5. Zaženi periodične preverjanja
        startPeriodicChecks();
        
        console.log("🎉 Aplikacija uspešno zagnana!");
        
    } catch (error) {
        console.error("❌ Napaka pri zagonu aplikacije:", error);
        showNotification("Napaka pri zagonu aplikacije", 'error');
    }
}

function setupFirebaseListeners() {
    // Real-time za naloge
    firebaseService.subscribeToTasks((firebaseTasks) => {
        tasks = firebaseTasks;
        renderKanban();
        updateStats();
        updateProjectOverview();
    });
    
    // Real-time za dogodke
    firebaseService.subscribeToEvents((firebaseEvents) => {
        events = firebaseEvents;
        renderCalendar();
        loadUpcomingEvents();
    });
    
    // Real-time za projekte
    firebaseService.subscribeToProjects((firebaseProjects) => {
        projects = firebaseProjects;
        updateProjectSelectors();
        renderProjectsList();
        updateProjectOverview();
    });
    
    // Naloži člane ekipe
    loadTeamMembersFromFirebase();
}

async function syncDataWithFirebase() {
    try {
        const syncedData = await firebaseService.syncWithLocal(tasks, events, projects);
        
        tasks = syncedData.tasks;
        events = syncedData.events;
        projects = syncedData.projects;
        
        console.log(`🔄 Sinhronizirano: ${tasks.length} nalog, ${events.length} dogodkov, ${projects.length} projektov`);
        
    } catch (error) {
        console.error("❌ Napaka pri sinhronizaciji:", error);
        await loadFromStorage();
    }
}

async function loadTeamMembersFromFirebase() {
    try {
        const firebaseMembers = await firebaseService.getTeamMembers();
        
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
// UPORABNIŠKI AVATAR
// ============================================
function updateUserAvatar() {
    const avatarCircle = document.getElementById('avatarCircle');
    const avatarInitials = document.getElementById('avatarInitials');
    const userName = document.getElementById('userName');
    const userTeam = document.getElementById('userTeam');
    const avatarContainer = document.getElementById('userAvatarContainer');
    
    if (!currentUser || !avatarCircle) return;
    
    // Prikaži avatar container
    if (avatarContainer) {
        avatarContainer.style.display = 'flex';
    }
    
    // Nastavi inicialke
    if (avatarInitials) {
        avatarInitials.textContent = currentUser.initials;
    }
    
    // Nastavi ime in ekipo
    if (userName) {
        userName.textContent = currentUser.name;
    }
    if (userTeam) {
        userTeam.textContent = currentUser.teamId === 'personal' ? 'Personal' : currentUser.teamName || 'Ekipa';
    }
    
    // Nastavi barvo za Teams uporabnike
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
    
    // Dodaj trenutnega uporabnika
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
        
        // Event listener
        currentMember.querySelector('.member-checkbox').addEventListener('change', function() {
            currentMember.classList.toggle('selected', this.checked);
        });
    }
    
    // Dodaj ostale člane
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
        
        // Event listener
        memberDiv.querySelector('.member-checkbox').addEventListener('change', function() {
            memberDiv.classList.toggle('selected', this.checked);
        });
    });
}

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
        
        if (firebaseInitialized) {
            addedMember = await firebaseService.addTeamMember(newMember);
        } else {
            addedMember = {
                ...newMember,
                id: `local_${Date.now()}`,
                isManual: true,
                teamId: currentUser.teamId
            };
        }
        
        members.push(addedMember);
        
        // Posodobi UI
        renderMemberSelector();
        updateAssigneeFilter();
        
        // Počisti polja
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
        
        // Nastavi vrednosti
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.dueDate;
        document.getElementById('taskProject').value = task.projectId || 'general';
        document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';
        
        // Označi izvajalce
        setTimeout(() => {
            const assigneeIds = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
            document.querySelectorAll('#memberSelector .member-checkbox').forEach(checkbox => {
                const memberId = checkbox.id.replace('member_', '');
                const isChecked = assigneeIds.includes(memberId) || 
                                 (task.assigneeId && task.assigneeId.toString() === memberId);
                checkbox.checked = isChecked;
                checkbox.parentElement.parentElement.classList.toggle('selected', isChecked);
            });
        }, 100);
        
    } else {
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-tasks"></i> Nova naloga';
        document.getElementById('modalSubmitBtn').textContent = 'Dodaj nalogo';
        document.getElementById('taskForm').reset();
        
        // Privzeto označi trenutnega uporabnika
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
    
    // Pridobi izbrane člane
    const selectedCheckboxes = document.querySelectorAll('#memberSelector .member-checkbox:checked');
    const assigneeIds = Array.from(selectedCheckboxes).map(cb => 
        cb.id.replace('member_', '')
    );
    
    // Če ni izbranih, dodaj trenutnega uporabnika
    if (assigneeIds.length === 0 && currentUser) {
        assigneeIds.push(currentUser.id.toString());
    }
    
    // Pridobi podatke o članih
    const assignees = members.filter(m => assigneeIds.includes(m.id.toString()));
    const project = projects.find(p => p.id == projectId);
    
    if (editingTaskId) {
        // Urejanje obstoječe naloge
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
            
            if (firebaseInitialized) {
                await firebaseService.saveTask(updatedTask);
            } else {
                saveToStorage();
            }
        }
    } else {
        // Nova naloga
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
        
        if (firebaseInitialized) {
            await firebaseService.saveTask(newTask);
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
        if (firebaseInitialized) {
            await firebaseService.deleteTask(taskId);
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
// KANBAN FUNKCIONALNOSTI
// ============================================
function renderKanban() {
    const kanbanBoard = document.getElementById('kanbanBoard');
    if (!kanbanBoard) return;
    
    // Pridobi filtre
    const searchTerm = document.getElementById('searchTasks')?.value.toLowerCase() || '';
    const priorityFilter = document.getElementById('filterPriority')?.value || 'all';
    const assigneeFilter = document.getElementById('filterAssignee')?.value || 'all';
    
    // Stolpci
    const columns = [
        { id: 'todo', title: 'Čaka na začetek', icon: 'clipboard-list', color: 'var(--status-todo)' },
        { id: 'progress', title: 'V teku', icon: 'spinner', color: 'var(--status-progress)' },
        { id: 'review', title: 'V pregledu', icon: 'search', color: 'var(--status-review)' },
        { id: 'done', title: 'Opravljeno', icon: 'check-circle', color: 'var(--status-done)' }
    ];
    
    kanbanBoard.innerHTML = '';
    
    columns.forEach(column => {
        let columnTasks = tasks.filter(task => task.status === column.id);
        
        // Uporabi filtre
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
    
    // Preveri če uporabnik vidi nalogo
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
    
    // Avatarji izvajalcev (max 3)
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
            
            if (firebaseInitialized) {
                await firebaseService.updateTask(taskId, {
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
    
    // Izračunaj statistiko za vsak projekt
    const projectStats = projects.map(project => {
        const projectTasks = tasks.filter(task => task.projectId == project.id);
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        const activeTasks = projectTasks.filter(t => t.status !== 'done').length;
        
        // Izračunaj prioriteto
        let priorityScore = 0;
        
        // Visoka prioriteta
        priorityScore += projectTasks.filter(t => t.priority === 'high').length * 3;
        
        // Srednja prioriteta
        priorityScore += projectTasks.filter(t => t.priority === 'medium').length * 2;
        
        // Zamujene naloge
        const overdueTasks = projectTasks.filter(t => {
            if (!t.dueDate || t.status === 'done') return false;
            return new Date(t.dueDate) < now;
        });
        priorityScore += overdueTasks.length * 5;
        
        // Nujne naloge (naslednjih 7 dni)
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
    
    // Sortiraj po prioriteti
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
    
    // Posodobi uro
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
    
    // Nastavi današnji datum
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('birthdayDate').value = today;
    
    // Event listener
    document.getElementById('birthdayForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveBirthday();
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
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
        if (firebaseInitialized) {
            await firebaseService.saveEvent(birthdayEvent);
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

function checkBirthdays() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0].substring(5); // MM-DD
    
    events.forEach(event => {
        if (event.type === 'birthday' && !event.notifiedThisYear) {
            const eventDate = new Date(event.startDate);
            const eventStr = eventDate.toISOString().split('T')[0].substring(5);
            
            if (eventStr === todayStr) {
                showBirthdayNotification(event);
                event.notifiedThisYear = true;
                
                if (firebaseInitialized) {
                    firebaseService.saveEvent(event);
                }
            }
        }
    });
}

function showBirthdayNotification(event) {
    const person = event.personName || event.title.replace('🎂 ', '');
    const message = `🎉 Danes ima rojstni dan ${person}!`;
    
    // Desktop notification
    if (Notification.permission === 'granted') {
        new Notification('🎂 Rojstni dan!', {
            body: message,
            icon: 'https://img.icons8.com/color/96/000000/birthday-cake.png',
            requireInteraction: true
        });
    }
    
    // Prikaži v aplikaciji
    showNotification(message, 'birthday');
}

// ============================================
// INICIALIZACIJA UI
// ============================================
function initializeUI() {
    // Prikaži projektni pregled
    const overview = document.getElementById('projectOverviewContainer');
    if (overview) overview.style.display = 'block';
    
    // Inicializiraj UI komponente
    updateProjectSelectors();
    renderKanban();
    updateStats();
    updateProjectOverview();
    renderCalendar();
    loadUpcomingEvents();
    renderProjectsList();
    renderMemberSelector();
    updateAssigneeFilter();
}

function startPeriodicChecks() {
    // Preveri rojstne dneve vsako uro
    setInterval(checkBirthdays, 3600000);
    
    // Posodobi uro vsako sekundo
    setInterval(updateLiveClock, 1000);
    
    // Posodobi projektni pregled vsakih 5 minut
    setInterval(updateProjectOverview, 300000);
    
    // Preveri opomnike vsako minuto
    setInterval(checkReminders, 60000);
}

function setupEventListeners() {
    // Event listenerji za filtre
    const searchInput = document.getElementById('searchTasks');
    const priorityFilter = document.getElementById('filterPriority');
    const assigneeFilter = document.getElementById('filterAssignee');
    
    if (searchInput) searchInput.addEventListener('input', renderKanban);
    if (priorityFilter) priorityFilter.addEventListener('change', renderKanban);
    if (assigneeFilter) assigneeFilter.addEventListener('change', renderKanban);
    
    // Zapri modal z ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeTaskModal();
            closeEventModal();
            const birthdayModal = document.getElementById('birthdayModal');
            if (birthdayModal) closeModal('birthdayModal');
        }
    });
    
    // Zapri modal s klikom zunaj
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeTaskModal();
            closeEventModal();
            const birthdayModal = document.getElementById('birthdayModal');
            if (birthdayModal) closeModal('birthdayModal');
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
        }
    } catch (error) {
        console.error('❌ Napaka pri nalaganju:', error);
    }
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
            
            // Ponovno naloži aplikacijo
            location.reload();
            
        } catch (error) {
            console.error('Teams napaka:', error);
            showNotification('Napaka pri povezavi s Teams', 'error');
        }
    } else {
        showNotification('Teams SDK ni na voljo. Odprite aplikacijo v Microsoft Teams.', 'warning');
    }
}
