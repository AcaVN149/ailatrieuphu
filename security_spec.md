# Security Specification for Millionaire Quiz Leaderboard

## 1. Data Invariants
- A `GameRecord` must belong to a specific player identified by `playerName` and `playerClass`.
- `correctCount` cannot exceed the `totalQuestions` for the given level.
- `durationSeconds` must be a positive number.
- Users can only create their own records.
- Records are immutable once created (for simple leaderboard integrity).
- Rankings are global, so everyone can read all records.

## 2. The "Dirty Dozen" Payloads (to be blocked)
1. **The Identity Spoofer**: Creating a record with someone else's name (authenticated as User A, but `playerName` is User B).
2. **The Time Traveler**: Setting a negative `durationSeconds`.
3. **The Genius Faker**: Setting `correctCount` to 100 when `totalQuestions` is 15.
4. **The Prize Manipulator**: Setting `prizeValue` to 1,000,000,000 for is correct = false.
5. **The Field Injector**: Adding `isVerified: true` or `isAdmin: true` to a record.
6. **The Update Hijacker**: Updating an existing record to improve the score.
7. **The Mass Deleter**: Deleting records they didn't create.
8. **The PII Scraper**: Reading sensitive user profile data (if we had any, like email).
9. **The ID Poisoner**: Using a record ID that is a 1.5KB junk string.
10. **The Size Exploder**: Sending a record where `playerName` is a 1MB string.
11. **The Resource Exhauster**: Creating 10,000 records in a single second.
12. **The Orphan Maker**: Setting a `topicId` that doesn't exist in our app logic.

## 3. Test Runner (Draft)
A test runner would verify that `PERMISSION_DENIED` is returned for the above.
