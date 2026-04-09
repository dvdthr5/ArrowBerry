

# ArrowBerry

ArrowBerry is a mobile-first application for scanning grocery receipts, extracting ingredient information, and turning pantry data into recipe recommendations.

The project is currently built with Expo and React Native, uses Supabase for authentication and backend data, and is organized to support future OCR and pantry-management workflows.

## Current goals

- Support account creation and login with Supabase Auth
- Let users scan receipts from the camera flow
- Extract useful ingredient data from scanned receipts
- Store pantry information per user
- Recommend recipes based on available ingredients
- Allow future feedback features such as recipe likes, dislikes, and pantry edits

## Tech stack

- Expo
- React Native
- Expo Router
- React Navigation
- Supabase

## Repository structure

```text
app/
  navigation/        Navigation setup and tab navigator
  screens/           Main app screens such as scanner, recipes, and pantry
  login.tsx          Login screen
  signup.tsx         Account creation screen
  index.tsx          Root app entry and auth gate
lib/
  supabase.*         Supabase client configuration
assets/              Images, fonts, and static assets
```

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file at the repository root.

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Notes:
- The variable names must exactly match the names used in code.
- After changing `.env`, restart Expo.

### 3. Start the app

```bash
npx expo start
```

You can then run the project in Expo Go, an iOS simulator, an Android emulator, or on the web as needed.

## Local testing checklist

Before opening a pull request, verify the following locally when your changes touch auth, navigation, or UI flows:

- The app starts without runtime errors
- Login screen loads correctly
- Signup screen loads correctly
- Users can create an account
- Users can sign in
- Users can sign out
- Navigation still works across scanner, recipes, and pantry screens
- UI changes look reasonable on both narrow and wider layouts when relevant

## Contributing

### General expectations

- Keep changes focused and easy to review
- Prefer small pull requests over large unrelated rewrites
- Reuse existing patterns before introducing new architecture
- Keep UI behavior consistent across screens
- Do not commit secrets, API keys, or `.env` files

### Branching

Use a feature branch for your work.

Example:

```bash
git checkout -b feature/add-signup-validation
```

### Suggested contribution flow

1. Pull the latest changes from the main branch
2. Create a feature branch
3. Make your changes
4. Test the affected flow locally
5. Open a pull request with a clear summary of what changed and how it was tested

### Pull request notes

A good pull request should include:

- A short summary of the change
- Why the change was needed
- Any setup steps reviewers should know about
- A short note on how you tested it
- Screenshots for visible UI changes when helpful

## Supabase notes

ArrowBerry uses Supabase for authentication and backend services.

Important reminders:
- Keep Supabase keys out of committed source files
- Use `.env` for local configuration
- Auth redirect behavior may need dashboard configuration during development
- If auth links redirect incorrectly, check the Supabase Site URL and redirect settings

## Project status

This project is still under active development. The architecture and setup may evolve as receipt scanning, OCR, pantry management, and recipe recommendation features are expanded.