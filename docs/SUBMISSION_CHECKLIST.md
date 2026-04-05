# WOA — App Store Submission Checklist

Bundle ID: `com.workerofart.app`  
Version: `1.0.0` / Build: `1`  

---

## PRE-SUBMISSION

### Account & Legal
- [ ] Apple Developer account active ($99/year) — developer.apple.com
- [ ] Privacy policy hosted at `workerofart.com/privacy` (use `legal/privacy-policy.html`)
- [ ] Terms of service hosted at `workerofart.com/terms` (use `legal/terms-of-service.html`)
- [ ] Confirm `privacy@workerofart.com` and `legal@workerofart.com` are active inboxes

### Assets (Replace Placeholders)
- [ ] App icon `assets/icon.png` — 1024×1024px, solid black bg, no alpha channel, no rounded corners
- [ ] Splash screen `assets/splash.png` — 1024×1024px, solid black bg, WOA logo centered
- [ ] Android adaptive icon `assets/adaptive-icon.png` — 1024×1024px, WOA logo on black
- [ ] Android notification icon `assets/notification-icon.png` — white icon on transparent bg (24dp)
- [ ] Confirm icon has NO transparency — Apple will reject icons with alpha channel

### App Testing
- [ ] All screens tested on real iPhone (not simulator only)
- [ ] Test complete auth flow: sign up → login → logout → login again
- [ ] Test session persistence: close app fully, reopen — should land on Feed (if logged in)
- [ ] Test no-internet screen: turn on airplane mode, open app — shows "NO CONNECTION" screen
- [ ] Test push notifications end-to-end (requires TestFlight build)
- [ ] Test all image pickers (profile photo, post upload, feature thumbnail)
- [ ] Test all camera permissions dialogs
- [ ] Test all location permission dialog
- [ ] Test messaging flow: send message → receive notification banner
- [ ] Test gig posting and interest flow
- [ ] Test delete account flow — confirm data is removed

### Environment & Security
- [ ] `.env` file is in `.gitignore` (never commit secrets)
- [ ] Supabase URL and anon key loaded via `app.config.js` extra (not raw in source)
- [ ] No `console.log` statements in production code (already removed)
- [ ] Stripe keys (if added): use live keys in production, test keys only in development
- [ ] Run `eas secret:push` to set env vars in EAS before building

---

## EAS BUILD (iOS)

```bash
# Install EAS CLI (one time)
npm install -g eas-cli

# Login to your Expo account
eas login

# Configure EAS for this project (one time)
eas build:configure

# Create production build for iOS
eas build --platform ios --profile production
```

- Wait 15–20 minutes for the build to complete
- Download the `.ipa` from the EAS dashboard (expo.dev)
- Or upload directly to App Store Connect via EAS Submit

---

## APP STORE CONNECT SETUP

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** WORK(ER) OF ART
   - **Primary Language:** English
   - **Bundle ID:** `com.workerofart.app`
   - **SKU:** `workerofart-ios-1`
4. **Category:** Social Networking
5. **Age Rating:** 12+ (run the questionnaire — select "Infrequent/Mild" for mature themes)
6. **Privacy Policy URL:** `https://workerofart.com/privacy`

---

## APP STORE LISTING

### App Description
```
WORK(ER) OF ART is the platform built for working artists. Create your artist
profile, post your work to the Art Feed, and connect with gig posters looking
for your exact talent.

FOR ARTISTS:
— Build a public profile showcasing your discipline, location, and years of experience
— Post images, text, and audio to the Art Feed
— Browse and apply to gigs that match your skills
— Get discovered by labels, studios, and brands

FOR GIG POSTERS:
— Post a gig in minutes and reach artists worldwide
— Browse interested artists and message who you choose
— Find the right talent by location and discipline

WORLD TOUR:
— Watch our original short films featuring WOA artists from around the world
```

### Keywords (100 chars max)
```
artist,gig,creative,portfolio,music,illustration,photography,freelance,commission,art
```

### Screenshots Required
- **6.7" iPhone** (1290 × 2796) — minimum 3 screenshots
- **6.5" iPhone** (1242 × 2688) — minimum 3 screenshots
- Suggested screens to capture:
  1. Feed / Art Feed with posts
  2. Artist Directory grid
  3. Gig Board
  4. Artist Profile
  5. Notifications
  6. Features / World Tour

### App Preview Video (Optional but recommended)
- Max 30 seconds, shows core flow (Feed → Gigs → Message)
- Must be recorded on a real device

---

## TESTFLIGHT

1. Upload build via EAS or Transporter app
2. In App Store Connect → TestFlight tab
3. Add internal testers (up to 25 — your email + team)
4. Install **TestFlight** app on your iPhone
5. Accept the invite and install the WOA build
6. Test every screen and user flow
7. Fix any issues found, increment `buildNumber` in `app.config.js`, rebuild
8. When satisfied → click **Submit for Review**

---

## APP REVIEW NOTES (for Apple reviewer)

Include this in the "Notes" field when submitting:

```
Test Account (Artist):
  Email: [create a test account before submission]
  Password: [set a simple test password]

Test Account (Gig Poster):
  Email: [create a second test account]
  Password: [set a simple test password]

The app has two user types: Artists and Gig Posters.
The Features tab (World Tour) contains admin-curated content —
it may be empty in the review build as content is added manually.
Push notifications require a physical device and a real Supabase
notification trigger to test.
```

---

## POST-LAUNCH

- [ ] Monitor App Store Connect for crash reports
- [ ] Set up Supabase database backups
- [ ] Monitor Supabase usage (free tier: 500MB DB, 1GB storage, 50,000 MAU)
- [ ] Respond to App Store reviews within 24 hours
- [ ] Plan v1.1 based on user feedback
