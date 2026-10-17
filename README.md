# Lowlight

Screens before bed vs the night after — measured on your own nights. Log your
evening (screen minutes in the last two hours, lights-out) and how you slept;
Lowlight fits a small Bayesian model that separates the screen effect from late
bedtimes, says plainly when there's no clear link yet, and plans tonight: the
smallest change that reaches your target, with a what-if map of evenings.

- Expo SDK 54, expo-router, expo-sqlite, reanimated, gesture-handler, react-native-svg
- No backend, no network permission, no usage-stats access — screen time is logged by hand.
- Not medical advice.

```
npm install
npx expo start          # Expo Go
npm run verify          # tsc + tests + rules + export
```

Engine and design notes: [PLAN.md](PLAN.md).
