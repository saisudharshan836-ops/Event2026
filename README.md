# EventRegister — Campus Event Management

A responsive event registration app built with **HTML, CSS, Bootstrap 5, JavaScript modules, Firebase Authentication and Cloud Firestore**.

## Included features

### Student
- Email/password sign-up and login (no role selector on login).
- Duplicate email detection through Firebase Authentication.
- Unique username reservation in Firestore.
- Password checks: 8+ characters, uppercase, lowercase, number and special character, with live strength indicator.
- Browse Sports, Dance, Singing, Technology, Cultural and other events.
- Sports sub-tabs for Cricket, Volleyball and Badminton.
- Event details, confirmation before registration, and My Registrations with venue/date/time.
- Password reset email.

### Admin
- Admin role is assigned manually in Firestore; there is no admin option on the login screen.
- Admin dashboard: student count, event count, registration count and recent login activity.
- Create, edit and delete events.
- View student directory and last-login timestamps.

## 1. Firebase setup

The Firebase configuration supplied in the request is already placed in `assets/app.js`.

1. Open [Firebase Console](https://console.firebase.google.com/) and select project `eventorganiser-2b09b`.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Firestore Database**, create a database.
4. Open **Firestore → Rules**, paste the contents of `firestore.rules`, and click **Publish**.
5. In **Project settings → Your apps**, ensure the web app matches the configuration in `assets/app.js`.
6. For local testing, serve the folder using VS Code Live Server or another local HTTP server. Do not open `index.html` directly with `file://`, because browser module imports and Firebase require an HTTP origin.

## 2. Assign an admin manually (important)

1. Create a normal account using the app first.
2. In Firebase Console → Authentication → Users, copy that user's UID.
3. In Firestore, open the `users` collection and the document whose ID is that UID.
4. Change the `role` field from `student` to `admin` (string value, not a map).
5. Sign out and sign in again. The admin dashboard and management links will appear.

Do not create an admin through a public sign-up form. The signup code always creates `role: "student"` and the security rules prevent users from changing their own role.

## 3. Run locally

Recommended:
- Extract the ZIP.
- Open the `EventRegister` folder in VS Code.
- Install/use the **Live Server** extension.
- Right-click `index.html` → **Open with Live Server**.

You can also run a local static server from the folder:
```bash
python -m http.server 5500
```
Then visit `http://localhost:5500`.

## 4. Deploy

You can deploy this static site with Firebase Hosting or GitHub Pages. For Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Select the existing Firebase project and set the public directory to this folder.
firebase deploy
```
Use HTTPS in production.

## 5. Firestore data structure

- `users/{uid}` — name, username, email, role, createdAt, lastLoginAt.
- `usernames/{lowercaseUsername}` — uid and createdAt; username reservation prevents duplicate usernames.
- `events/{eventId}` — title, category, game, date, time, venue, address, description, seats, createdBy, timestamps.
- `registrations/{registrationId}` — eventId, eventTitle, studentId, studentName, email, status, createdAt.

## Signup race-condition fix

The signup flow pauses the auth-state listener until the new student's Firestore profile and username reservation are created. This prevents the listener from treating the just-created account as a missing-profile account and signing it out before registration completes. Signup errors now show actionable Firebase error codes/messages.

## Notes and production hardening

- Firebase Authentication rejects duplicate email addresses. The app translates that into an “Email already exists” message.
- Username availability is checked and then reserved in a Firestore transaction to reduce duplicate-username races.
- Firestore security rules are essential. Do not deploy with open test rules.
- Admin login is not a separate login route. The role is looked up from the trusted Firestore user profile after authentication.
- The dashboard's “recent logins” and “last login” are based on `lastLoginAt`, not a guaranteed real-time online-presence indicator. For true live online/offline status, add Firebase Realtime Database presence.
- The seat count is displayed as event capacity; this starter version does not yet enforce capacity atomically or prevent a student registering from multiple devices simultaneously. Add a transaction-based registration/capacity workflow before using it for high-demand live events.
- Firebase web config values are identifiers, not server credentials. Never put service-account private keys in frontend code.
