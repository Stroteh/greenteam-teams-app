// firebase-service.js - Nadgrajena različica za več izvajalcev

class FirebaseService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.currentTeamId = null;
        this.currentUserId = null;
        console.log(" FirebaseService kreiran");
    }

    async initialize(teamsContext = null) {
        console.log(" FirebaseService se pokreće...");
        
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.firestore();
            
            // Nastavi Firestore nastavitve za boljšo offline podporo
            firebase.firestore().enablePersistence()// firebase-service.js - Firebase storitev za GreenTeam

class FirebaseService {
    constructor() {
        this.db = null;
        this.auth = null;
        this.isInitialized = false;
        this.currentTeamId = null;
        this.currentUserId = null;
        this.unsubscribeTasks = null;
        this.unsubscribeEvents = null;
        this.unsubscribeProjects = null;
        console.log(" FirebaseService ustvarjen");
    }

    // Inicializacija Firebase
    async initialize(teamsContext = null) {
        try {
            console.log(" FirebaseService se inicializira...");
            
            // Preveri, če Firebase že obstaja
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
            }
            
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Omogoči offline podporo
            await firebase.firestore().enablePersistence({
                synchronizeTabs: true
            }).catch(err => {
                console.log(" Offline podpora ni na voljo:", err.message);
            });
            
            // Nastavi trenutnega uporabnika
            if (teamsContext && teamsContext.user) {
                this.currentUserId = teamsContext.user.id || `teams_${Date.now()}`;
                this.currentTeamId = teamsContext.team?.id || 'personal';
                
                console.log(` Teams način: ${this.currentTeamId !== 'personal' ? 'Team' : 'Personal'}`);
                
                // Shrani Teams uporabnika v Firestore
                await this.saveTeamsUser(teamsContext.user, this.currentTeamId);
                
            } else {
                // Standalone način - anonimna prijava
                this.currentTeamId = 'personal';
                await this.signInAnonymously();
            }
            
            this.isInitialized = true;
            console.log(" FirebaseService inicializiran!");
            
            // Prikaži Firebase badge
            const badge = document.getElementById('firebaseBadge');
            if (badge) {
                badge.style.display = 'inline-flex';
                badge.title = 'Podatki se sinhronizirajo v realnem času';
            }
            
            return true;
            
        } catch (error) {
            console.error(" Napaka pri inicializaciji Firebase:", error);
            return false;
        }
    }

    // Anonimna prijava
    async signInAnonymously() {
        try {
            const authResult = await this.auth.signInAnonymously();
            this.currentUserId = authResult.user.uid;
            console.log(" Anonimni uporabnik prijavljen:", this.currentUserId);
            return true;
        } catch (error) {
            console.error(" Napaka pri anonimni prijavi:", error);
            // Fallback
            this.currentUserId = `anon_${Date.now()}`;
            return true;
        }
    }

    // Shrani Teams uporabnika
    async saveTeamsUser(user, teamId) {
        try {
            const userData = {
                id: user.id,
                name: user.name || user.displayName || 'Teams Uporabnik',
                email: user.email || user.userPrincipalName || '',
                initials: this.getInitials(user.name || user.displayName || 'TU'),
                isTeamsUser: true,
                photoUrl: user.photoUrl,
                teamId: teamId,
                lastLogin: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
            
            await this.db.collection('teams_users').doc(user.id).set(userData, { merge: true });
            console.log(" Teams uporabnik shranjen v Firestore");
            return true;
        } catch (error) {
            console.error(" Napaka pri shranjevanju Teams uporabnika:", error);
            return false;
        }
    }

    getInitials(name) {
        return name.split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) || 'TU';
    }

    // ============================================
    // DOHVAČANJE KOLEKCIJ
    // ============================================
    
    getTasksCollection() {
        if (this.currentTeamId && this.currentTeamId !== 'personal') {
            return this.db.collection('teams').doc(this.currentTeamId).collection('tasks');
        } else {
            return this.db.collection('users').doc(this.currentUserId).collection('tasks');
        }
    }

    getEventsCollection() {
        if (this.currentTeamId && this.currentTeamId !== 'personal') {
            return this.db.collection('teams').doc(this.currentTeamId).collection('events');
        } else {
            return this.db.collection('users').doc(this.currentUserId).collection('events');
        }
    }

    getProjectsCollection() {
        if (this.currentTeamId && this.currentTeamId !== 'personal') {
            return this.db.collection('teams').doc(this.currentTeamId).collection('projects');
        } else {
            return this.db.collection('users').doc(this.currentUserId).collection('projects');
        }
    }

    // ============================================
    // UPRAVLJANJE NALOG
    // ============================================
    
    async saveTask(task) {
        try {
            console.log(" Shranjujem nalogo:", task.title);
            
            const taskData = {
                ...task,
                id: task.id.toString(),
                updatedAt: new Date().toISOString(),
                createdAt: task.createdAt || new Date().toISOString(),
                teamId: this.currentTeamId,
                createdBy: this.currentUserId
            };
            
            await this.getTasksCollection().doc(task.id.toString()).set(taskData, { merge: true });
            console.log(" Naloga shranjena v Firebase");
            return true;
            
        } catch (error) {
            console.error(" Napaka pri shranjevanju naloge:", error);
            throw error;
        }
    }

    async updateTask(taskId, updates) {
        try {
            await this.getTasksCollection().doc(taskId.toString()).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            console.log(` Naloga ${taskId} posodobljena`);
            return true;
        } catch (error) {
            console.error(" Napaka pri posodabljanju naloge:", error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            await this.getTasksCollection().doc(taskId.toString()).delete();
            console.log(` Naloga ${taskId} izbrisana`);
            return true;
        } catch (error) {
            console.error(" Napaka pri brisanju naloge:", error);
            throw error;
        }
    }

    // ============================================
    // UPRAVLJANJE DOGODKOV
    // ============================================
    
    async saveEvent(event) {
        try {
            console.log(" Shranjujem dogodek:", event.title);
            
            const eventData = {
                ...event,
                id: event.id.toString(),
                updatedAt: new Date().toISOString(),
                createdAt: event.createdAt || new Date().toISOString(),
                teamId: this.currentTeamId,
                createdBy: this.currentUserId
            };
            
            await this.getEventsCollection().doc(event.id.toString()).set(eventData, { merge: true });
            console.log(" Dogodek shranjen v Firebase");
            return true;
        } catch (error) {
            console.error(" Napaka pri shranjevanju dogodka:", error);
            throw error;
        }
    }

    async deleteEvent(eventId) {
        try {
            await this.getEventsCollection().doc(eventId.toString()).delete();
            console.log(` Dogodek ${eventId} izbrisan`);
            return true;
        } catch (error) {
            console.error(" Napaka pri brisanju dogodka:", error);
            throw error;
        }
    }

    // ============================================
    // UPRAVLJANJE PROJEKTOV
    // ============================================
    
    async saveProject(project) {
        try {
            const projectData = {
                ...project,
                teamId: this.currentTeamId,
                createdBy: this.currentUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await this.getProjectsCollection().doc(project.id.toString()).set(projectData, { merge: true });
            console.log(" Projekt shranjen:", project.name);
            return true;
        } catch (error) {
            console.error(" Napaka pri shranjevanju projekta:", error);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            await this.getProjectsCollection().doc(projectId.toString()).delete();
            console.log(` Projekt ${projectId} izbrisan`);
            return true;
        } catch (error) {
            console.error(" Napaka pri brisanju projekta:", error);
            throw error;
        }
    }

    // ============================================
    // DOHVAČANJE ČLANOV EKIPE
    // ============================================
    
    async getTeamMembers() {
        try {
            if (this.currentTeamId === 'personal') {
                // Personal način - samo trenutni uporabnik
                return [{
                    id: this.currentUserId,
                    name: 'Trenutni uporabnik',
                    initials: 'TU',
                    isCurrentUser: true
                }];
            }
            
            // Teams način - dohvačanje iz Firestore
            const snapshot = await this.db.collection('teams_users')
                .where('teamId', '==', this.currentTeamId)
                .get();
            
            const members = [];
            snapshot.forEach(doc => {
                members.push(doc.data());
            });
            
            console.log(` ${members.length} članov ekipe najdenih`);
            return members;
            
        } catch (error) {
            console.error(" Napaka pri dohvačanju članov ekipe:", error);
            return [];
        }
    }

    async addTeamMember(memberData) {
        try {
            const memberId = `member_${Date.now()}`;
            const member = {
                ...memberData,
                id: memberId,
                teamId: this.currentTeamId,
                addedBy: this.currentUserId,
                addedAt: new Date().toISOString(),
                isManual: true
            };
            
            await this.db.collection('teams_users').doc(memberId).set(member);
            console.log(" Nov član dodan v Firebase:", member.name);
            return member;
            
        } catch (error) {
            console.error(" Napaka pri dodajanju člana:", error);
            throw error;
        }
    }

    // ============================================
    // REAL-TIME OSKRKIVANJA
    // ============================================
    
    subscribeToTasks(callback) {
        console.log(" Vključujem real-time osluškivanje za naloge...");
        
        try {
            this.unsubscribeTasks = this.getTasksCollection()
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const tasks = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        data.id = parseInt(data.id) || data.id;
                        tasks.push(data);
                    });
                    
                    console.log(` ${tasks.length} nalog prejetih iz Firebase`);
                    callback(tasks);
                }, (error) => {
                    console.error(" Napaka v osluškivanju nalog:", error);
                });
                
        } catch (error) {
            console.error(" Napaka pri vključevanju osluškivanja:", error);
        }
    }

    subscribeToEvents(callback) {
        console.log(" Vključujem real-time osluškivanje za dogodke...");
        
        try {
            this.unsubscribeEvents = this.getEventsCollection()
                .orderBy('startDate', 'asc')
                .onSnapshot((snapshot) => {
                    const events = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        data.id = parseInt(data.id) || data.id;
                        events.push(data);
                    });
                    
                    console.log(` ${events.length} dogodkov prejetih iz Firebase`);
                    callback(events);
                }, (error) => {
                    console.error(" Napaka v osluškivanju dogodkov:", error);
                });
                
        } catch (error) {
            console.error(" Napaka pri vključevanju osluškivanja:", error);
        }
    }

    subscribeToProjects(callback) {
        console.log(" Vključujem real-time osluškivanje za projekte...");
        
        try {
            this.unsubscribeProjects = this.getProjectsCollection()
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const projects = [];
                    snapshot.forEach((doc) => {
                        projects.push(doc.data());
                    });
                    
                    console.log(` ${projects.length} projektov prejetih iz Firebase`);
                    callback(projects);
                }, (error) => {
                    console.error(" Napaka v osluškivanju projektov:", error);
                });
                
        } catch (error) {
            console.error(" Napaka pri vključevanju osluškivanja:", error);
        }
    }

    // ============================================
    // SINKRONIZACIJA
    // ============================================
    
    async syncWithLocal(localTasks, localEvents, localProjects) {
        try {
            console.log(" Začenjam sinhronizacijo s Firebase...");
            
            // Dohvačanje vseh podatkov iz Firebase
            const [tasksSnapshot, eventsSnapshot, projectsSnapshot] = await Promise.all([
                this.getTasksCollection().get(),
                this.getEventsCollection().get(),
                this.getProjectsCollection().get()
            ]);
            
            const firebaseTasks = this.processSnapshot(tasksSnapshot);
            const firebaseEvents = this.processSnapshot(eventsSnapshot);
            const firebaseProjects = this.processSnapshot(projectsSnapshot);
            
            console.log(` Firebase ima: ${firebaseTasks.length} nalog, ${firebaseEvents.length} dogodkov, ${firebaseProjects.length} projektov`);
            
            // Če Firebase ima podatke, uporabi te
            if (firebaseTasks.length > 0 || firebaseEvents.length > 0 || firebaseProjects.length > 0) {
                console.log(" Uporabljam podatke iz Firebase");
                return {
                    tasks: firebaseTasks,
                    events: firebaseEvents,
                    projects: firebaseProjects
                };
            }
            
            // Drugače shrani lokalne podatke v Firebase
            console.log(" Firebase je prazen, shranjujem lokalne podatke...");
            
            const savePromises = [];
            
            for (const task of localTasks) {
                savePromises.push(this.saveTask(task));
            }
            
            for (const event of localEvents) {
                savePromises.push(this.saveEvent(event));
            }
            
            for (const project of localProjects) {
                savePromises.push(this.saveProject(project));
            }
            
            await Promise.all(savePromises);
            
            return {
                tasks: localTasks,
                events: localEvents,
                projects: localProjects
            };
            
        } catch (error) {
            console.error(" Napaka pri sinhronizaciji:", error);
            return {
                tasks: localTasks,
                events: localEvents,
                projects: localProjects
            };
        }
    }

    processSnapshot(snapshot) {
        const items = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.id) {
                data.id = parseInt(data.id) || data.id;
            }
            items.push(data);
        });
        return items;
    }

    // ============================================
    // POMOŽNE METODE
    // ============================================
    
    async loadTasksOnce() {
        try {
            const snapshot = await this.getTasksCollection().get();
            return this.processSnapshot(snapshot);
        } catch (error) {
            console.error(" Napaka pri nalaganju nalog:", error);
            return [];
        }
    }

    async loadEventsOnce() {
        try {
            const snapshot = await this.getEventsCollection().get();
            return this.processSnapshot(snapshot);
        } catch (error) {
            console.error(" Napaka pri nalaganju dogodkov:", error);
            return [];
        }
    }

    async loadProjectsOnce() {
        try {
            const snapshot = await this.getProjectsCollection().get();
            return this.processSnapshot(snapshot);
        } catch (error) {
            console.error(" Napaka pri nalaganju projektov:", error);
            return [];
        }
    }

    unsubscribeAll() {
        if (this.unsubscribeTasks) {
            this.unsubscribeTasks();
            console.log(" Zaustavljeno osluškivanje nalog");
        }
        if (this.unsubscribeEvents) {
            this.unsubscribeEvents();
            console.log(" Zaustavljeno osluškivanje dogodkov");
        }
        if (this.unsubscribeProjects) {
            this.unsubscribeProjects();
            console.log(" Zaustavljeno osluškivanje projektov");
        }
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentTeamId: this.currentTeamId,
            currentUserId: this.currentUserId,
            firebaseUser: this.auth?.currentUser
        };
    }
}

// Globalna instanca
const firebaseService = new FirebaseService();
                .catch((err) => {
                    console.log("Firebase offline podpora ni na voljo:", err);
                });
            
            // Postavi korisničke podatke
            if (teamsContext && teamsContext.teamId) {
                this.currentTeamId = teamsContext.teamId;
                this.currentUserId = teamsContext.userObjectId || `user_${Date.now()}`;
                console.log(` Teams način: Team ID = ${this.currentTeamId}, User ID = ${this.currentUserId}`);
            } else {
                this.currentTeamId = 'personal';
                this.currentUserId = `user_${Date.now()}`;
                console.log(` Personal način: User ID = ${this.currentUserId}`);
            }
            
            this.isInitialized = true;
            console.log(" FirebaseService spreman!");
            
            // Pokaži Firebase badge
            const badge = document.getElementById('firebaseBadge');
            if (badge) badge.style.display = 'inline-flex';
            
            return true;
            
        } catch (error) {
            console.error(" Greška pri inicijalizaciji Firebase:", error);
            return false;
        }
    }

    getTasksCollection() {
        if (!this.db) return null;
        
        if (this.currentTeamId && this.currentTeamId !== 'personal') {
            return this.db.collection('teams').doc(this.currentTeamId).collection('tasks');
        } else {
            return this.db.collection('users').doc(this.currentUserId).collection('tasks');
        }
    }

    async saveTask(task) {
        try {
            console.log(" Spremanje zadatka u Firebase:", task.title);
            
            // Pripremi podatke za Firebase
            const taskData = {
                ...task,
                id: task.id.toString(),
                assigneeIds: task.assigneeIds || [task.assigneeId || this.currentUserId],
                assignees: task.assignees || [],
                assigneeNames: task.assigneeNames || task.assigneeName || 'Neznan',
                assigneeInitials: task.assigneeInitials || task.assigneeInitials || '??',
                updatedAt: new Date().toISOString(),
                createdAt: task.createdAt || new Date().toISOString()
            };
            
            // Spremi u Firebase
            await this.getTasksCollection().doc(task.id.toString()).set(taskData, { merge: true });
            console.log(" Zadatak spremljen u Firebase");
            return true;
            
        } catch (error) {
            console.error(" Greška pri spremanju zadatka:", error);
            throw error;
        }
    }

    subscribeToTasks(onTasksUpdated) {
        console.log(" Uključujem real-time osluškivanje za zadatke...");
        
        try {
            const tasksCollection = this.getTasksCollection();
            if (!tasksCollection) return;
            
            this.unsubscribeTasks = tasksCollection
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const tasks = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        // Konvertiraj ID naziv u broj ako je potrebno
                        if (data.id) {
                            data.id = parseInt(data.id) || data.id;
                        }
                        tasks.push(data);
                    });
                    
                    console.log(` Primljeno ${tasks.length} zadataka iz Firebase`);
                    onTasksUpdated(tasks);
                }, (error) => {
                    console.error(" Greška u osluškivanju zadataka:", error);
                });
        } catch (error) {
            console.error(" Greška pri pokretanju osluškivanja:", error);
        }
    }

    // 6. Ažuriraj zadatak
    async updateTask(taskId, updates) {
        try {
            await this.getTasksCollection().doc(taskId.toString()).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            console.log(` Zadatak ${taskId} ažuriran`);
            return true;
        } catch (error) {
            console.error(" Greška pri ažuriranju zadatka:", error);
            throw error;
        }
    }

    // 7. Izbriši zadatak
    async deleteTask(taskId) {
        try {
            await this.getTasksCollection().doc(taskId.toString()).delete();
            console.log(` Zadatak ${taskId} izbrisan`);
            return true;
        } catch (error) {
            console.error(" Greška pri brisanju zadatka:", error);
            throw error;
        }
    }

    // 8. Spremi događaj
    async saveEvent(event) {
        try {
            console.log(" Spremanje događaja u Firebase:", event.title);
            
            const eventData = {
                ...event,
                id: event.id.toString(),
                updatedAt: new Date().toISOString(),
                createdAt: event.createdAt || new Date().toISOString()
            };
            
            await this.getEventsCollection().doc(event.id.toString()).set(eventData, { merge: true });
            console.log(" Događaj spremljen u Firebase");
            return true;
        } catch (error) {
            console.error(" Greška pri spremanju događaja:", error);
            throw error;
        }
    }

    // 9. Uključi real-time osluškivanje za događaje
    subscribeToEvents(onEventsUpdated) {
        console.log(" Uključujem real-time osluškivanje za događaje...");
        
        try {
            this.unsubscribeEvents = this.getEventsCollection()
                .orderBy('startDate', 'asc')
                .onSnapshot((snapshot) => {
                    const events = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data.id) {
                            data.id = parseInt(data.id) || data.id;
                        }
                        events.push(data);
                    });
                    
                    console.log(` Primljeno ${events.length} događaja iz Firebase`);
                    onEventsUpdated(events);
                }, (error) => {
                    console.error(" Greška u osluškivanju događaja:", error);
                });
        } catch (error) {
            console.error(" Greška pri pokretanju osluškivanja:", error);
        }
    }

    // 10. Izbriši događaj
    async deleteEvent(eventId) {
        try {
            await this.getEventsCollection().doc(eventId.toString()).delete();
            console.log(` Događaj ${eventId} izbrisan`);
            return true;
        } catch (error) {
            console.error(" Greška pri brisanju događaja:", error);
            throw error;
        }
    }

    // 11. Sinkroniziraj lokalne podatke s Firebaseom
    async syncWithLocal(localTasks, localEvents) {
        try {
            console.log(" Počinjem sinkronizaciju s Firebase...");
            
            // Dohvati zadatke iz Firebase
            const tasksSnapshot = await this.getTasksCollection().get();
            const firebaseTasks = [];
            tasksSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.id) {
                    data.id = parseInt(data.id) || data.id;
                }
                firebaseTasks.push(data);
            });
            
            // Dohvati događaje iz Firebase
            const eventsSnapshot = await this.getEventsCollection().get();
            const firebaseEvents = [];
            eventsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.id) {
                    data.id = parseInt(data.id) || data.id;
                }
                firebaseEvents.push(data);
            });
            
            console.log(` Firebase ima ${firebaseTasks.length} zadataka i ${firebaseEvents.length} događaja`);
            
            // Ako Firebase ima podatke, koristi te
            if (firebaseTasks.length > 0 || firebaseEvents.length > 0) {
                console.log(" Koristim podatke iz Firebase");
                return {
                    tasks: firebaseTasks,
                    events: firebaseEvents
                };
            }
            
            // Inače, spremi lokalne u Firebase
            console.log(" Firebase je prazan, spremanjem lokalne podatke...");
            for (const task of localTasks) {
                await this.saveTask(task);
            }
            for (const event of localEvents) {
                await this.saveEvent(event);
            }
            
            return {
                tasks: localTasks,
                events: localEvents
            };
            
        } catch (error) {
            console.error(" Greška pri sinkronizaciji s Firebase:", error);
            return {
                tasks: localTasks,
                events: localEvents
            };
        }
    }

    // 12. Dohvati samo zadatke (jednom)
    async loadTasks() {
        try {
            const snapshot = await this.getTasksCollection().get();
            const tasks = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.id) {
                    data.id = parseInt(data.id) || data.id;
                }
                tasks.push(data);
            });
            return tasks;
        } catch (error) {
            console.error(" Greška pri učitavanju zadataka:", error);
            return [];
        }
    }

    // 13. Dohvati samo događaje (jednom)
    async loadEvents() {
        try {
            const snapshot = await this.getEventsCollection().get();
            const events = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.id) {
                    data.id = parseInt(data.id) || data.id;
                }
                events.push(data);
            });
            return events;
        } catch (error) {
            console.error(" Greška pri učitavanju događaja:", error);
            return [];
        }
    }

    // 14. Zaustavi osluškivanje
    unsubscribe() {
        if (this.unsubscribeTasks) {
            this.unsubscribeTasks();
            console.log(" Zaustavljeno osluškivanje zadataka");
        }
        if (this.unsubscribeEvents) {
            this.unsubscribeEvents();
            console.log(" Zaustavljeno osluškivanje događaja");
        }
    }

    // 15. Provjeri Firebase stanje
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentTeamId: this.currentTeamId,
            currentUserId: this.currentUserId
        };
    }
}

// Kreiraj globalnu instancu
const firebaseService = new FirebaseService();
