# GreenTeam - Besplatna Teams Aplikacija

 **Projektno vodenje z Kanban tablico in koledarjem za Microsoft Teams**

##  Funkcionalnosti

 **Kanban tablica** s 4 stolpci (Todo, V teku, Pregled, Opravljeno)  
 **Koledar** z mesečnim pregledom dogodkov  
 **Rojstni dnevi** z avtomatskimi opomniki  
 **Več izvajalcev** za vsako nalogo  
 **Projektni pregled** s prioriteto  
 **Teams integracija** (brez Azure stroškov)  
 **Firebase sinhronizacija** v realnem času  
 **Osebni avatar** s statistikami  
 **Responsive design** za vse naprave  

##  Namestitev v 3 korakih

### 1. Firebase Setup
1. Ustvari projekt na [Firebase Console](https://console.firebase.google.com/)
2. Dodaj **Web App** in kopiraj konfiguracijo
3. Omogoči **Firestore Database** (test mode)
4. Dodaj pravila (glej `firestore.rules`)

### 2. GitHub Secrets
Dodaj te Secrets v GitHub Repository:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN` 
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_SENDER_ID`
- `FIREBASE_APP_ID`

### 3. Teams Deployment
1. Pojdi na [Teams Developer Portal](https://dev.teams.microsoft.com/)
2. Ustvari novo aplikacijo
3. Uploadaj `teams-app-package.zip` (se ustvari samodejno)
4. Testiraj v Teams Desktop/Web App

##  Projekta struktura
