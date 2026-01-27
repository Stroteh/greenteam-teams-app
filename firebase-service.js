// firebase-service.js - Firebase servis za GreenTeam
class FirebaseService {
    constructor() {
        this.db = firebase.firestore();
        this.isInitialized = false;
        this.currentTeamId = null;
        this.currentUserId = null;
        this.unsubscribeTasks = null;
        this.unsubscribeEvents = null;
        console.log("🔥 FirebaseService kreiran");
    }

    // 1. Inicializacija s Teams kontekstom
    async initialize(teamsContext = null) {
        console.log("🚀 FirebaseService se pokreće...");
        
        try {
            // Postavi korisničke podatke
            if (teamsContext && teamsContext.teamId) {
                this.currentTeamId = teamsContext.teamId;
                this.currentUserId = teamsContext.userObjectId || `user_${Date.now()}`;
                console.log(`📱 Teams način: Team ID = ${this.currentTeamId}`);
            } else {
                this.currentTeamId = 'personal';
                this.currentUserId = `user_${Date.now()}`;
                console.log(`🏠 Personal način: User ID = ${this.currentUserId}`);
            }
            
            this.isInitialized = true;
            console.log("✅ FirebaseService spreman!");
            
            // Pokaži Firebase badge
            document.getElementById('firebaseBadge').style.display = 'inline-flex';
            
            return true;
            
        } catch (error) {
            console.error("❌ Greška pri inicijalizaciji Firebase:", error);
            return false;
        }
    }

    // 2. Dohvati kolekciju za zadatke
    getTasksCollection() {
        if (this.currentTeamId && this.currentTeamId !== 'personal') {
            // Timski način - svi vide iste zadatke
            return this.db.collection('teams').doc(this.currentTeamId).collection('tasks');
        } else {
            // Personal način - samo ovaj korisnik
            return this.db.collection('users').doc(this.currentUserId).collection('tasks');
        }
    }

    // 3. Dohvati kolekciju za događaje
    getEventsCollection() {
        if (this.currentTeamId && this.currentTeamId !== 'personal') {
            return this.db.collection('teams').doc(this.currentTeamId).collection('events');
        } else {
            return this.db.collection('users').doc(this.currentUserId).collection('events');
        }
    }

    // 4. Spremi zadatak
    async saveTask(task) {
        try {
            console.log("💾 Spremanje zadatka u Firebase:", task.title);
            
            // Osiguraj da je ID string
            const taskData = {
                ...task,
                id: task.id.toString(),
                updatedAt: new Date().toISOString(),
                createdAt: task.createdAt || new Date().toISOString()
            };
            
            // Spremi u Firebase
            await this.getTasksCollection().doc(task.id.toString()).set(taskData, { merge: true });
            console.log("✅ Zadatak spremljen u Firebase");
            return true;
            
        } catch (error) {
            console.error("❌ Greška pri spremanju zadatka:", error);
            throw error;
        }
    }

    // 5. Uključi real-time osluškivanje za zadatke
    subscribeToTasks(onTasksUpdated) {
        console.log("👂 Uključujem real-time osluškivanje za zadatke...");
        
        try {
            this.unsubscribeTasks = this.getTasksCollection()
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
                    
                    console.log(`📥 Primljeno ${tasks.length} zadataka iz Firebase`);
                    onTasksUpdated(tasks);
                }, (error) => {
                    console.error("❌ Greška u osluškivanju zadataka:", error);
                });
        } catch (error) {
            console.error("❌ Greška pri pokretanju osluškivanja:", error);
        }
    }

    // 6. Ažuriraj zadatak
    async updateTask(taskId, updates) {
        try {
            await this.getTasksCollection().doc(taskId.toString()).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            console.log(`✏️ Zadatak ${taskId} ažuriran`);
            return true;
        } catch (error) {
            console.error("❌ Greška pri ažuriranju zadatka:", error);
            throw error;
        }
    }

    // 7. Izbriši zadatak
    async deleteTask(taskId) {
        try {
            await this.getTasksCollection().doc(taskId.toString()).delete();
            console.log(`🗑️ Zadatak ${taskId} izbrisan`);
            return true;
        } catch (error) {
            console.error("❌ Greška pri brisanju zadatka:", error);
            throw error;
        }
    }

    // 8. Spremi događaj
    async saveEvent(event) {
        try {
            console.log("💾 Spremanje događaja u Firebase:", event.title);
            
            const eventData = {
                ...event,
                id: event.id.toString(),
                updatedAt: new Date().toISOString(),
                createdAt: event.createdAt || new Date().toISOString()
            };
            
            await this.getEventsCollection().doc(event.id.toString()).set(eventData, { merge: true });
            console.log("✅ Događaj spremljen u Firebase");
            return true;
        } catch (error) {
            console.error("❌ Greška pri spremanju događaja:", error);
            throw error;
        }
    }

    // 9. Uključi real-time osluškivanje za događaje
    subscribeToEvents(onEventsUpdated) {
        console.log("👂 Uključujem real-time osluškivanje za događaje...");
        
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
                    
                    console.log(`📅 Primljeno ${events.length} događaja iz Firebase`);
                    onEventsUpdated(events);
                }, (error) => {
                    console.error("❌ Greška u osluškivanju događaja:", error);
                });
        } catch (error) {
            console.error("❌ Greška pri pokretanju osluškivanja:", error);
        }
    }

    // 10. Izbriši događaj
    async deleteEvent(eventId) {
        try {
            await this.getEventsCollection().doc(eventId.toString()).delete();
            console.log(`🗑️ Događaj ${eventId} izbrisan`);
            return true;
        } catch (error) {
            console.error("❌ Greška pri brisanju događaja:", error);
            throw error;
        }
    }

    // 11. Sinkroniziraj lokalne podatke s Firebaseom
    async syncWithLocal(localTasks, localEvents) {
        try {
            console.log("🔄 Počinjem sinkronizaciju s Firebase...");
            
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
            
            console.log(`📊 Firebase ima ${firebaseTasks.length} zadataka i ${firebaseEvents.length} događaja`);
            
            // Ako Firebase ima podatke, koristi te
            if (firebaseTasks.length > 0 || firebaseEvents.length > 0) {
                console.log("🔄 Koristim podatke iz Firebase");
                return {
                    tasks: firebaseTasks,
                    events: firebaseEvents
                };
            }
            
            // Inače, spremi lokalne u Firebase
            console.log("🔄 Firebase je prazan, spremanjem lokalne podatke...");
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
            console.error("❌ Greška pri sinkronizaciji s Firebase:", error);
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
            console.error("❌ Greška pri učitavanju zadataka:", error);
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
            console.error("❌ Greška pri učitavanju događaja:", error);
            return [];
        }
    }

    // 14. Zaustavi osluškivanje
    unsubscribe() {
        if (this.unsubscribeTasks) {
            this.unsubscribeTasks();
            console.log("🔇 Zaustavljeno osluškivanje zadataka");
        }
        if (this.unsubscribeEvents) {
            this.unsubscribeEvents();
            console.log("🔇 Zaustavljeno osluškivanje događaja");
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
