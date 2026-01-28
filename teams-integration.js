// teams-integration.js - Besplatna Teams integracija brez Azure

class TeamsIntegration {
    constructor() {
        this.isInitialized = false;
        this.context = null;
        this.members = [];
        console.log(" TeamsIntegration kreiran");
    }

    async initialize() {
        try {
            console.log(" Inicializiram Teams...");
            
            if (typeof microsoftTeams === 'undefined') {
                console.warn(" Teams SDK ni na voljo");
                return false;
            }
            
            await microsoftTeams.app.initialize();
            
            // Pridobi Teams kontekst
            this.context = await microsoftTeams.app.getContext();
            console.log(" Teams kontekst pridobljen:", this.context);
            
            // Obdelaj kontekst
            this.processContext();
            
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error(" Napaka pri inicializaciji Teams:", error);
            return false;
        }
    }

    processContext() {
        if (!this.context) return;
        
        const user = this.context.user || {};
        const team = this.context.team || {};
        
        // Ustvari naš format uporabnika
        this.currentUser = {
            id: user.id || `teams_${Date.now()}`,
            name: user.displayName || 'Teams Uporabnik',
            email: user.userPrincipalName || '',
            initials: this.getInitials(user.displayName || 'TU'),
            teamsId: user.id,
            tenantId: user.tenantId,
            isTeamsUser: true,
            photoUrl: user.photoUrl,
            teamId: team.id || 'personal',
            teamName: team.displayName || 'Personal'
        };
        
        console.log(" Trenutni uporabnik:", this.currentUser.name);
        
        // Samo trenutni uporabnik za začetek
        this.members = [this.currentUser];
    }

    getInitials(name) {
        return name.split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) || 'TU';
    }

    async getContextForFirebase() {
        return {
            user: this.currentUser,
            team: {
                id: this.currentUser.teamId,
                name: this.currentUser.teamName
            }
        };
    }

    // Ročno dodajanje članov
    async addMemberManually(memberData) {
        try {
            const newMember = {
                id: `manual_${Date.now()}`,
                name: memberData.name,
                email: memberData.email || '',
                initials: this.getInitials(memberData.name),
                isTeamsUser: false,
                isManual: true,
                addedBy: this.currentUser.id,
                addedAt: new Date().toISOString(),
                teamId: this.currentUser.teamId
            };
            
            this.members.push(newMember);
            console.log(" Ročno dodan član:", newMember.name);
            return newMember;
            
        } catch (error) {
            console.error(" Napaka pri dodajanju člana:", error);
            throw error;
        }
    }

    // Preveri dovoljenja
    checkPermissions() {
        return {
            canAccessTeams: this.isInitialized,
            hasTeam: !!this.currentUser?.teamId && this.currentUser.teamId !== 'personal',
            user: this.currentUser
        };
    }

    // Prikaži obvestilo v Teams
    showNotification(message, title = 'GreenTeam') {
        if (!this.isInitialized) return;
        
        try {
            microsoftTeams.tasks.submitTask({
                title: title,
                message: message
            });
        } catch (error) {
            console.warn("Ne morem prikazati Teams obvestila:", error);
        }
    }
}

// Globalna instanca
const teamsIntegration = new TeamsIntegration();
