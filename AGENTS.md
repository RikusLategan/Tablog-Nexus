# Project Protocol: Nexus Inventory

## Guidelines for the AI Agent
To prevent recurring errors and maintain context, follow these rules:

1. **Verification First**: Before claiming a fix is complete, run `lint_applet` and `compile_applet`. Specifically check for hydration errors (nesting forbidden elements).
2. **No Placeholders**: Never use `/* ... existing code ... */` or similar placeholders in `edit_file` calls. You MUST provide the full context lines to ensure the patch applies correctly.
3. **UI Consistency**: This app uses a "Nexus/Classic CLI" aesthetic. Ensure new components use `font-mono`, `rounded-none`, and `border-border/40`.
4. **Firebase Safety**: Always check if `user` is defined in `App.tsx` before attempting to subscribe to or write to collections.
5. **Type Integrity**: Ensure `InventoryItem` fields match between `src/types.ts`, `firebase-blueprint.json`, and `firestore.rules`.

## Recurring Bugs & Fixes
- **Hydration Errors**: Do not nest `<button>` inside a Tooltip `<TooltipTrigger>`. Use a `div` with `cursor-pointer`.
- **Auth Race Conditions**: Auth state changes can happen before the Firestore subscription is ready. Guard all subscriptions with `if (user)`.
- **Command Parsing**: The command input must handle quotes correctly to allow spaces in item names or notes.
- **asChild Propagation**: Ensure `asChild` props are correctly forwarded to custom components if using Radix/shadcn primitives.

## Feature Backlog / Known Messes
- [x] Command parsing with quote support
- [x] Sorting by columns (Implement in next turn)
- [x] Delete functionality
- [x] User display fallback for empty profiles
