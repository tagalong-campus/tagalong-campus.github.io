# Tagalong live class demo

A live prototype of Tagalong for presenting in class. Everyone scans a QR code, joins one shared campus on their phone, and posts and joins plans. The projector shows the university console: live numbers, the alcohol policy settings and the review queue.

- `index.html`: the student app (what the QR code opens)
- `console.html`: the university console for the projector (presenter sign-in)
- `js/policy.js`: alcohol policy presets and the auto-check
- `js/clubs.js`: the official clubs (names, descriptions, website links)
- `js/when.js`: event times, and when an event is over
- `js/backend.js`: the data layer (Firebase, or local test mode)
- `firestore.rules`: database security rules

Plain HTML and JavaScript, with no build step.

## Try it locally

```
python3 -m http.server 8765
```

Add `?local=1` to a URL (or set `firebaseConfig` to null) for **local test mode**: data syncs between tabs in one browser only, and nothing touches Firebase.

- Console: http://127.0.0.1:8765/console.html?local=1 (any email and password works locally)
- Students: open http://127.0.0.1:8765/?local=1 in several tabs. Each tab is a different student.
- Example data: open http://127.0.0.1:8765/test/seed.html, then `/?local=1&as=alex` and `/console.html?local=1&admin=1`
- Tests: http://127.0.0.1:8765/test/run.html
- Load test against the **live** campus (sign in to the console first, reset the campus afterwards):
  `/test/load.html?n=25&secs=75&rush=1` simulates 25 students posting, joining and chatting, with all of them joining one plan at the same second.
  Add a second tab with `/test/load.html?observe=1&secs=80` to measure what a single phone sees meanwhile.
  Result on 2026-10-01: 0 failures, 24/24 simultaneous joins, observer phone saw new plans in 0.5 s on average (max 2 s).

## Connect Firebase (one-time, about 15 minutes)

1. Go to https://console.firebase.google.com, choose **Create a project**, and name it e.g. `tagalong-demo`. Google Analytics isn't needed.
2. **Build → Authentication → Get started.** Under **Sign-in method**, enable **Anonymous** and **Email/Password**.
3. In **Authentication → Users → Add user**, create the presenter account (an email and a password). This is the console login.
4. Leave **Authentication → Settings → User actions → Enable create (sign-up)** switched **on**. Students' anonymous sign-in needs it.
5. **Build → Firestore Database → Create database.** Pick a European location (e.g. `eur3`) and start in **production mode**.
6. In **Firestore → Rules**, paste the contents of `firestore.rules`, replace `PRESENTER_EMAIL` with the presenter's email, and **Publish**. Only that account can use the console controls.
7. In **Project settings** (the gear icon) **→ Your apps**, add a **Web app** (`</>`). Copy the `firebaseConfig` object into `js/config.js`.
8. Once the site is online, go to **Authentication → Settings → Authorized domains** and add its domain (e.g. `yourname.github.io`).

The Firebase web config isn't a secret: it identifies the project, and the rules in step 6 decide who can do what.

## Running a class

1. Open `console.html` on the projector and sign in. The first sign-in creates the campus.
2. Optional: **Settings → Add starter plans**, so the feed isn't empty when people scan in. It adds plans of different sizes, open and members-only club events, and example messages in the club channels and in the plans that are going ahead.
3. Show the QR code. Students enter a first name and year.
4. To show the auto-check, switch presets in **Alcohol policy** and ask someone to post one of the example plans.
5. To show a chat being deleted after an event: **Live → End now** on a plan that's going ahead. Events also end on their own 2 hours after they start, while the console is open.
6. Afterwards: **Settings → Reset campus** deletes all names, plans, chats and club memberships.

## Known limits (fine for a demo, not for production)

- The auto-check runs on the student's phone, so someone with developer tools could get around it. In the real product it would run on a server, using an AI model rather than a keyword list.
- Anyone can post "as a club" in the demo. In the real product, only verified club admins can.
- "Request to join" a club is accepted straight away. In the real product, the club's admins would approve it, or send people to the club's application.
- Ended events' chats are deleted by the console while it's open. In the real product, a server job would do it.
- After changing `firestore.rules`, paste it into Firebase again (step 6 above). Club channels and members-only events need the latest rules.
- Free Firebase limits (50,000 reads a day) cover a class of 40 comfortably. Leaving the console open for days isn't a problem either.
