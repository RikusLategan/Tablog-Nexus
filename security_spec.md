# Security Specification: Tablog

## 1. Data Invariants
- Every log entry (item) MUST have a `category` (representing the medicine/item name).
- Every log entry MUST have a `quantity` (numeric).
- Every log entry MUST have a `createdAt` timestamp, which must be the server time on creation.
- Document IDs must be valid strings.

## 2. The "Dirty Dozen" Payloads (Deny cases)
1. Missing `category`: `{ "quantity": 10, "createdAt": serverTimestamp() }`
2. Missing `quantity`: `{ "category": "Advil", "createdAt": serverTimestamp() }`
3. Missing `createdAt`: `{ "category": "Advil", "quantity": 10 }`
4. Invalid `quantity` type (string): `{ "category": "Advil", "quantity": "ten", "createdAt": serverTimestamp() }`
5. Invalid `category` type (number): `{ "category": 123, "quantity": 10, "createdAt": serverTimestamp() }`
6. `category` too long: `{ "category": "A".repeat(201), "quantity": 10, "createdAt": serverTimestamp() }`
7. `unit` too long: `{ "category": "Advil", "quantity": 10, "unit": "U".repeat(51), "createdAt": serverTimestamp() }`
8. `notes` too long: `{ "category": "Advil", "quantity": 10, "notes": "N".repeat(2001), "createdAt": serverTimestamp() }`
9. Spoofed `createdAt`: `{ "category": "Advil", "quantity": 10, "createdAt": timestamp.date(2000, 1, 1) }`
10. Anonymous write (if rules require auth)
11. Unauthorized update to `createdAt`
12. Injecting unknown fields (if strict keys used)

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would verify these, but since I'm in a constrained environment, I will rely on the Red Team Audit phase.
